#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const { URL } = require("url");
const dataPaths = require("../data-paths");

const HOST = process.env.DDNS_HOST || "127.0.0.1";
const PORT = Number(process.env.DDNS_PORT || 8500);
const CONFIG_FILE = dataPaths.DDNS_CONFIG;
const DEFAULT_INTERVAL = Number(process.env.DDNS_INTERVAL || 300);
const IP_CACHE_MS = 30 * 1000;
const MASK = "__KEEP__";

const providers = [
  { id: "cloudflare", name: "Cloudflare", fields: [{ name: "CF_Token", label: "API Token", type: "password" }] },
  { id: "dnspod", name: "Tencent DNSPod", fields: [{ name: "DP_Id", label: "Token ID", type: "text" }, { name: "DP_Key", label: "Token Key", type: "password" }] },
  { id: "aliyun", name: "Aliyun DNS", fields: [{ name: "Ali_Key", label: "AccessKey ID", type: "text" }, { name: "Ali_Secret", label: "AccessKey Secret", type: "password" }] },
  { id: "callback", name: "Callback", fields: [{ name: "CB_URL", label: "Callback URL", type: "text" }, { name: "CB_Method", label: "Method", type: "text" }, { name: "CB_Headers", label: "Headers JSON", type: "text" }] },
];

let config = loadConfig();
let publicIp = { ip4: "", ip6: "", checkedAt: 0 };
let syncing = false;

function loadConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    return normalizeConfig(parsed);
  } catch (error) {
    if (error.code !== "ENOENT") console.error("[ddns] failed to load config:", error.message);
    return { version: "1.0", interval: DEFAULT_INTERVAL, entries: [] };
  }
}

function normalizeConfig(input) {
  const cfg = input && typeof input === "object" ? input : {};
  return {
    version: "1.0",
    interval: Number(cfg.interval || DEFAULT_INTERVAL || 300),
    entries: Array.isArray(cfg.entries) ? cfg.entries.map(normalizeEntry).filter(Boolean) : [],
  };
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const recordTypes = Array.isArray(entry.recordTypes) && entry.recordTypes.length ? entry.recordTypes : ["A"];
  return {
    id: entry.id || crypto.randomUUID(),
    enabled: entry.enabled !== false,
    provider: entry.provider || "cloudflare",
    domain: String(entry.domain || "").trim(),
    recordTypes: recordTypes.filter(t => ["A", "AAAA"].includes(t)),
    ttl: Number(entry.ttl || 600),
    credentials: entry.credentials && typeof entry.credentials === "object" ? entry.credentials : {},
    lastIp4: entry.lastIp4 || "",
    lastIp6: entry.lastIp6 || "",
    lastStatus: entry.lastStatus || "",
    lastSyncAt: entry.lastSyncAt || "",
    lastError: entry.lastError || "",
  };
}

function saveConfig() {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
}

function publicConfig() {
  return {
    ...config,
    entries: config.entries.map(entry => ({
      ...entry,
      credentials: maskCredentials(entry.credentials),
    })),
  };
}

function maskCredentials(credentials) {
  return Object.fromEntries(Object.entries(credentials || {}).map(([key, value]) => [key, value ? MASK : ""]));
}

