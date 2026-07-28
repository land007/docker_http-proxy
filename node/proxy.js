const httpProxy = require('http-proxy');
const http = require('http');
const https = require('https');
const basicAuth = require('basic-auth');
const crypto = require('crypto');
const url = require("url");
const fs = require("fs");
const tls = require('tls');
const path = require('path');
const net = require('net');
const NodeSession = require('node-session');
const configLoader = require('./proxy-config-loader');
const proxyStats = require('./proxy-stats');
const dataPaths = require('./data-paths');

var nodeSession = new NodeSession({
	secret: 'Q3UBzdH9GEfiRCTKbi5MTPyChpzXLsTD',
	'lifetime': 24 * 60 * 60 * 1000,
	//'secure': true,
	'encrypt': true
});

// Load configuration from config loader (supports hot-reload)
var username = process.env['username'] || 'land007';
var password = process.env['password'] || '';
var max_session = 0;
var http_proxy_protocols = [];
var http_proxy_domains = [];
var http_proxy_paths = [];
var http_proxy_hosts = [];
var http_proxy_ports = [];
var http_proxy_pretends = [];
var http_proxy_redirects = [];
var http_proxy_users = [];

var ws_proxy_protocols = [];
var ws_proxy_domains = [];
var ws_proxy_paths = [];
var ws_proxy_hosts = [];
var ws_proxy_ports = [];
var ws_proxy_pretends = [];
var ws_proxy_users = [];

var domainName = process.env['DOMAIN_NAME'] || "voice.qhkly.com"; // e.g., "westus"

// Function to update configuration from config loader
function updateConfiguration() {
	const config = configLoader.getConfig();

	if (!config) {
		console.warn('⚠️  Configuration not loaded, using environment variables or defaults');
		return;
	}

	// Update settings
	if (config.settings) {
		max_session = config.settings.maxSession || 0;

		if (config.settings.defaultAuth && config.settings.defaultAuth.enabled) {
			username = config.settings.defaultAuth.username;
			password = config.settings.defaultAuth.password;
		} else if (config.settings.defaultAuth) {
			username = '';
			password = '';
		}
	}

	// Update HTTP proxy rules
	const httpConfig = configLoader.getHttpProxyArrays();
	http_proxy_protocols = httpConfig.protocols;
	http_proxy_domains = httpConfig.domains;
	http_proxy_paths = httpConfig.paths;
	http_proxy_hosts = httpConfig.hosts;
	http_proxy_ports = httpConfig.ports;
	http_proxy_pretends = httpConfig.pretends;
	http_proxy_redirects = httpConfig.redirects || [];
	http_proxy_users = httpConfig.users;

	// Update WebSocket proxy rules
	const wsConfig = configLoader.getWsProxyArrays();
	ws_proxy_protocols = wsConfig.protocols;
	ws_proxy_domains = wsConfig.domains;
	ws_proxy_paths = wsConfig.paths;
	ws_proxy_hosts = wsConfig.hosts;
	ws_proxy_ports = wsConfig.ports;
	ws_proxy_pretends = wsConfig.pretends;
	ws_proxy_users = wsConfig.users;

	console.log('🔄 Configuration updated from config loader');
}

// Initialize configuration loader and register for hot-reload
async function initializeConfiguration() {
	try {
		console.log('🔧 Initializing configuration loader...');
		await configLoader.initialize();
		updateConfiguration();
		loadCertificates();

		// Register for configuration reloads
		configLoader.onReload((newConfig, oldConfig) => {
			console.log('🔄 Configuration reloaded, updating proxy...');
			updateConfiguration();
			loadCertificates();
		});

		console.log('✅ Configuration loader initialized');
	} catch (error) {
		console.error('⛔ Error initializing configuration loader:', error);
		console.log('⚠️  Falling back to environment variables');
	}
}

// Start configuration initialization (async)
initializeConfiguration();

var httpPort = 80;
var httpsPort = 443;
var netPort = 8443;

const normalizeTlsDomain = function(domain) {
	return String(domain || '')
		.trim()
		.toLowerCase()
		.replace(/\.$/, '')
		.replace(/:\d+$/, '');
}

//function to pick out the key + certs dynamically based on the domain name
const getSecureContextFromFiles = function(keyPath, certPath) {
	let config = {
		key: fs.readFileSync(keyPath),
		cert: fs.readFileSync(certPath)
	};
	let credentials;
	if (tls.createSecureContext) {
		credentials = tls.createSecureContext(config);
	} else {
		credentials = crypto.createCredentials(config);
	}
	return credentials.context;
}

