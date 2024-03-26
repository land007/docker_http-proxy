const httpProxy = require('http-proxy');
const http = require('http');
const https = require('https');
const basicAuth = require('basic-auth');
const crypto = require('crypto');
const url = require("url");
const fs = require("fs");
const tls = require("tls");
const path = require("path");
const sep = path.sep;
const net = require('net');
const NodeSession = require('node-session');
const util = require('util');
const readFile = util.promisify(fs.readFile);

var nodeSession = new NodeSession({
	secret: 'Q3UBzdH9GEfiRCTKbi5MTPyChpzXLsTD',
	'lifetime': 24 * 60 * 60 * 1000,
	//'secure': true,
	'encrypt': true
});

var readJson = async function(filename) {
	try {
		let data = await readFile(filename, 'utf-8'); //put the resolved results of readFilePr into contents
		let json = JSON.parse(data.toString());
		//consoleLog(json);
		return json;
	} catch (err) { //if readFilePr returns errors, we catch it here
		console.error('⛔ We could not read', filename)
		console.error('⛔ This is the error: ', err);
	}
};

var username = process.env['username'] || 'land007';
var password = process.env['password'] || '';
var usernames = (process.env['usernames'] || '').split(',');
var passwords = (process.env['passwords'] || '').split(',');
var max_session = parseInt(process.env['max_session'] || '0');
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
	let config = {
		key: fs.readFileSync(__dirname + sep + 'cert' + sep + domain + '_key.key'),
		cert: fs.readFileSync(__dirname + sep + 'cert' + sep + domain + '_chain.crt')
	};
	let credentials;
	if (tls.createSecureContext) {
		credentials = tls.createSecureContext(config);
	} else {
		credentials = crypto.createCredentials(config);
	}
	return credentials.context;
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
	key: fs.readFileSync(__dirname + sep + 'cert' + sep + 'www.gjxt.xyz' + '_key.key'),
	cert: fs.readFileSync(__dirname + sep + 'cert' + sep + 'www.gjxt.xyz' + '_chain.crt')
};

const getClientIp = function(req) {
	return req.headers['x-forwarded-for'] ||
		req.connection.remoteAddress ||
		req.socket.remoteAddress ||
		req.connection.socket.remoteAddress;
};

const consoleLog = function(...log) {
	//console.log(log);
};

const send401 = function(res) {
	res.statusCode = 401;
	res.setHeader('WWW-Authenticate', 'Basic realm=Authorization Required');
	res.end('<html><body>Need some creds son</body></html>');
};

const _userSession = {};

var users_list;
const init = async function() {
	users_list = await readJson('users_list.json');
};
init();
setInterval(init, 5000);

const check = function(req, h, _token) {
	// 检查session
	let login_name;
	if (max_session > 0 && _token) {
		login_name = req.session.get('login_name');
		consoleLog('login_name', login_name);
	}
	// 没有登录
	if (login_name === undefined) {
		let users;
		if (users_list !== undefined) {
			// 得到用户名密码对应表
			users = users_list[h];
		}
		// 可以使用用户名密码参数
		if (users === undefined) {
			// 传参也支持多用户名密码形式
			let _usernames = (usernames[h] ? usernames[h] : username).split('|');
			let _passwords = (passwords[h] ? passwords[h] : password).split('|');
			consoleLog('_usernames', _usernames);
			consoleLog('_passwords', _passwords);
			// 支持没有密码
			if (!(_passwords.length == 1 && _passwords[0] == '')) {
				users = {};
				for (let _p in _passwords) {
					let _username = _usernames[_p];
					let _password = _passwords[_p];
					// 统一成用户名密码对象表
					users[_username] = _password;
				}
			}
		}
		// 如果需要验证
		if (users !== undefined && users !== null) {
			consoleLog('users', users);
			// 获取请求中的用户名密码
			let user = basicAuth(req);
			consoleLog('user', user);
			// 没有的要求给
			if (!user) {
				return false;
			}
			// 验证的用户名必须有
			consoleLog('users[user.name]', users[user.name]);
			if (users[user.name] === undefined) {
				return false;
			}
			// 验证的密码是md5，防止泄漏
			let md5 = crypto.createHash('md5');
			if (user.pass === undefined) {
				md5.update('undefined');
			} else {
				md5.update(user.pass);
			}
			let pass = md5.digest('hex');
			consoleLog('pass', pass);
			// 密码需正确
			if (pass !== users[user.name]) {
				return false;
			}
			// 多登录支持
			if (max_session > 0 && _token) {
				// 把session保存在内存中
				req.session.put('login_name', user.name);
				if (_userSession[user.name] === undefined) {
					_userSession[user.name] = [];
				}
				_userSession[user.name].unshift(_token);
				// 超出数量的session删除
				if (_userSession[user.name].length > max_session) {
					_userSession[user.name].pop();
				}
			}
		}
	} else {// 登录过
		let tokens = _userSession[login_name];
		// 检查内存中的session是否允许
		consoleLog('tokens', tokens);
		if (tokens === undefined || !tokens.includes(_token)) {
			req.session.forget('login_name');
			return false;
		}
	}
	return true;
}

