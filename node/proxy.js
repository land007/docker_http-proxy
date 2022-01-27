const httpProxy = require('http-proxy');
const http = require('http');
const https = require('https');
const basicAuth = require('basic-auth');
const crypto = require('crypto');
const url = require("url");
const fs = require("fs");
const path = require("path");
const sep = path.sep;
const net = require('net');

var username = process.env['username'] || 'land007';
var password = process.env['password'] || '';
var usernames = (process.env['usernames'] || '').split(',');
var passwords = (process.env['passwords'] || '').split(',');

var http_proxy_protocols = (process.env['http_proxy_protocols'] || '').split(',');
var http_proxy_domains = (process.env['http_proxy_domains'] || '').split(',');
var http_proxy_paths = (process.env['http_proxy_paths'] || '').split(',');
var http_proxy_hosts = (process.env['http_proxy_hosts'] || '').split(',');
var http_proxy_ports = (process.env['http_proxy_ports'] || '').split(',');
var http_proxy_pretends = (process.env['http_proxy_pretends'] || '').split(',');

var ws_proxy_protocols = (process.env['ws_proxy_protocols'] || '').split(',');
var ws_proxy_domains = (process.env['ws_proxy_domains'] || '').split(',');
var ws_proxy_paths = (process.env['ws_proxy_paths'] || '').split(',');
var ws_proxy_hosts = (process.env['ws_proxy_hosts'] || '').split(',');
var ws_proxy_ports = (process.env['ws_proxy_ports'] || '').split(',');

var domainName = process.env['DOMAIN_NAME'] || "voice.qhkly.com"; // e.g., "westus"

var httpPort = 80;
var httpsPort = 443;
var netPort = 8443;

//function to pick out the key + certs dynamically based on the domain name
const getSecureContext = function(domain) {
    return crypto.createCredentials({
        key:  fs.readFileSync(__dirname + sep + 'cert' + sep + domain + '_key.key'),
        cert: fs.readFileSync(__dirname + sep + 'cert' + sep + domain + '_chain.crt')}).context;
}

//read them into memory
const secureContext = {
    'www.gjxt.xyz': getSecureContext('www.gjxt.xyz')
}

secureContext[domainName] = getSecureContext(domainName);

const options = {
	SNICallback: function(domain, cb) {
		if (secureContext[domain]) {
			if (cb) {
				cb(null, secureContext[domain]);
			} else {
				// compatibility for older versions of node
				return secureContext[domain];
			}
		} else {
            if (cb) {
				cb(null, secureContext['www.gjxt.xyz']);
			} else {
				// compatibility for older versions of node
				return secureContext['www.gjxt.xyz'];
			}
			//throw new Error('No keys/certificates for domain requested');
		}
	},
	key: fs.readFileSync(__dirname + sep + 'cert' + sep + domainName + '_key.key'),
	cert: fs.readFileSync(__dirname + sep + 'cert' + sep + domainName + '_chain.crt')
};

var send401 = function(res) {
	res.statusCode = 401;
	res.setHeader('WWW-Authenticate', 'Basic realm=Authorization Required');
	res.end('<html><body>Need some creds son</body></html>');
};

var requestListener = function (req, res) {
	let host = req.headers.host;
	let pathname = url.parse(req.url).pathname;
	let have_http_proxy_path = false;
	for(let h in http_proxy_paths) {
		if(pathname.indexOf(http_proxy_paths[h]) == 0 && (http_proxy_domains[h] == '' || http_proxy_domains[h] == host)) {
			let _username = usernames[h] ? usernames[h] : username;
			let _password = passwords[h] ? passwords[h] : password;
			if(_password != '') {
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
				if (user.name !== _username || pass !== _password) {
					send401(res);
					return;
				}
			}
			have_http_proxy_path = true;
			if(http_proxy_pretends[h] && http_proxy_pretends[h] == 'true') {
				let proxy = httpProxy.createProxyServer({
				    hostRewrite: http_proxy_hosts[h],
				    autoRewrite: true,
					target: {
						host: http_proxy_hosts[h],
						port: http_proxy_ports[h],
						protocol: http_proxy_protocols[h]? http_proxy_protocols[h]: "http:"
					},
					secure: false,
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
						port: http_proxy_ports[h],
						protocol: http_proxy_protocols[h]? http_proxy_protocols[h]: "http:"
					},
					secure: false,
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

var netListener = function(socket) {
	socket.once('data', function(buf){
		//console.log(buf[0]);
		// https数据流的第一位是十六进制“16”，转换成十进制就是22
		var address = buf[0] === 22 ? httpsPort : httpPort;
		//创建一个指向https或http服务器的链接
		var proxy = net.createConnection(address, function() {
			proxy.write(buf);
			//反向代理的过程，tcp接受的数据交给代理链接，代理链接服务器端返回数据交由socket返回给客户端
			socket.pipe(proxy).pipe(socket);
		});
		proxy.on('error', function(err) {
			console.log(err);
		});
	});
	socket.on('error', function(err) {
		console.log(err);
	});
};

var upgrade = function (req, socket, head) {
	var host = req.headers.host;
	let pathname = url.parse(req.url).pathname;
	for(let w in ws_proxy_paths) {
		if(pathname.indexOf(ws_proxy_paths[w]) == 0 && (ws_proxy_domains[w] == '' || ws_proxy_domains[w] == host)) {
			let proxy = new httpProxy.createProxyServer({
				target : {
					host :  ws_proxy_hosts[w],
					port :  ws_proxy_ports[w],
					protocol: ws_proxy_protocols[w]? ws_proxy_protocols[w]: "ws:"
				},
				secure: false,
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

proxysServer.listen(httpsPort);
console.log("listen " + httpsPort);

proxyServer.listen(httpPort);
console.log("listen " + httpPort);

net.createServer(netListener).listen(netPort);
console.log("listen " + netPort);