const getSecureContext = function(domain) {
	return getSecureContextFromFiles(
		path.join(dataPaths.CERT_DIR, `${domain}_key.key`),
		path.join(dataPaths.CERT_DIR, `${domain}_chain.crt`)
	);
}

//safely build a secure context; returns null when the cert files are missing/unreadable
const tryGetSecureContext = function(domain, certFile, keyFile) {
	try {
		if (certFile && keyFile) {
			return getSecureContextFromFiles(dataPaths.resolve(keyFile), dataPaths.resolve(certFile));
		}
		return getSecureContext(domain);
	} catch (error) {
		console.warn(`⚠️  Certificate for "${domain}" not available: ${error.message}`);
		return null;
	}
}

//ensure there is always at least one usable key/cert so the HTTPS server can start,
//even before any real certificate has been issued (e.g. a fresh ACME deployment with an empty cert dir)
const DEFAULT_CERT_DOMAIN = '_default';
const FALLBACK_CERT_DOMAIN = 'www.gjxt.xyz';
const ensureDefaultCertDomain = function() {
	const certDir = dataPaths.CERT_DIR;
	const candidates = [FALLBACK_CERT_DOMAIN, domainName];
	try {
		fs.readdirSync(certDir)
			.filter(f => f.endsWith('_chain.crt'))
			.forEach(f => candidates.push(f.replace('_chain.crt', '')));
	} catch (e) { /* cert dir may not exist yet */ }

	for (const d of candidates) {
		if (!d) continue;
		if (fs.existsSync(path.join(certDir, `${d}_key.key`)) && fs.existsSync(path.join(certDir, `${d}_chain.crt`))) {
			return d;
		}
	}

	// nothing available: generate a throwaway self-signed cert so TLS can bootstrap
	if (!fs.existsSync(certDir)) {
		fs.mkdirSync(certDir, { recursive: true });
	}
	const keyPath = path.join(certDir, `${DEFAULT_CERT_DOMAIN}_key.key`);
	const certPath = path.join(certDir, `${DEFAULT_CERT_DOMAIN}_chain.crt`);
	require('child_process').execSync(
		`openssl req -x509 -newkey rsa:2048 -nodes -keyout "${keyPath}" -out "${certPath}" -days 3650 -subj "/CN=localhost"`,
		{ stdio: 'ignore' }
	);
	console.warn('⚠️  No certificate found; generated a temporary self-signed certificate for HTTPS bootstrap');
	return DEFAULT_CERT_DOMAIN;
}

const defaultCertDomain = ensureDefaultCertDomain();

const secureContext = {};

const setSecureContext = function(domain, ctx) {
	const normalized = normalizeTlsDomain(domain);
	if (normalized && ctx) {
		secureContext[normalized] = ctx;
	}
}

// Load additional certificates from config
function loadCertificates() {
	Object.keys(secureContext).forEach(domain => delete secureContext[domain]);

	[FALLBACK_CERT_DOMAIN, domainName, defaultCertDomain].forEach(function(d) {
		if (!d || secureContext[normalizeTlsDomain(d)]) return;
		const ctx = tryGetSecureContext(d);
		setSecureContext(d, ctx);
	});

	const config = configLoader.getConfig();
	if (config && config.sslCertificates) {
		config.sslCertificates.forEach(cert => {
			try {
				const certPath = dataPaths.resolve(cert.certFile);
				const keyPath = dataPaths.resolve(cert.keyFile);

				if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
					setSecureContext(cert.domain, tryGetSecureContext(cert.domain, cert.certFile, cert.keyFile));
					console.log(`✅ Loaded certificate for domain: ${cert.domain}`);
				}
			} catch (error) {
				console.error(`⛔ Error loading certificate for ${cert.domain}:`, error);
			}
		});
	}
}

const findSecureContext = function(domain) {
	const normalized = normalizeTlsDomain(domain);
	if (secureContext[normalized]) {
		return secureContext[normalized];
	}

	return secureContext[normalizeTlsDomain(FALLBACK_CERT_DOMAIN)] || secureContext[normalizeTlsDomain(defaultCertDomain)];
}