const _requestListener = async function(req, res) {
	//let ip = getClientIp(req);
	let host = req.headers.host;
	let pathname = url.parse(req.url).pathname;
	let _token;
	if (max_session > 0) {
		let _session = req.session.all();
		_token = _session._token;
		consoleLog('_token', _token);
	}
	let have_http_proxy_path = false;
	for (let h in http_proxy_paths) {
		// 路径及域名验证
		if (pathname.indexOf(http_proxy_paths[h]) == 0 && (http_proxy_domains[h] == '' || http_proxy_domains[h] == host)) {
			// 检查登录信息
			if(!check(req, h, _token)) {
				send401(res);
				return;
			}
			// 都检查通过了可以代理
			have_http_proxy_path = true;
			if (http_proxy_pretends[h] && http_proxy_pretends[h] == 'true') {
				let proxy = httpProxy.createProxyServer({
					hostRewrite: http_proxy_hosts[h],
					autoRewrite: true,
					target: {
						host: http_proxy_hosts[h],
						port: http_proxy_ports[h],
						protocol: http_proxy_protocols[h] ? http_proxy_protocols[h] : "http:"
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
						protocol: http_proxy_protocols[h] ? http_proxy_protocols[h] : "http:"
					},
					secure: false,
					ws: false
				});
				proxy.web(req, res);
			}
			break;
		}
	}
	// 没有命中
	if (!have_http_proxy_path) {
		res.writeHead(200, {
			'Content-Type': 'text/plain'
		});
		res.end('Welcome to my server! host:' + host + ' pathname:' + pathname);
	}
};

const requestListener = function(req, res) {
	if (max_session > 0) {
		nodeSession.startSession(req, res, function() {
			_requestListener(req, res);
		});
	} else {
		_requestListener(req, res);
	}
};

const netListener = function(socket) {
	socket.once('data', function(buf) {
		consoleLog(buf[0]);
		// https数据流的第一位是十六进制“16”，转换成十进制就是22
		let address = buf[0] === 22 ? httpsPort : httpPort;
		//创建一个指向https或http服务器的链接
		let proxy = net.createConnection(address, function() {
			proxy.write(buf);
			//反向代理的过程，tcp接受的数据交给代理链接，代理链接服务器端返回数据交由socket返回给客户端
			socket.pipe(proxy).pipe(socket);
		});
		proxy.on('error', function(err) {
			consoleLog(err);
		});
	});
	socket.on('error', function(err) {
		consoleLog(err);
	});
};

const upgrade = function(req, socket, head) {
	if (max_session > 0) {
		nodeSession.startSession(req, {end: function(){}}, function() {
			_upgrade(req, socket, head);
		});
	} else {
		_upgrade(req, socket, head);
	}
};

const _upgrade = function(req, socket, head) {
	let host = req.headers.host;
	let pathname = url.parse(req.url).pathname;
	let _token;
	if (max_session > 0) {
		let _session = req.session.all();
		_token = _session._token;
		consoleLog('_token', _token);
	}
	for (let w in ws_proxy_paths) {
		// 检查登录信息
		if(!check(req, w, _token)) {
			//send401(res);
			return;
		}
		if (pathname.indexOf(ws_proxy_paths[w]) == 0 && (ws_proxy_domains[w] == '' || ws_proxy_domains[w] == host)) {
			let proxy = new httpProxy.createProxyServer({
				target: {
					host: ws_proxy_hosts[w],
					port: ws_proxy_ports[w],
					protocol: ws_proxy_protocols[w] ? ws_proxy_protocols[w] : "ws:"
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
consoleLog("listen " + httpsPort);

proxyServer.listen(httpPort);
consoleLog("listen " + httpPort);

net.createServer(netListener).listen(netPort);
consoleLog("listen " + netPort);
