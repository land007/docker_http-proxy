/**
 * Admin API Server
 * Express.js server providing REST API for proxy configuration management
 */

const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const helmet = require('helmet');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');
const multer = require('multer');

const authManager = require('./auth-manager');
const configLoader = require('./proxy-config-loader');
const configValidator = require('./config-validator');
const acmeManager = require('./acme-manager');
const { body, validationResult, param } = require('express-validator');

const app = express();
const PORT = process.env.ADMIN_PORT || 8443;
const upload = multer({ storage: multer.memoryStorage() });

// Security middleware
app.use(helmet({
	contentSecurityPolicy: false, // Disable CSP for simplicity with Bootstrap CDN
	hsts: false // Disable HSTS in development
}));

// CORS
app.use(cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session middleware
app.use(session({
	secret: authManager.getSessionSecret(),
	store: new FileStore({
		path: path.join(__dirname, 'sessions'),
		ttl: authManager.getSessionMaxAge() / 1000
	}),
	resave: false,
	saveUninitialized: false,
	cookie: {
		secure: false, // Set to true if using HTTPS
		httpOnly: true,
		maxAge: authManager.getSessionMaxAge()
	}
}));

// Static files for web UI
app.use('/admin', express.static(path.join(__dirname, 'web-ui')));

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
	if (req.session && req.session.userId) {
		req.user = authManager.getUserById(req.session.userId);
		next();
	} else {
		res.status(401).json({ error: 'Unauthorized' });
	}
};

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({ errors: errors.array() });
	}
	next();
};

// ============= Auth Routes =============

/**
 * POST /api/auth/login
 * Login endpoint
 */
