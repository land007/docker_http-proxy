/**
 * Proxy Configuration Loader
 * Loads and manages proxy configuration with hot-reload support
 */

const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const crypto = require('crypto');
const chokidar = require('chokidar');
const configValidator = require('./config-validator');
const dataPaths = require('./data-paths');

const { CONFIG_PATH, BACKUP_DIR, IMPORTED_MARKER } = dataPaths;
const RELOAD_DEBOUNCE_MS = 500;


/**
 * Generate a secure random password (16 characters, base64url encoded)
 * @returns {string} - Generated password
 */
function generateSecurePassword() {
	return crypto.randomBytes(12).toString('base64url');
}

class ProxyConfigLoader {
	constructor() {
		this.config = null;
		this.reloadCallbacks = [];
		this.isReloading = false;
		this.reloadTimeout = null;
		this.watcher = null;
		this.configPath = CONFIG_PATH;

		// Ensure backup directory exists
		this.ensureBackupDir();
	}

	/**
	 * Initialize the configuration loader
	 * @returns {Promise<Object>} - Initial configuration
	 */
	async initialize() {
		// Check if config file exists, if not, migrate from environment variables
		if (!fs.existsSync(CONFIG_PATH)) {
			console.log('📋 proxy-config.json not found, migrating from environment variables...');
			await this.migrateFromEnv();
		}

		// Load initial configuration
		await this.loadConfiguration();

		await this.importFromEnvOnce();

		// Start watching for changes
		this.startWatching();

		return this.config;
	}

	/**
	 * Load configuration from file
	 * @returns {Promise<Object>} - Loaded configuration
	 */
	async loadConfiguration() {
		try {
			const fileContent = await fsPromises.readFile(CONFIG_PATH, 'utf8');
			this.config = JSON.parse(fileContent);
			return this.config;
		} catch (error) {
			console.error('Failed to load configuration:', error);
			this.config = {
				version: '1.0',
				lastModified: new Date().toISOString(),
				settings: {},
				httpProxyRules: [],
				wsProxyRules: [],
				sslCertificates: []
			};
			return this.config;
		}
	}

	/**
	 * Save configuration to file
	 * @returns {Promise<void>}
	 */
	async saveConfiguration() {
		try {
			this.config.lastModified = new Date().toISOString();
			await fsPromises.writeFile(CONFIG_PATH, JSON.stringify(this.config, null, 2));
			console.log('Configuration saved successfully');
		} catch (error) {
			console.error('Failed to save configuration:', error);
			throw error;
		}
	}

	/**
	 * Get settings
	 * @returns {Promise<Object>} - Settings object
	 */
	async getSettings() {
		if (!this.config || !this.config.settings) {
			const generatedPassword = generateSecurePassword();
			const generatedUsername = 'proxy-user';

			console.log('🔐 Generated random password for default authentication:');
			console.log(`   Username: ${generatedUsername}`);
			console.log(`   Password: ${generatedPassword}`);
			console.log('   These credentials have been saved to the config file.');

			const newSettings = {
				maxSession: 0,
				defaultAuth: {
					enabled: true,
					username: generatedUsername,
					password: generatedPassword
				}
			};

			// Persist to config file
			try {
				const configPath = this.configPath || CONFIG_PATH;
				const configData = {
					version: '1.0',
					lastModified: new Date().toISOString(),
					settings: newSettings,
					httpProxyRules: [],
					wsProxyRules: [],
					sslCertificates: []
				};
				await fsPromises.writeFile(configPath, JSON.stringify(configData, null, 2));
				console.log(`   Config file updated: ${configPath}`);
			} catch (error) {
				console.error('   ⚠️  Failed to save config file:', error.message);
			}

			return newSettings;
		}

		return this.config.settings;
	}

	/**
	 * Get SSL certificates
	 * @returns {Array} - Array of SSL certificate configurations
	 */
	getSslCertificates() {
		if (!this.config || !this.config.sslCertificates) {
			return [];
		}

		return this.config.sslCertificates;
	}

	/**
	 * Get HTTP proxy rules
	 * @returns {Array} - Array of HTTP proxy rules
	 */
	getHttpProxyRules() {
		if (!this.config || !this.config.httpProxyRules) {
			return [];
		}

		return this.config.httpProxyRules;
	}

