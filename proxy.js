const httpProxy = require('http-proxy');
const http = require('http');
const https = require('https');
const basicAuth = require('basic-auth');
const crypto = require('crypto');
const url = require("url");
const fs = require("fs");
const path = require("path");
const sep = path.sep;

var username = process.env['username'] || 'land007';
var password = process.env['password'] || '';

var http_proxy_domains = (process.env['http_proxy_domains'] || '').split(' ');
var http_proxy_paths = (process.env['http_proxy_paths'] || '').split(' ');
var http_proxy_hosts = (process.env['http_proxy_hosts'] || '').split(' ');
var http_proxy_ports = (process.env['http_proxy_ports'] || '').split(' ');
var http_proxy_pretends = (process.env['http_proxy_pretends'] || '').split(' ');

var ws_proxy_domains = (process.env['ws_proxy_domains'] || '').split(' ');
var ws_proxy_paths = (process.env['ws_proxy_paths'] || '').split(' ');
var ws_proxy_hosts = (process.env['ws_proxy_hosts'] || '').split(' ');
var ws_proxy_ports = (process.env['ws_proxy_ports'] || '').split(' ');

var domainName = process.env['DOMAIN_NAME'] || "voice.qhkly.com"; // e.g., "westus"
const options = {
	key: fs.readFileSync(__dirname + sep + 'cert' + sep + domainName + '_key.key'),
	cert: fs.readFileSync(__dirname + sep + 'cert' + sep + domainName + '_chain.crt')
};

var send401 = function(res) {
	res.statusCode = 401;
	res.setHeader('WWW-Authenticate', 'Basic realm=Authorization Required');
	res.end('<html><body>Need some creds son</body></html>');
};

var requestListener = function (req, res) {
	var host = req.headers.host;
	let pathname = url.parse(req.url).pathname;
	if(password != '') {
		let user = basicAuth(req);
		if (!user) {
			send401(res);
			return;
		}
		let md5 = crypto.createHash('md5');
		if (user.pass === undefined) {
			md5.update('undefined');
		} else {
			md5.update(user.pass);
		}
		let pass = md5.digest('hex');
		if (user.name !== username || pass !== password) {
			send401(res);
			return;
		}
	}
	let have_http_proxy_path = false;
	for(let h in http_proxy_paths) {
		if(pathname.indexOf(http_proxy_paths[h]) == 0 && (http_proxy_domains[h] == '' || http_proxy_domains[h] == host)) {
			have_http_proxy_path = true;
			if(http_proxy_pretends[h] == 'true') {
				let proxy = httpProxy.createProxyServer({
				    hostRewrite: http_proxy_hosts[h],
				    autoRewrite: true,
					target: {
						host: http_proxy_hosts[h],
						port: http_proxy_ports[h]
					},
					ws: false
				});
				proxy.on('proxyReq', function(proxyReq, req, res, options) {
					proxyReq.setHeader('Host', http_proxy_hosts[h] + ':' + http_proxy_ports[h]);
				});
				proxy.web(req, res);
			} else {
				let proxy = httpProxy.createProxyServer({
					target: {
						host: http_proxy_hosts[h],
						port: http_proxy_ports[h]
					},
					ws: false
				});
				proxy.web(req, res);
			}
			break;
		}
	}
	if(!have_http_proxy_path) {
		res.writeHead(200, {
			'Content-Type' : 'text/plain'
		});
		res.end('Welcome to my server!');
	}
};

var upgrade = function (req, socket, head) {
	var host = req.headers.host;
	let pathname = url.parse(req.url).pathname;
	for(let w in ws_proxy_paths) {
		if(pathname.indexOf(ws_proxy_paths[w]) == 0 && (ws_proxy_domains[w] == '' || ws_proxy_domains[w] == host)) {
			let proxy = new httpProxy.createProxyServer({
				target : {
					host :  ws_proxy_hosts[w],
					port :  ws_proxy_ports[w]
				},
				ws: true
			});
			proxy.ws(req, socket, head);
			break;
		}
	}
};

var proxysServer = https.createServer(options, requestListener);
var proxyServer = http.createServer(requestListener);

proxysServer.on('upgrade', upgrade);
proxyServer.on('upgrade', upgrade);

proxysServer.listen(443);
console.log("listen 443");

proxyServer.listen(80);
console.log("listen 80");