app.post('/api/auth/login', [
	body('username').notEmpty().trim(),
	body('password').notEmpty()
], handleValidationErrors, async (req, res) => {
	try {
		const { username, password } = req.body;

		const user = await authManager.authenticate(username, password);

		if (!user) {
			return res.status(401).json({ error: 'Invalid credentials' });
		}

		req.session.userId = user.id;
		req.session.username = user.username;

		res.json({
			message: 'Login successful',
			user: {
				id: user.id,
				username: user.username,
				mustChangePassword: user.mustChangePassword
			}
		});
	} catch (error) {
		console.error('Login error:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

/**
 * POST /api/auth/logout
 * Logout endpoint
 */
app.post('/api/auth/logout', (req, res) => {
	req.session.destroy((err) => {
		if (err) {
			return res.status(500).json({ error: 'Logout failed' });
		}
		res.json({ message: 'Logout successful' });
	});
});

/**
 * GET /api/auth/me
 * Get current user info
 */
app.get('/api/auth/me', requireAuth, (req, res) => {
	res.json({ user: req.user });
});

/**
 * POST /api/auth/change-password
 * Change current admin user's password
 */
app.post('/api/auth/change-password', requireAuth, [
	body('oldPassword').isString().notEmpty(),
	body('newPassword').isString().isLength({ min: 6 })
], handleValidationErrors, async (req, res) => {
	try {
		const user = await authManager.changeOwnPassword(
			req.session.userId,
			req.body.oldPassword,
			req.body.newPassword
		);

		res.json({
			message: 'Password changed successfully',
			user
		});
	} catch (error) {
		const statusCode = error.message === 'Current password is incorrect' ? 400 : 500;
		res.status(statusCode).json({ error: error.message });
	}
});

// ============= Configuration Routes =============

/**
 * GET /api/config
 * Get current configuration
 */
app.get('/api/config', requireAuth, (req, res) => {
	try {
		const config = configLoader.getConfig();
		res.json(config);
	} catch (error) {
		console.error('Error getting config:', error);
		res.status(500).json({ error: 'Failed to get configuration' });
	}
});

/**
 * PUT /api/config
 * Update entire configuration
 */
app.put('/api/config', requireAuth, async (req, res) => {
	try {
		const validation = configValidator.validateConfig(req.body);

		if (!validation.valid) {
			return res.status(400).json({ errors: validation.errors });
		}

		await configLoader.saveConfiguration(req.body, true);
		res.json({ message: 'Configuration updated successfully' });
	} catch (error) {
		console.error('Error updating config:', error);
		res.status(500).json({ error: error.message });
	}
});

// ============= Settings Routes =============

/**
 * GET /api/settings
 * Get settings
 */
app.get('/api/settings', requireAuth, (req, res) => {
	try {
		const settings = configLoader.getSettings();
		res.json(settings);
	} catch (error) {
		console.error('Error getting settings:', error);
		res.status(500).json({ error: 'Failed to get settings' });
	}
});

/**
 * PUT /api/settings
 * Update settings
 */
app.put('/api/settings', requireAuth, [
	body('maxSession').optional().isInt({ min: 0 }),
	body('defaultAuth').optional().isObject(),
	body('defaultAuth.enabled').optional().isBoolean(),
	body('defaultAuth.username').optional().isString(),
	body('defaultAuth.password').optional().isString()
], handleValidationErrors, async (req, res) => {
	try {
		const config = configLoader.getConfig();
		config.settings = { ...config.settings, ...req.body };
		await configLoader.saveConfiguration(config, true);
		res.json({ message: 'Settings updated successfully' });
	} catch (error) {
		console.error('Error updating settings:', error);
		res.status(500).json({ error: error.message });
	}
});

// ============= HTTP Proxy Rules Routes =============

/**
 * GET /api/http-rules
 * Get all HTTP proxy rules
 */
app.get('/api/http-rules', requireAuth, (req, res) => {
	try {
		const config = configLoader.getConfig();
		res.json(config.httpProxyRules || []);
	} catch (error) {
		console.error('Error getting HTTP rules:', error);
		res.status(500).json({ error: 'Failed to get HTTP rules' });
	}
});

/**
 * POST /api/http-rules
 * Create new HTTP proxy rule
 */
app.post('/api/http-rules', requireAuth, [
	body('enabled').isBoolean(),
	body('protocol').isIn(['http:', 'https:']),
	body('domain').optional().isString(),
	body('path').isString().notEmpty(),
	body('targetHost').isString().notEmpty(),
	body('targetPort').isInt({ min: 1, max: 65535 }),
	body('pretendMode').isBoolean(),
	body('priority').isInt({ min: 1 })
], handleValidationErrors, async (req, res) => {
	try {
		const config = configLoader.getConfig();
		if (!config.httpProxyRules) {
			config.httpProxyRules = [];
		}

		const newRule = {
			id: `http-rule-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
			...req.body
		};

		config.httpProxyRules.push(newRule);
		await configLoader.saveConfiguration(config, true);

		res.status(201).json(newRule);
	} catch (error) {
		console.error('Error creating HTTP rule:', error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * PUT /api/http-rules/:id
 * Update HTTP proxy rule
 */
app.put('/api/http-rules/:id', requireAuth, [
	param('id').isString(),
	body('enabled').optional().isBoolean(),
	body('protocol').optional().isIn(['http:', 'https:']),
	body('domain').optional().isString(),
	body('path').optional().isString(),
	body('targetHost').optional().isString(),
	body('targetPort').optional().isInt({ min: 1, max: 65535 }),
	body('pretendMode').optional().isBoolean(),
	body('priority').optional().isInt({ min: 1 })
], handleValidationErrors, async (req, res) => {
	try {
		const config = configLoader.getConfig();
		const ruleIndex = config.httpProxyRules.findIndex(r => r.id === req.params.id);

		if (ruleIndex === -1) {
			return res.status(404).json({ error: 'Rule not found' });
		}

		config.httpProxyRules[ruleIndex] = {
			...config.httpProxyRules[ruleIndex],
			...req.body,
			id: req.params.id // Preserve ID
		};

		await configLoader.saveConfiguration(config, true);
		res.json(config.httpProxyRules[ruleIndex]);
	} catch (error) {
		console.error('Error updating HTTP rule:', error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * DELETE /api/http-rules/:id
 * Delete HTTP proxy rule
 */
app.delete('/api/http-rules/:id', requireAuth, [
	param('id').isString()
], handleValidationErrors, async (req, res) => {
	try {
		const config = configLoader.getConfig();
		const ruleIndex = config.httpProxyRules.findIndex(r => r.id === req.params.id);

		if (ruleIndex === -1) {
			return res.status(404).json({ error: 'Rule not found' });
		}

		config.httpProxyRules.splice(ruleIndex, 1);
		await configLoader.saveConfiguration(config, true);

		res.json({ message: 'Rule deleted successfully' });
	} catch (error) {
		console.error('Error deleting HTTP rule:', error);
		res.status(500).json({ error: error.message });
	}
});

// ============= WebSocket Proxy Rules Routes =============

/**
 * GET /api/ws-rules
 * Get all WebSocket proxy rules
 */
app.get('/api/ws-rules', requireAuth, (req, res) => {
	try {
		const config = configLoader.getConfig();
		res.json(config.wsProxyRules || []);
	} catch (error) {
		console.error('Error getting WS rules:', error);
		res.status(500).json({ error: 'Failed to get WS rules' });
	}
});

/**
 * POST /api/ws-rules
 * Create new WebSocket proxy rule
 */
app.post('/api/ws-rules', requireAuth, [
	body('enabled').isBoolean(),
	body('protocol').isIn(['ws:', 'wss:']),
	body('domain').optional().isString(),
	body('path').isString().notEmpty(),
	body('targetHost').isString().notEmpty(),
	body('targetPort').isInt({ min: 1, max: 65535 }),
	body('pretendMode').isBoolean(),
	body('priority').isInt({ min: 1 })
], handleValidationErrors, async (req, res) => {
	try {
		const config = configLoader.getConfig();
		if (!config.wsProxyRules) {
			config.wsProxyRules = [];
		}

		const newRule = {
			id: `ws-rule-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
			...req.body
		};

		config.wsProxyRules.push(newRule);
		await configLoader.saveConfiguration(config, true);

		res.status(201).json(newRule);
	} catch (error) {
		console.error('Error creating WS rule:', error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * PUT /api/ws-rules/:id
 * Update WebSocket proxy rule
 */
app.put('/api/ws-rules/:id', requireAuth, [
	param('id').isString(),
	body('enabled').optional().isBoolean(),
	body('protocol').optional().isIn(['ws:', 'wss:']),
	body('domain').optional().isString(),
	body('path').optional().isString(),
	body('targetHost').optional().isString(),
	body('targetPort').optional().isInt({ min: 1, max: 65535 }),
	body('pretendMode').optional().isBoolean(),
	body('priority').optional().isInt({ min: 1 })
], handleValidationErrors, async (req, res) => {
	try {
		const config = configLoader.getConfig();
		const ruleIndex = config.wsProxyRules.findIndex(r => r.id === req.params.id);

		if (ruleIndex === -1) {
			return res.status(404).json({ error: 'Rule not found' });
		}

		config.wsProxyRules[ruleIndex] = {
			...config.wsProxyRules[ruleIndex],
			...req.body,
			id: req.params.id // Preserve ID
		};

		await configLoader.saveConfiguration(config, true);
		res.json(config.wsProxyRules[ruleIndex]);
	} catch (error) {
		console.error('Error updating WS rule:', error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * DELETE /api/ws-rules/:id
 * Delete WebSocket proxy rule
 */
app.delete('/api/ws-rules/:id', requireAuth, [
	param('id').isString()
], handleValidationErrors, async (req, res) => {
	try {
		const config = configLoader.getConfig();
		const ruleIndex = config.wsProxyRules.findIndex(r => r.id === req.params.id);

		if (ruleIndex === -1) {
			return res.status(404).json({ error: 'Rule not found' });
		}

		config.wsProxyRules.splice(ruleIndex, 1);
		await configLoader.saveConfiguration(config, true);

		res.json({ message: 'Rule deleted successfully' });
	} catch (error) {
		console.error('Error deleting WS rule:', error);
		res.status(500).json({ error: error.message });
	}
});

// ============= SSL Certificates Routes =============

/**
 * GET /api/certificates
 * Get all SSL certificates
 */
app.get('/api/certificates', requireAuth, (req, res) => {
	try {
		const config = configLoader.getConfig();
		const certs = config.sslCertificates || [];

		// Add certificate expiry info
		const certsWithInfo = certs.map(cert => {
			try {
				const certPath = path.join(__dirname, cert.certFile);
				if (fs.existsSync(certPath)) {
					const certData = fs.readFileSync(certPath, 'utf-8');
					// Simple parsing to get expiry date
					const match = certData.match(/notAfter=([^\\]+)/);
					if (match) {
						return {
							...cert,
							expiresAt: match[1]
						};
					}
				}
			} catch (error) {
				console.error('Error reading certificate:', error);
			}
			return cert;
		});

		res.json(certsWithInfo);
	} catch (error) {
		console.error('Error getting certificates:', error);
		res.status(500).json({ error: 'Failed to get certificates' });
	}
});

/**
 * POST /api/certificates
 * Upload SSL certificate
 */
app.post('/api/certificates', requireAuth, upload.fields([
	{ name: 'cert', maxCount: 1 },
	{ name: 'key', maxCount: 1 }
]), [
	body('domain').isString().notEmpty()
], handleValidationErrors, async (req, res) => {
	try {
		const { domain } = req.body;
		const certFile = req.files && req.files.cert ? req.files.cert[0] : null;
		const keyFile = req.files && req.files.key ? req.files.key[0] : null;

		if (!certFile || !keyFile) {
			return res.status(400).json({ error: 'Certificate and key files are required' });
		}

		// Validate file types
		if (!certFile.originalname.endsWith('.crt') && !certFile.originalname.endsWith('.pem')) {
			return res.status(400).json({ error: 'Invalid certificate file' });
		}

		if (!keyFile.originalname.endsWith('.key') && !keyFile.originalname.endsWith('.pem')) {
			return res.status(400).json({ error: 'Invalid key file' });
		}

		// Save files
		const certDir = path.join(__dirname, 'cert');
		if (!fs.existsSync(certDir)) {
			fs.mkdirSync(certDir, { recursive: true });
		}

		const certFileName = `${domain}_chain.crt`;
		const keyFileName = `${domain}_key.key`;
		const certFilePath = path.join(certDir, certFileName);
		const keyFilePath = path.join(certDir, keyFileName);

		fs.writeFileSync(certFilePath, certFile.buffer);
		fs.writeFileSync(keyFilePath, keyFile.buffer);

		// Update configuration
		const config = configLoader.getConfig();
		if (!config.sslCertificates) {
			config.sslCertificates = [];
		}

		// Remove existing cert for domain if exists
		config.sslCertificates = config.sslCertificates.filter(c => c.domain !== domain);

		// Add new certificate
		config.sslCertificates.push({
			domain,
			certFile: `cert/${certFileName}`,
			keyFile: `cert/${keyFileName}`,
			expiresAt: null
		});

		await configLoader.saveConfiguration(config, true);

		res.status(201).json({
			message: 'Certificate uploaded successfully',
			certificate: {
				domain,
				certFile: `cert/${certFileName}`,
				keyFile: `cert/${keyFileName}`
			}
		});
	} catch (error) {
		console.error('Error uploading certificate:', error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * DELETE /api/certificates/:domain
 * Delete SSL certificate
 */
app.delete('/api/certificates/:domain', requireAuth, [
	param('domain').isString()
], handleValidationErrors, async (req, res) => {
	try {
		const config = configLoader.getConfig();
		const certIndex = config.sslCertificates.findIndex(c => c.domain === req.params.domain);

		if (certIndex === -1) {
			return res.status(404).json({ error: 'Certificate not found' });
		}

		const cert = config.sslCertificates[certIndex];

		// Delete files
		const certPath = path.join(__dirname, cert.certFile);
		const keyPath = path.join(__dirname, cert.keyFile);

		if (fs.existsSync(certPath)) {
			fs.unlinkSync(certPath);
		}

		if (fs.existsSync(keyPath)) {
			fs.unlinkSync(keyPath);
		}

		// Remove from configuration
		config.sslCertificates.splice(certIndex, 1);
		await configLoader.saveConfiguration(config, true);

		res.json({ message: 'Certificate deleted successfully' });
	} catch (error) {
		console.error('Error deleting certificate:', error);
		res.status(500).json({ error: error.message });
	}
});

// ============= Backup Routes =============

/**
 * GET /api/backups
 * Get list of backups
 */
app.get('/api/backups', requireAuth, (req, res) => {
	try {
		const backups = configLoader.getBackups();
		res.json(backups);
	} catch (error) {
		console.error('Error getting backups:', error);
		res.status(500).json({ error: 'Failed to get backups' });
	}
});

/**
 * POST /api/backups
 * Create manual backup
 */
app.post('/api/backups', requireAuth, async (req, res) => {
	try {
		await configLoader.createBackup();
		res.json({ message: 'Backup created successfully' });
	} catch (error) {
		console.error('Error creating backup:', error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * POST /api/backups/:name/restore
 * Restore from backup
 */
app.post('/api/backups/:name/restore', requireAuth, [
	param('name').isString()
], handleValidationErrors, async (req, res) => {
	try {
		await configLoader.restoreFromBackup(req.params.name);
		res.json({ message: 'Backup restored successfully' });
	} catch (error) {
		console.error('Error restoring backup:', error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * DELETE /api/backups/:name
 * Delete backup
 */
app.delete('/api/backups/:name', requireAuth, [
	param('name').isString()
], handleValidationErrors, async (req, res) => {
	try {
		const backupPath = path.join(__dirname, 'backups', req.params.name);
		if (!fs.existsSync(backupPath)) {
			return res.status(404).json({ error: 'Backup not found' });
		}

		fs.unlinkSync(backupPath);
		res.json({ message: 'Backup deleted successfully' });
	} catch (error) {
		console.error('Error deleting backup:', error);
		res.status(500).json({ error: error.message });
	}
});

// ============= User Management Routes =============

/**
 * GET /api/users
 * Get all proxy users (from users_list.json)
 */
app.get('/api/users', requireAuth, (req, res) => {
	try {
		const usersPath = path.join(__dirname, 'users_list.json');

		if (!fs.existsSync(usersPath)) {
			return res.json([]);
		}

		const data = fs.readFileSync(usersPath, 'utf-8');
		const usersList = JSON.parse(data);

		// Convert to array format
		const result = [];
		Object.entries(usersList).forEach(([host, creds]) => {
			if (creds && typeof creds === 'object' && !Array.isArray(creds)) {
				Object.entries(creds).forEach(([username, passwordHash]) => {
					result.push({
						host,
						username,
						passwordHash
					});
				});
			}
		});

		res.json(result);
	} catch (error) {
		console.error('Error getting users:', error);
		res.status(500).json({ error: 'Failed to get users' });
	}
});

// ============= ACME Routes =============

/**
 * GET /api/acme/status
 * Get ACME availability and DNS provider metadata
 */
app.get('/api/acme/status', requireAuth, (req, res) => {
	res.json({
		available: acmeManager.isAvailable(),
		providers: acmeManager.getProviders(),
		defaultServer: acmeManager.getDefaultServer()
	});
});

/**
 * GET /api/acme/certs
 * List ACME-managed certificate info from current proxy config
 */
app.get('/api/acme/certs', requireAuth, async (req, res) => {
	try {
		res.json(await acmeManager.listCerts());
	} catch (error) {
		console.error('Error listing ACME certificates:', error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * POST /api/acme/issue
 * Issue a certificate through acme.sh DNS validation
 */
app.post('/api/acme/issue', requireAuth, [
	body('domain').isString().notEmpty(),
	body('dnsProvider').isString().notEmpty(),
	body('server').optional({ nullable: true, checkFalsy: true }).isString(),
	body('credentials').optional().isObject()
], handleValidationErrors, async (req, res) => {
	try {
		const result = await acmeManager.issue(req.body.domain, {
			dnsProvider: req.body.dnsProvider,
			server: req.body.server,
			credentials: req.body.credentials || {}
		});

		res.status(201).json({
			message: 'Certificate issued successfully',
			...result
		});
	} catch (error) {
		console.error('Error issuing ACME certificate:', error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * POST /api/acme/:domain/renew
 * Renew a certificate through acme.sh
 */
app.post('/api/acme/:domain/renew', requireAuth, [
	param('domain').isString().notEmpty()
], handleValidationErrors, async (req, res) => {
	try {
		const result = await acmeManager.renew(req.params.domain);
		res.json({
			message: 'Certificate renewed successfully',
			...result
		});
	} catch (error) {
		console.error('Error renewing ACME certificate:', error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * POST /api/users
 * Create new proxy user
 */
app.post('/api/users', requireAuth, [
	body('host').isString().notEmpty(),
	body('username').isString().notEmpty(),
	body('password').isString().notEmpty().isLength({ min: 1 })
], handleValidationErrors, async (req, res) => {
	try {
		const { host, username, password } = req.body;

		// Hash password with MD5 (for compatibility with existing proxy)
		const md5 = crypto.createHash('md5');
		md5.update(password);
		const passwordHash = md5.digest('hex');

		// Read users_list.json
		const usersPath = path.join(__dirname, 'users_list.json');
		let usersList = {};

		if (fs.existsSync(usersPath)) {
			const data = fs.readFileSync(usersPath, 'utf-8');
			usersList = JSON.parse(data);
		}

		// Add user
		if (!usersList[host]) {
			usersList[host] = {};
		}

		usersList[host][username] = passwordHash;

		// Save
		fs.writeFileSync(usersPath, JSON.stringify(usersList, null, 2), 'utf-8');

		res.status(201).json({
			message: 'User created successfully',
			user: {
				host,
				username,
				passwordHash
			}
		});
	} catch (error) {
		console.error('Error creating user:', error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * DELETE /api/users/:host/:username
 * Delete proxy user
 */
app.delete('/api/users/:host/:username', requireAuth, [
	param('host').isString(),
	param('username').isString()
], handleValidationErrors, async (req, res) => {
	try {
		const { host, username } = req.params;

		// Read users_list.json
		const usersPath = path.join(__dirname, 'users_list.json');

		if (!fs.existsSync(usersPath)) {
			return res.status(404).json({ error: 'Users file not found' });
		}

		const data = fs.readFileSync(usersPath, 'utf-8');
		const usersList = JSON.parse(data);

		// Check if user exists
		if (!usersList[host] || !usersList[host][username]) {
			return res.status(404).json({ error: 'User not found' });
		}

		// Delete user
		delete usersList[host][username];

		// Clean up empty host objects
		if (Object.keys(usersList[host]).length === 0) {
			delete usersList[host];
		}

		// Save
		fs.writeFileSync(usersPath, JSON.stringify(usersList, null, 2), 'utf-8');

		res.json({ message: 'User deleted successfully' });
	} catch (error) {
		console.error('Error deleting user:', error);
		res.status(500).json({ error: error.message });
	}
});

// ============= Admin User Management Routes =============

/**
 * GET /api/admin/users
 * Get all admin users
 */
app.get('/api/admin/users', requireAuth, (req, res) => {
	try {
		const users = authManager.getAllUsers();
		res.json(users);
	} catch (error) {
		console.error('Error getting admin users:', error);
		res.status(500).json({ error: 'Failed to get admin users' });
	}
});

/**
 * POST /api/admin/users
 * Create new admin user
 */
app.post('/api/admin/users', requireAuth, [
	body('username').isString().notEmpty().isLength({ min: 3 }),
	body('password').isString().notEmpty().isLength({ min: 6 })
], handleValidationErrors, async (req, res) => {
	try {
		const { username, password } = req.body;
		const user = await authManager.createUser(username, password);
		res.status(201).json(user);
	} catch (error) {
		console.error('Error creating admin user:', error);
		res.status(400).json({ error: error.message });
	}
});

/**
 * PUT /api/admin/users/:id/password
 * Change admin user password
 */
app.put('/api/admin/users/:id/password', requireAuth, [
	param('id').isString(),
	body('newPassword').isString().notEmpty().isLength({ min: 6 })
], handleValidationErrors, async (req, res) => {
	try {
		const { id } = req.params;
		const { newPassword } = req.body;
		const success = await authManager.updateUserPassword(id, newPassword);

		if (!success) {
			return res.status(404).json({ error: 'User not found' });
		}

		res.json({ message: 'Password updated successfully' });
	} catch (error) {
		console.error('Error updating password:', error);
		res.status(400).json({ error: error.message });
	}
});

/**
 * DELETE /api/admin/users/:id
 * Delete admin user
 */
app.delete('/api/admin/users/:id', requireAuth, [
	param('id').isString()
], handleValidationErrors, async (req, res) => {
	try {
		const { id } = req.params;
		const success = await authManager.deleteUser(id);

		if (!success) {
			return res.status(404).json({ error: 'User not found' });
		}

		res.json({ message: 'User deleted successfully' });
	} catch (error) {
		console.error('Error deleting admin user:', error);
		res.status(400).json({ error: error.message });
	}
});

// ============= Status/Health Routes =============

/**
 * GET /api/status
 * Get system status
 */
app.get('/api/status', requireAuth, (req, res) => {
	try {
		const config = configLoader.getConfig();

		res.json({
			uptime: process.uptime(),
			memory: process.memoryUsage(),
			version: config.version,
			lastModified: config.lastModified,
			httpRulesCount: config.httpProxyRules ? config.httpProxyRules.length : 0,
			wsRulesCount: config.wsProxyRules ? config.wsProxyRules.length : 0,
			certificatesCount: config.sslCertificates ? config.sslCertificates.length : 0
		});
	} catch (error) {
		console.error('Error getting status:', error);
		res.status(500).json({ error: 'Failed to get status' });
	}
});

// ============= Error Handlers =============

// 404 handler
app.use((req, res) => {
	res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
	console.error('Unhandled error:', err);
	res.status(500).json({ error: 'Internal server error' });
});

// ============= Server Startup =============

async function startServer() {
	try {
		// Initialize configuration loader
		console.log('🔧 Initializing configuration loader...');
		await configLoader.initialize();
		console.log('✅ Configuration loader initialized');

		// Try to create HTTPS server with existing certificates
		let server;
		const certDir = path.join(__dirname, 'cert');

		// Force HTTP mode if ADMIN_HTTP_MODE is set
		const forceHttpMode = process.env.ADMIN_HTTP_MODE === 'true';
		const findHttpsCertificate = () => {
			if (!fs.existsSync(certDir)) {
				return null;
			}

			const domainName = process.env.DOMAIN_NAME;
			if (domainName) {
				const cert = path.join(certDir, `${domainName}_chain.crt`);
				const key = path.join(certDir, `${domainName}_key.key`);
				if (fs.existsSync(cert) && fs.existsSync(key)) {
					return { cert, key, domain: domainName };
				}
			}

			const files = fs.readdirSync(certDir);
			const certFile = files.find(file => {
				if (!file.endsWith('_chain.crt')) {
					return false;
				}
				const domain = file.replace('_chain.crt', '');
				return fs.existsSync(path.join(certDir, `${domain}_key.key`));
			});

			if (!certFile) {
				return null;
			}

			const domain = certFile.replace('_chain.crt', '');
			return {
				cert: path.join(certDir, certFile),
				key: path.join(certDir, `${domain}_key.key`),
				domain
			};
		};

		const httpsCertificate = findHttpsCertificate();
		if (!forceHttpMode && httpsCertificate) {
			const httpsOptions = {
				key: fs.readFileSync(httpsCertificate.key),
				cert: fs.readFileSync(httpsCertificate.cert)
			};

			server = https.createServer(httpsOptions, app);
			console.log(`🔒 HTTPS server enabled with certificate for ${httpsCertificate.domain}`);
		} else {
			// Fallback to HTTP for development
			server = app;
			console.log('⚠️  Running in HTTP mode (certificates not found)');
		}

		// Start listening
		server.listen(PORT, '0.0.0.0', () => {
			console.log('');
			console.log('╔══════════════════════════════════════════════════════════╗');
			console.log('║         HTTP/HTTPS Reverse Proxy Admin API               ║');
			console.log('╚══════════════════════════════════════════════════════════╝');
			console.log('');
			console.log(`🚀 Admin API server listening on port ${PORT}`);
			console.log(`🌐 Web UI: http://localhost:${PORT}/admin/`);
			console.log(`📚 API: http://localhost:${PORT}/api/`);
			console.log('');
			console.log('⚠️  Default admin credentials: admin / admin123');
			console.log('⚠️  Please change the default password immediately!');
			console.log('');
		});

	} catch (error) {
		console.error('⛔ Failed to start server:', error);
		process.exit(1);
	}
}

// Start the server
startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
	console.log('🛑 Received SIGTERM, shutting down gracefully...');
	configLoader.stopWatching();
	process.exit(0);
});

process.on('SIGINT', () => {
	console.log('🛑 Received SIGINT, shutting down gracefully...');
	configLoader.stopWatching();
	process.exit(0);
});