	/**
	 * Get WebSocket proxy rules
	 * @returns {Array} - Array of WebSocket proxy rules
	 */
	getWsProxyRules() {
		if (!this.config || !this.config.wsProxyRules) {
			return [];
		}

		return this.config.wsProxyRules;
	}

	/**
	 * Update HTTP proxy rules
	 * @param {Array} rules - New HTTP proxy rules
	 * @returns {Promise<void>}
	 */
	async updateHttpProxyRules(rules) {
		if (!this.config) {
			this.config = await this.loadConfiguration();
		}
		this.config.httpProxyRules = rules;
		await this.saveConfiguration();
	}

	/**
	 * Update WebSocket proxy rules
	 * @param {Array} rules - New WebSocket proxy rules
	 * @returns {Promise<void>}
	 */
	async updateWsProxyRules(rules) {
		if (!this.config) {
			this.config = await this.loadConfiguration();
		}
		this.config.wsProxyRules = rules;
		await this.saveConfiguration();
	}

	/**
	 * Update SSL certificates
	 * @param {Array} certs - New SSL certificates
	 * @returns {Promise<void>}
	 */
	async updateSslCertificates(certs) {
		if (!this.config) {
			this.config = await this.loadConfiguration();
		}
		this.config.sslCertificates = certs;
		await this.saveConfiguration();
	}

	/**
	 * Update settings
	 * @param {Object} settings - New settings
	 * @returns {Promise<void>}
	 */
	async updateSettings(settings) {
		if (!this.config) {
			this.config = await this.loadConfiguration();
		}
		this.config.settings = settings;
		await this.saveConfiguration();
	}

	/**
	 * Ensure backup directory exists
	 */
	ensureBackupDir() {
		if (!fs.existsSync(BACKUP_DIR)) {
			fs.mkdirSync(BACKUP_DIR, { recursive: true });
		}
	}

	/**
	 * Create backup of current configuration
	 * @returns {Promise<string>} - Path to backup file
	 */
	async createBackup() {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const backupPath = path.join(BACKUP_DIR, `proxy-config-${timestamp}.json`);

		try {
			await fsPromises.copyFile(CONFIG_PATH, backupPath);
			console.log(`Backup created: ${backupPath}`);
			return backupPath;
		} catch (error) {
			console.error('Failed to create backup:', error);
			throw error;
		}
	}

	/**
	 * Parse environment variable list
	 * @param {string} name - Environment variable name
	 * @returns {Array} - Parsed array
	 */
	parseEnvList(name) {
		if (!process.env[name]) {
			return [];
		}
		return process.env[name]
			.replace(/\\/g, '')
			.split(',')
			.map(s => s.trim());
	}

	/**
	 * Build proxy rules from environment variables
	 * @returns {Object} - Object with httpProxyRules and wsProxyRules arrays
	 */
	buildRulesFromEnv() {
		const http_proxy_protocols = this.parseEnvList('http_proxy_protocols');
		const http_proxy_domains = this.parseEnvList('http_proxy_domains');
		const http_proxy_paths = this.parseEnvList('http_proxy_paths');
		const http_proxy_hosts = this.parseEnvList('http_proxy_hosts');
		const http_proxy_ports = this.parseEnvList('http_proxy_ports');
		const http_proxy_pretends = this.parseEnvList('http_proxy_pretends');
		const http_proxy_redirects = this.parseEnvList('http_proxy_redirects');

		const ws_proxy_protocols = this.parseEnvList('ws_proxy_protocols');
		const ws_proxy_domains = this.parseEnvList('ws_proxy_domains');
		const ws_proxy_paths = this.parseEnvList('ws_proxy_paths');
		const ws_proxy_hosts = this.parseEnvList('ws_proxy_hosts');
		const ws_proxy_ports = this.parseEnvList('ws_proxy_ports');
		const ws_proxy_pretends = this.parseEnvList('ws_proxy_pretends');

		const now = Date.now();
		const httpProxyRules = [];
		const wsProxyRules = [];

		for (let i = 0; i < http_proxy_paths.length; i++) {
			if (http_proxy_paths[i]) {
				httpProxyRules.push({
					id: `http-rule-${now}-${i}`,
					enabled: true,
					protocol: http_proxy_protocols[i] || 'http:',
					domain: http_proxy_domains[i] || '',
					path: http_proxy_paths[i],
					targetHost: http_proxy_hosts[i] || 'localhost',
					targetPort: parseInt(http_proxy_ports[i]) || 80,
					pretendMode: http_proxy_pretends[i] === 'true',
					redirectToHttps: http_proxy_redirects[i] === 'true',
					priority: i + 1,
					users: {}
				});
			}
		}

		for (let i = 0; i < ws_proxy_paths.length; i++) {
			if (ws_proxy_paths[i]) {
				wsProxyRules.push({
					id: `ws-rule-${now}-${i}`,
					enabled: true,
					protocol: ws_proxy_protocols[i] || 'ws:',
					domain: ws_proxy_domains[i] || '',
					path: ws_proxy_paths[i],
					targetHost: ws_proxy_hosts[i] || 'localhost',
					targetPort: parseInt(ws_proxy_ports[i]) || 80,
					pretendMode: ws_proxy_pretends[i] === 'true',
					priority: i + 1,
					users: {}
				});
			}
		}

		return { httpProxyRules, wsProxyRules };
	}