const options = {
	SNICallback: function(domain, cb) {
		const ctx = findSecureContext(domain);
		if (cb) {
			cb(null, ctx);
		} else {
			// compatibility for older versions of node
			return ctx;
		}
		//throw new Error('No keys/certificates for domain requested');
	},
	key: fs.readFileSync(path.join(dataPaths.CERT_DIR, `${defaultCertDomain}_key.key`)),
	cert: fs.readFileSync(path.join(dataPaths.CERT_DIR, `${defaultCertDomain}_chain.crt`))
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

const wantsHttpsRedirect = function(req, index) {
	return !req.socket.encrypted && http_proxy_redirects[index] === 'true';
};

const buildHttpsRedirectUrl = function(req) {
	const host = String(req.headers.host || '').replace(/:80$/, '');
	return `https://${host}${req.url || '/'}`;
};

const sendHttpsRedirect = function(req, res) {
	res.writeHead(301, {
		'Location': buildHttpsRedirectUrl(req),
		'Content-Type': 'text/plain'
	});
	res.end('Redirecting to HTTPS');
};

// domain 为空 = 通配（匹配任意 host）；支持逗号分隔的多域名，任一 host 命中即算匹配
const domainMatches = function(ruleDomain, host) {
	if (!ruleDomain) return true;
	return String(ruleDomain).split(',').some(function(d) { return d.trim() === host; });
};

const buildRuleStatsMeta = function(kind, index) {
	const protocols = kind === 'ws' ? ws_proxy_protocols : http_proxy_protocols;
	const domains = kind === 'ws' ? ws_proxy_domains : http_proxy_domains;
	const paths = kind === 'ws' ? ws_proxy_paths : http_proxy_paths;
	const hosts = kind === 'ws' ? ws_proxy_hosts : http_proxy_hosts;
	const ports = kind === 'ws' ? ws_proxy_ports : http_proxy_ports;
	const protocol = protocols[index] || (kind === 'ws' ? 'ws:' : 'http:');
	const domain = domains[index] || '';
	const pathValue = paths[index] || '/';
	const target = `${hosts[index] || ''}:${ports[index] || ''}`;
	return {
		key: `${kind}|${protocol}|${domain}|${pathValue}|${target}`,
		kind,
		protocol,
		domain,
		path: pathValue,
		target
	};
};

const buildProxyTarget = function(protocol, host, port) {
	const targetProtocol = protocol || 'http:';
	const targetPort = String(port || '');
	const isDefaultPort = (targetProtocol === 'http:' || targetProtocol === 'ws:') && targetPort === '80'
		|| (targetProtocol === 'https:' || targetProtocol === 'wss:') && targetPort === '443';
	return `${targetProtocol}//${host}${isDefaultPort || !targetPort ? '' : ':' + targetPort}`;
};

const createHttpProxy = function(protocol, host, port, pretend) {
	const options = {
		target: buildProxyTarget(protocol, host, port),
		secure: false,
		ws: false
	};
	if (pretend) {
		options.autoRewrite = true;
		options.changeOrigin = true;
	}
	return httpProxy.createProxyServer(options);
};

const createWsProxy = function(protocol, host, port, pretend) {
	const options = {
		target: buildProxyTarget(protocol, host, port),
		secure: false,
		ws: true
	};
	if (pretend) {
		options.autoRewrite = true;
		options.changeOrigin = true;
	}
	return httpProxy.createProxyServer(options);
};

const installResponseByteCounter = function(res, sample) {
	const originalWrite = res.write;
	const originalEnd = res.end;
	const addBytes = (chunk, encoding) => {
		if (!chunk) return;
		if (Buffer.isBuffer(chunk)) {
			sample.responseBytes += chunk.length;
		} else if (typeof chunk === 'string') {
			sample.responseBytes += Buffer.byteLength(chunk, encoding);
		}
	};
	res.write = function(chunk, encoding, callback) {
		addBytes(chunk, encoding);
		return originalWrite.apply(this, arguments);
	};
	res.end = function(chunk, encoding, callback) {
		addBytes(chunk, encoding);
		return originalEnd.apply(this, arguments);
	};
};

const _userSession = {};

const check = function(req, users, _token) {
	// 检查session
	let login_name;
	if (max_session > 0 && _token) {
		login_name = req.session.get('login_name');
		consoleLog('login_name', login_name);
	}
	// 没有登录
	if (login_name === undefined) {
		if (!users || Object.keys(users).length === 0) {
			users = undefined;
			if (username && password) {
				users = {};
				users[username] = password;
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
    console.log('_requestListener host', host);
	let pathname = url.parse(req.url).pathname;
    console.log('_requestListener pathname', pathname);
	let _token;
	if (max_session > 0) {
		let _session = req.session.all();
		_token = _session._token;
		consoleLog('_token', _token);
	}
	let have_http_proxy_path = false;
	for (let h in http_proxy_paths) {
		// 路径及域名验证
		if (pathname.indexOf(http_proxy_paths[h]) == 0 && domainMatches(http_proxy_domains[h], host)) {
			// 命中规则即开始统计，包含认证挑战等未转发完成的请求
			have_http_proxy_path = true;
			const statsSample = proxyStats.beginHttp(buildRuleStatsMeta('http', h));
			statsSample.responseBytes = 0;
			installResponseByteCounter(res, statsSample);
			let statsFinished = false;
			const finishStats = () => {
				if (statsFinished) return;
				statsFinished = true;
				proxyStats.finishHttp(statsSample, res.statusCode, statsSample.responseBytes || 0);
			};
			res.once('finish', finishStats);
			res.once('close', finishStats);
			if (wantsHttpsRedirect(req, h)) {
				sendHttpsRedirect(req, res);
				return;
			}
			// 检查登录信息
			if(!check(req, http_proxy_users[h], _token)) {
				send401(res);
				return;
			}
			// 都检查通过了可以代理
			if (http_proxy_pretends[h] && http_proxy_pretends[h] == 'true') {
				let proxy = createHttpProxy(
					http_proxy_protocols[h] ? http_proxy_protocols[h] : "http:",
					http_proxy_hosts[h],
					http_proxy_ports[h],
					true
				);
				proxy.on('error', function(error, req, res) {
					console.error('⛔ HTTP proxy error:', error.message);
					if (res && !res.headersSent) {
						res.writeHead(502, { 'Content-Type': 'text/plain' });
					}
					if (res && !res.writableEnded) {
						res.end('Proxy error');
					}
				});
//				proxy.on('proxyReq', function(proxyReq, req, res, options) {
//					proxyReq.setHeader('Host', http_proxy_hosts[h] + ':' + http_proxy_ports[h]);
//				});
				proxy.web(req, res);
			} else {
				let proxy = createHttpProxy(
					http_proxy_protocols[h] ? http_proxy_protocols[h] : "http:",
					http_proxy_hosts[h],
					http_proxy_ports[h],
					false
				);
				proxy.on('error', function(error, req, res) {
					console.error('⛔ HTTP proxy error:', error.message);
					if (res && !res.headersSent) {
						res.writeHead(502, { 'Content-Type': 'text/plain' });
					}
					if (res && !res.writableEnded) {
						res.end('Proxy error');
					}
				});
				proxy.web(req, res);
			}
			break;
		}
	}
	// 没有命中
	if (!have_http_proxy_path) {
		let responseBytes = 0;
		const body = 'Welcome to my server! host:' + host + ' pathname:' + pathname;
		responseBytes = Buffer.byteLength(body);
		proxyStats.recordUnmatched('http', 200, responseBytes, 0);
		res.writeHead(200, {
			'Content-Type': 'text/plain'
		});
		res.end(body);
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
		// https数据流的第一位是十六进制"16"，转换成十进制就是22
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
    console.log('_upgrade host', host);
	let pathname = url.parse(req.url).pathname;
    console.log('_upgrade pathname', pathname);
	let _token;
	if (max_session > 0) {
		let _session = req.session.all();
		_token = _session._token;
		consoleLog('_token', _token);
	}
	let have_ws_proxy_path = false;
	for (let w in ws_proxy_paths) {
		if (pathname.indexOf(ws_proxy_paths[w]) == 0 && domainMatches(ws_proxy_domains[w], host)) {
			have_ws_proxy_path = true;
			// 检查登录信息
			if(!check(req, ws_proxy_users[w], _token)) {
				socket.write('HTTP/1.1 401 Unauthorized\r\nWWW-Authenticate: Basic realm=Authorization Required\r\n\r\n');
				socket.destroy();
				return;
			}
			const statsSample = proxyStats.openWs(buildRuleStatsMeta('ws', w));
			let statsClosed = false;
			const closeStats = (hadError) => {
				if (statsClosed) return;
				statsClosed = true;
				proxyStats.closeWs(statsSample, hadError);
			};
			socket.once('close', () => closeStats(false));
			socket.once('error', () => closeStats(true));
			if (ws_proxy_pretends[w] && ws_proxy_pretends[w] == 'true') {
				let proxy = createWsProxy(
					ws_proxy_protocols[w] ? ws_proxy_protocols[w] : "ws:",
					ws_proxy_hosts[w],
					ws_proxy_ports[w],
					true
				);
				proxy.on('error', function(error) {
					console.error('⛔ WS proxy error:', error.message);
					closeStats(true);
				});
				proxy.ws(req, socket, head);
			} else {
				let proxy = createWsProxy(
					ws_proxy_protocols[w] ? ws_proxy_protocols[w] : "ws:",
					ws_proxy_hosts[w],
					ws_proxy_ports[w],
					false
				);
				proxy.on('error', function(error) {
					console.error('⛔ WS proxy error:', error.message);
					closeStats(true);
				});
				proxy.ws(req, socket, head);
			}
			break;
		}
	}
	if (!have_ws_proxy_path) {
		proxyStats.recordUnmatched('ws', 404, 0, 0);
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
