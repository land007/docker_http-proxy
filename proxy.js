const httpProxy = require('http-proxy');
const http = require('http');
const basicAuth = require('basic-auth');
const crypto = require('crypto');
const url = require("url");


var username = process.env['username'] || 'land007';
var password = process.env['password'] || 'fcea920f7412b5da7be0cf42b8c93759';


var proxy = httpProxy.createProxyServer({
//	target: {
//		host: '192.168.1.218',
//		port: 3000
//	},
//	ws: true
});

var send401 = function(res) {
	res.statusCode = 401;
	res.setHeader('WWW-Authenticate', 'Basic realm=Authorization Required');
	res.end('<html><body>Need some creds son</body></html>');
};

var proxyServer = http.createServer(function (req, res) {
	let pathname = url.parse(req.url).pathname;
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
	if(pathname.indexOf('/api/') == 0) {
		proxy.on('proxyReq', function(proxyReq, req, res, options) {
			proxyReq.setHeader('Host', '192.168.1.218:8080');
		});
		proxy.web(req, res, {
			target : 'http://192.168.1.218:8080'
		});
	} else {
		proxy.on('proxyReq', function(proxyReq, req, res, options) {
			proxyReq.setHeader('Host', '192.168.1.218:3000');
		});
		proxy.web(req, res, {
			target : 'http://192.168.1.218:3000'
		});
	}
//	proxy.web(req, res);
});

proxyServer.on('upgrade', function (req, socket, head) {
	let pathname = url.parse(req.url).pathname;
	if(pathname.indexOf('/api/') == 0) {
		let proxy = new httpProxy.createProxyServer({
			target : {
				host : '192.168.1.218',
				port : '8080'
			},
			ws: true
		});
		proxy.ws(req, socket, head);
	}
//	proxy.ws(req, socket, head);
});

proxyServer.listen(80);
console.log("listen 80");