#!/usr/bin/env node
"use strict";

const http = require("http");
const net = require("net");

const HOST = process.env.ADMIN_SPLITTER_HOST || "0.0.0.0";
const PORT = Number(process.env.ADMIN_SPLITTER_PORT || process.env.PUBLIC_ADMIN_PORT || 8444);
const ADMIN_HOST = process.env.ADMIN_API_HOST || "127.0.0.1";
const ADMIN_PORT = Number(process.env.ADMIN_API_PORT || 18444);
const DDNS_HOST = process.env.DDNS_HOST || "127.0.0.1";
const DDNS_PORT = Number(process.env.DDNS_PORT || 8500);

function targetFor(req) {
  if (req.url && req.url.startsWith("/api/ddns/")) {
    return { host: DDNS_HOST, port: DDNS_PORT, auth: true };
  }
  return { host: ADMIN_HOST, port: ADMIN_PORT, auth: false };
}

function checkAuth(req) {
  return new Promise(resolve => {
    const authReq = http.request({
      host: ADMIN_HOST,
      port: ADMIN_PORT,
      path: "/api/auth/me",
      method: "GET",
      headers: {
        Cookie: req.headers.cookie || "",
        Accept: "application/json",
      },
      timeout: 5000,
    }, res => {
      res.resume();
      res.on("end", () => resolve(res.statusCode === 200));
    });
    authReq.on("timeout", () => authReq.destroy());
    authReq.on("error", () => resolve(false));
    authReq.end();
  });
}

function copyHeaders(headers) {
  const next = { ...headers };
  delete next.host;
  return next;
}

const server = http.createServer(async (req, res) => {
  const target = targetFor(req);
  if (target.auth && !(await checkAuth(req))) {
    res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    req.resume();
    return;
  }

  const proxyReq = http.request({
    host: target.host,
    port: target.port,
    path: req.url,
    method: req.method,
    headers: {
      ...copyHeaders(req.headers),
      Host: `${target.host}:${target.port}`,
      "X-Forwarded-Host": req.headers.host || "",
      "X-Forwarded-Proto": "http",
    },
  }, proxyRes => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", error => {
    if (!res.headersSent) res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: error.message || "Proxy error" }));
  });

  req.pipe(proxyReq);
});

server.on("upgrade", (req, socket, head) => {
  const target = targetFor(req);
  if (target.auth) {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  const upstream = net.connect(target.port, target.host, () => {
    upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`);
    Object.entries(req.headers).forEach(([key, value]) => {
      upstream.write(`${key}: ${value}\r\n`);
    });
    upstream.write("\r\n");
    if (head && head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });

  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.listen(PORT, HOST, () => {
  console.log(`[admin-splitter] listening on ${HOST}:${PORT}; admin=${ADMIN_HOST}:${ADMIN_PORT}; ddns=${DDNS_HOST}:${DDNS_PORT}`);
});