function mergeCredentials(existing, next) {
  const merged = { ...(existing || {}) };
  Object.entries(next || {}).forEach(([key, value]) => {
    if (value === "" || value === MASK || value == null) return;
    merged[key] = String(value);
  });
  return merged;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function notFound(res) {
  send(res, 404, { error: "Not found" });
}

function requestJson(url, options = {}, body) {
  return requestRaw(url, options, body).then(({ status, text }) => {
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (status < 200 || status >= 300) {
      throw new Error(data.error || data.message || data.Message || `HTTP ${status}`);
    }
    return data;
  });
}

function requestRaw(url, options = {}, body) {
  const target = new URL(url);
  const transport = target.protocol === "http:" ? http : https;
  const payload = body == null ? null : (typeof body === "string" ? body : JSON.stringify(body));
  const headers = { ...(options.headers || {}) };
  if (payload && !headers["Content-Length"]) headers["Content-Length"] = Buffer.byteLength(payload);
  return new Promise((resolve, reject) => {
    const req = transport.request(target, {
      method: options.method || "GET",
      timeout: options.timeout || 15000,
      headers,
    }, res => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { text += chunk; });
      res.on("end", () => resolve({ status: res.statusCode || 0, headers: res.headers, text }));
    });
    req.on("timeout", () => req.destroy(new Error("Request timeout")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getText(url) {
  const { status, text } = await requestRaw(url, { timeout: 8000 });
  if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`);
  return text.trim();
}

async function detectIps(force = false) {
  const now = Date.now();
  if (!force && publicIp.checkedAt && now - publicIp.checkedAt < IP_CACHE_MS) return publicIp;
  const [ip4, ip6] = await Promise.all([
    firstOk(["https://api.ipify.org", "https://ipv4.icanhazip.com"]),
    firstOk(["https://api6.ipify.org", "https://ipv6.icanhazip.com"]),
  ]);
  publicIp = { ip4, ip6, checkedAt: Date.now() };
  return publicIp;
}

async function firstOk(urls) {
  for (const url of urls) {
    try {
      const value = await getText(url);
      if (value) return value;
    } catch {}
  }
  return "";
}

function splitDomain(fqdn) {
  const parts = String(fqdn || "").replace(/\.$/, "").split(".").filter(Boolean);
  if (parts.length <= 2) return { zone: parts.join("."), rr: "@" };
  return { zone: parts.slice(-2).join("."), rr: parts.slice(0, -2).join(".") };
}

function providerName(id) {
  const item = providers.find(p => p.id === id);
  return item ? item.name : id;
}

async function syncEntry(entry, options = {}) {
  const ips = await detectIps(!!options.forceIp);
  const wanted = { A: ips.ip4, AAAA: ips.ip6 };
  const types = (entry.recordTypes || []).filter(type => wanted[type]);
  if (!types.length) {
    entry.lastStatus = "skipped";
    entry.lastError = "No public IP detected for selected record types";
    entry.lastSyncAt = new Date().toISOString();
    saveConfig();
    return entry;
  }

  const unchanged = types.every(type => type === "A" ? entry.lastIp4 === wanted.A : entry.lastIp6 === wanted.AAAA);
  if (!options.force && unchanged) {
    entry.lastStatus = "skipped";
    entry.lastError = "";
    entry.lastSyncAt = new Date().toISOString();
    saveConfig();
    return entry;
  }

  try {
    for (const type of types) {
      await updateDns(entry, type, wanted[type]);
    }
    if (wanted.A) entry.lastIp4 = wanted.A;
    if (wanted.AAAA) entry.lastIp6 = wanted.AAAA;
    entry.lastStatus = "success";
    entry.lastError = "";
  } catch (error) {
    entry.lastStatus = "error";
    entry.lastError = error.message || String(error);
    throw error;
  } finally {
    entry.lastSyncAt = new Date().toISOString();
    saveConfig();
  }
  return entry;
}

async function updateDns(entry, type, ip) {
  if (entry.provider === "cloudflare") return updateCloudflare(entry, type, ip);
  if (entry.provider === "dnspod") return updateDnspod(entry, type, ip);
  if (entry.provider === "aliyun") return updateAliyun(entry, type, ip);
  if (entry.provider === "callback") return updateCallback(entry, type, ip);
  throw new Error(`Unsupported provider: ${entry.provider}`);
}

async function findCloudflareZone(token, fqdn) {
  const labels = fqdn.replace(/\.$/, "").split(".").filter(Boolean);
  for (let i = 0; i < labels.length - 1; i += 1) {
    const name = labels.slice(i).join(".");
    const data = await requestJson(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(name)}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (data.success !== false && data.result && data.result[0]) return data.result[0];
  }
  throw new Error("Cloudflare zone not found");
}

async function updateCloudflare(entry, type, ip) {
  const token = entry.credentials.CF_Token;
  if (!token) throw new Error("Missing CF_Token");
  const zone = await findCloudflareZone(token, entry.domain);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const listUrl = `https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records?type=${type}&name=${encodeURIComponent(entry.domain)}`;
  const list = await requestJson(listUrl, { headers });
  const record = list.result && list.result[0];
  const payload = { type, name: entry.domain, content: ip, ttl: Number(entry.ttl || 600), proxied: false };
  if (record) {
    await requestJson(`https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records/${record.id}`, { method: "PUT", headers }, payload);
  } else {
    await requestJson(`https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records`, { method: "POST", headers }, payload);
  }
}

async function dnspod(action, params) {
  const body = new URLSearchParams(params);
  body.set("format", "json");
  const data = await requestJson(`https://dnsapi.cn/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "docker-http-proxy-acme-ddns/1.0" },
  }, body.toString());
  if (data.status && String(data.status.code) !== "1") throw new Error(data.status.message || `DNSPod ${action} failed`);
  return data;
}

async function updateDnspod(entry, type, ip) {
  const id = entry.credentials.DP_Id;
  const key = entry.credentials.DP_Key;
  if (!id || !key) throw new Error("Missing DP_Id or DP_Key");
  const { zone, rr } = splitDomain(entry.domain);
  const common = { login_token: `${id},${key}`, domain: zone, sub_domain: rr, record_type: type, record_line: "默认" };
  const list = await dnspod("Record.List", { login_token: `${id},${key}`, domain: zone, sub_domain: rr, record_type: type });
  const record = list.records && list.records[0];
  if (record) {
    await dnspod("Record.Modify", { ...common, record_id: record.id, value: ip, ttl: String(entry.ttl || 600) });
  } else {
    await dnspod("Record.Create", { ...common, value: ip, ttl: String(entry.ttl || 600) });
  }
}

function aliyunPercent(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

async function aliyun(entry, action, params) {
  const key = entry.credentials.Ali_Key;
  const secret = entry.credentials.Ali_Secret;
  if (!key || !secret) throw new Error("Missing Ali_Key or Ali_Secret");
  const all = {
    Format: "JSON",
    Version: "2015-01-09",
    AccessKeyId: key,
    SignatureMethod: "HMAC-SHA1",
    Timestamp: new Date().toISOString(),
    SignatureVersion: "1.0",
    SignatureNonce: crypto.randomUUID(),
    Action: action,
    ...params,
  };
  const sorted = Object.keys(all).sort().map(k => `${aliyunPercent(k)}=${aliyunPercent(String(all[k]))}`).join("&");
  const stringToSign = `GET&%2F&${aliyunPercent(sorted)}`;
  const signature = crypto.createHmac("sha1", `${secret}&`).update(stringToSign).digest("base64");
  return requestJson(`https://alidns.aliyuncs.com/?Signature=${aliyunPercent(signature)}&${sorted}`);
}

async function updateAliyun(entry, type, ip) {
  const { zone, rr } = splitDomain(entry.domain);
  const list = await aliyun(entry, "DescribeDomainRecords", { DomainName: zone, RRKeyWord: rr, Type: type });
  const records = list.DomainRecords && list.DomainRecords.Record;
  const record = Array.isArray(records) ? records.find(r => r.RR === rr && r.Type === type) : null;
  if (record) {
    await aliyun(entry, "UpdateDomainRecord", { RecordId: record.RecordId, RR: rr, Type: type, Value: ip, TTL: String(entry.ttl || 600) });
  } else {
    await aliyun(entry, "AddDomainRecord", { DomainName: zone, RR: rr, Type: type, Value: ip, TTL: String(entry.ttl || 600) });
  }
}

async function updateCallback(entry, type, ip) {
  const urlTpl = entry.credentials.CB_URL;
  if (!urlTpl) throw new Error("Missing CB_URL");
  const url = urlTpl
    .replaceAll("#{ip}", encodeURIComponent(ip))
    .replaceAll("#{domain}", encodeURIComponent(entry.domain))
    .replaceAll("#{recordType}", encodeURIComponent(type));
  let headers = {};
  if (entry.credentials.CB_Headers) {
    try {
      headers = JSON.parse(entry.credentials.CB_Headers);
    } catch {
      throw new Error("CB_Headers must be valid JSON");
    }
  }
  const method = (entry.credentials.CB_Method || "GET").toUpperCase();
  const body = method === "GET" ? null : { ip, domain: entry.domain, recordType: type, provider: providerName(entry.provider) };
  const result = await requestRaw(url, { method, headers: { "Content-Type": "application/json", ...headers } }, body);
  if (result.status < 200 || result.status >= 300) throw new Error(`Callback HTTP ${result.status}`);
}

async function syncAll() {
  if (syncing) return;
  syncing = true;
  try {
    for (const entry of config.entries) {
      if (!entry.enabled || !entry.domain) continue;
      try {
        await syncEntry(entry);
      } catch (error) {
        console.error(`[ddns] ${entry.domain} sync failed:`, error.message);
      }
    }
  } finally {
    syncing = false;
  }
}

async function handle(req, res) {
  const url = new URL(req.url, "http://127.0.0.1");
  try {
    if (req.method === "GET" && url.pathname === "/api/ddns/providers") return send(res, 200, providers);
    if (req.method === "GET" && url.pathname === "/api/ddns/config") return send(res, 200, publicConfig());
    if (req.method === "POST" && url.pathname === "/api/ddns/config") {
      const body = await readBody(req);
      if (body.interval) config.interval = Number(body.interval);
      const entry = normalizeEntry({ ...body, id: crypto.randomUUID(), credentials: body.credentials || {} });
      if (!entry.domain) return send(res, 400, { error: "Domain is required" });
      config.entries.push(entry);
      saveConfig();
      return send(res, 200, { entry: { ...entry, credentials: maskCredentials(entry.credentials) } });
    }
    const match = url.pathname.match(/^\/api\/ddns\/config\/([^/]+)$/);
    if (match && req.method === "PUT") {
      const id = decodeURIComponent(match[1]);
      const entry = config.entries.find(item => item.id === id);
      if (!entry) return notFound(res);
      const body = await readBody(req);
      const next = normalizeEntry({ ...entry, ...body, id, credentials: mergeCredentials(entry.credentials, body.credentials) });
      Object.assign(entry, next);
      saveConfig();
      return send(res, 200, { entry: { ...entry, credentials: maskCredentials(entry.credentials) } });
    }
    if (match && req.method === "DELETE") {
      const id = decodeURIComponent(match[1]);
      const before = config.entries.length;
      config.entries = config.entries.filter(item => item.id !== id);
      if (config.entries.length === before) return notFound(res);
      saveConfig();
      return send(res, 200, { ok: true });
    }
    if (req.method === "GET" && url.pathname === "/api/ddns/status") {
      const ips = await detectIps();
      return send(res, 200, { ...ips, entries: publicConfig().entries });
    }
    const syncMatch = url.pathname.match(/^\/api\/ddns\/([^/]+)\/sync$/);
    if (syncMatch && req.method === "POST") {
      const entry = config.entries.find(item => item.id === decodeURIComponent(syncMatch[1]));
      if (!entry) return notFound(res);
      await syncEntry(entry, { force: true, forceIp: true });
      return send(res, 200, { entry: { ...entry, credentials: maskCredentials(entry.credentials) }, ip: publicIp });
    }
    notFound(res);
  } catch (error) {
    send(res, 500, { error: error.message || String(error) });
  }
}

const server = http.createServer(handle);
server.listen(PORT, HOST, () => {
  console.log(`[ddns] server listening on ${HOST}:${PORT}, config=${CONFIG_FILE}`);
});

const tickMs = Math.max(30, Number(config.interval || DEFAULT_INTERVAL || 300)) * 1000;
setInterval(syncAll, tickMs);
setTimeout(syncAll, 3000);