	/**
	 * Migrate configuration from environment variables
	 * @returns {Promise<void>}
	 */
	async migrateFromEnv() {
		const { httpProxyRules, wsProxyRules } = this.buildRulesFromEnv();

		if (httpProxyRules.length === 0 && wsProxyRules.length === 0) {
			console.log('No proxy rules found in environment variables');
			return;
		}

		const config = {
			version: '1.0',
			lastModified: new Date().toISOString(),
			settings: {
				maxSession: parseInt(process.env.maxSession) || 0,
				defaultAuth: {
					enabled: true,
					username: process.env.username || 'proxy-user',
					password: process.env.password || ''
				}
			},
			httpProxyRules,
			wsProxyRules,
			sslCertificates: []
		};

		await fsPromises.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
		console.log(`Configuration migrated from environment variables to ${CONFIG_PATH}`);
	}

	/**
	 * Import from environment variables once (marked by IMPORTED_MARKER)
	 * @returns {Promise<void>}
	 */
	async importFromEnvOnce() {
		if (fs.existsSync(IMPORTED_MARKER)) {
			return;
		}

		try {
			const empty = !(this.config.httpProxyRules && this.config.httpProxyRules.length) &&
				!(this.config.wsProxyRules && this.config.wsProxyRules.length);
			if (empty) {
				const { httpProxyRules, wsProxyRules } = this.buildRulesFromEnv();

				if (httpProxyRules.length > 0 || wsProxyRules.length > 0) {
					this.config.httpProxyRules = httpProxyRules;
					this.config.wsProxyRules = wsProxyRules;
					await this.saveConfiguration();

					// Create marker file
					await fsPromises.writeFile(IMPORTED_MARKER, Date.now().toString());
					console.log('Configuration imported from environment variables');
				}
			}
		} catch (error) {
			console.error('Failed to import from environment:', error);
		}
	}

	/**
	 * Start watching configuration file for changes
	 */
	startWatching() {
		if (this.watcher) {
			return;
		}

		this.watcher = chokidar.watch(CONFIG_PATH, {
			persistent: true,
			ignoreInitial: true
		});

		this.watcher.on('change', () => {
			this.handleConfigChange();
		});
	}

	/**
	 * Handle configuration file change
	 */
	async handleConfigChange() {
		if (this.isReloading) {
			if (this.reloadTimeout) {
				clearTimeout(this.reloadTimeout);
			}
			this.reloadTimeout = setTimeout(() => this.handleConfigChange(), RELOAD_DEBOUNCE_MS);
			return;
		}

		this.isReloading = true;

		try {
			const oldConfig = this.config;
			await this.loadConfiguration();

			for (const callback of this.reloadCallbacks) {
				try {
					await callback(this.config, oldConfig);
				} catch (error) {
					console.error('Error in reload callback:', error);
				}
			}

			console.log('Configuration reloaded successfully');
		} catch (error) {
			console.error('Failed to reload configuration:', error);
		} finally {
			this.isReloading = false;
			this.reloadTimeout = null;
		}
	}

	/**
	 * Register callback for configuration reloads
	 * @param {Function} callback - Callback function
	 */
	onReload(callback) {
		this.reloadCallbacks.push(callback);
	}

	/**
	 * Stop watching configuration file
	 */
	stopWatching() {
		if (this.watcher) {
			this.watcher.close();
			this.watcher = null;
		}
	}
}

module.exports = ProxyConfigLoader;
