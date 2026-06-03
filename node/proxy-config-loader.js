/**
 * Proxy Configuration Loader
 * Loads and manages proxy configuration with hot-reload support
 */

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const configValidator = require('./config-validator');

const CONFIG_PATH = path.join(__dirname, 'proxy-config.json');
const BACKUP_DIR = path.join(__dirname, 'backups');
const IMPORTED_MARKER = path.join(__dirname, '.env-imported');
const RELOAD_DEBOUNCE_MS = 500;

class ProxyConfigLoader {
	constructor() {
		this.config = null;
		this.reloadCallbacks = [];
		this.isReloading = false;
		this.reloadTimeout = null;
		this.watcher = null;

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
	 */
	async loadConfiguration() {
		try {
			const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
			const newConfig = JSON.parse(data);

			// Validate configuration
			const validation = configValidator.validateConfig(newConfig);

			if (!validation.valid) {
				console.error('⛔ Configuration validation failed:');
				validation.errors.forEach(error => console.error(`  - ${error}`));

				// If we have an existing valid config, keep using it
				if (this.config) {
					console.log('⚠️  Continuing with previous valid configuration');
					return this.config;
				} else {
					throw new Error('Invalid configuration and no previous config to fall back to');
				}
			}

			console.log('✅ Configuration loaded successfully');
			this.config = newConfig;

			return this.config;
		} catch (error) {
			console.error('⛔ Error loading configuration:', error.message);

			// If we have an existing config, keep using it
			if (this.config) {
				console.log('⚠️  Continuing with previous valid configuration');
				return this.config;
			}

			throw error;
		}
	}

	/**
	 * Start watching configuration file for changes
	 */
	startWatching() {
		if (this.watcher) {
			return; // Already watching
		}

		console.log('👁️  Starting configuration file watcher...');

		this.watcher = chokidar.watch(CONFIG_PATH, {
			persistent: true,
			ignoreInitial: true
		});

		this.watcher.on('change', () => {
			this.scheduleReload();
		});

		this.watcher.on('error', (error) => {
			console.error('⛔ Config file watcher error:', error);
		});
	}

	/**
	 * Stop watching configuration file
	 */
	stopWatching() {
		if (this.watcher) {
			this.watcher.close();
			this.watcher = null;
			console.log('👁️  Configuration file watcher stopped');
		}
	}

	/**
	 * Schedule a configuration reload with debouncing
	 */
	scheduleReload() {
		if (this.reloadTimeout) {
			clearTimeout(this.reloadTimeout);
		}

		this.reloadTimeout = setTimeout(() => {
			this.performReload();
		}, RELOAD_DEBOUNCE_MS);
	}

	/**
	 * Perform configuration reload
	 */
	async performReload() {
		if (this.isReloading) {
			console.log('⏳ Reload already in progress, skipping...');
			return;
		}

		this.isReloading = true;
		console.log('🔄 Configuration file changed, reloading...');

		try {
			const oldConfig = this.config;
			const newConfig = await this.loadConfiguration();

			// Check if configuration actually changed
			if (JSON.stringify(oldConfig) === JSON.stringify(newConfig)) {
				console.log('ℹ️  Configuration unchanged, skipping reload');
				return;
			}

			console.log('✅ Configuration reloaded successfully');

			// Notify all registered callbacks
			this.reloadCallbacks.forEach(callback => {
				try {
					callback(newConfig, oldConfig);
				} catch (error) {
					console.error('⛔ Error in reload callback:', error);
				}
			});
		} catch (error) {
			console.error('⛔ Error during configuration reload:', error);
		} finally {
			this.isReloading = false;
		}
	}

	/**
	 * Register a callback to be called when configuration is reloaded
	 * @param {Function} callback - Function to call with (newConfig, oldConfig)
	 */
	onReload(callback) {
		if (typeof callback === 'function') {
			this.reloadCallbacks.push(callback);
		}
	}

	/**
	 * Get current configuration
	 * @returns {Object|null} - Current configuration or null if not loaded
	 */
	getConfig() {
		return this.config;
	}

	/**
	 * Get HTTP proxy rules as arrays (for backward compatibility)
	 * @returns {Object} - Object with arrays matching old environment variable format
	 */
	getHttpProxyArrays() {
		if (!this.config || !this.config.httpProxyRules) {
			return {
				protocols: [],
				domains: [],
				paths: [],
				hosts: [],
				ports: [],
				pretends: [],
				users: []
			};
		}

		const rules = this.config.httpProxyRules
			.filter(rule => rule.enabled)
			.sort((a, b) => a.priority - b.priority);

		return {
			protocols: rules.map(r => r.protocol),
			domains: rules.map(r => r.domain || ''),
			paths: rules.map(r => r.path),
			hosts: rules.map(r => r.targetHost),
			ports: rules.map(r => r.targetPort.toString()),
			pretends: rules.map(r => r.pretendMode.toString()),
			users: rules.map(r => r.users || {})
		};
	}

	/**
	 * Get WebSocket proxy rules as arrays (for backward compatibility)
	 * @returns {Object} - Object with arrays matching old environment variable format
	 */
	getWsProxyArrays() {
		if (!this.config || !this.config.wsProxyRules) {
			return {
				protocols: [],
				domains: [],
				paths: [],
				hosts: [],
				ports: [],
				pretends: [],
				users: []
			};
		}

		const rules = this.config.wsProxyRules
			.filter(rule => rule.enabled)
			.sort((a, b) => a.priority - b.priority);

		return {
			protocols: rules.map(r => r.protocol),
			domains: rules.map(r => r.domain || ''),
			paths: rules.map(r => r.path),
			hosts: rules.map(r => r.targetHost),
			ports: rules.map(r => r.targetPort.toString()),
			pretends: rules.map(r => r.pretendMode.toString()),
			users: rules.map(r => r.users || {})
		};
	}

	/**
	 * Get settings
	 * @returns {Object} - Settings object
	 */
	getSettings() {
		if (!this.config || !this.config.settings) {
			return {
				maxSession: 0,
				defaultAuth: {
					enabled: true,
					username: 'land007',
					password: 'fcea920f7412b5da7be0cf42b8c93759'
				}
			};
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

	parseEnvList(name) {
		if (!process.env[name]) {
			return [];
		}
		return process.env[name]
			.replace(/\\/g, '')
			.split(',')
			.map(s => s.trim());
	}

	buildRulesFromEnv() {
		const http_proxy_protocols = this.parseEnvList('http_proxy_protocols');
		const http_proxy_domains = this.parseEnvList('http_proxy_domains');
		const http_proxy_paths = this.parseEnvList('http_proxy_paths');
		const http_proxy_hosts = this.parseEnvList('http_proxy_hosts');
		const http_proxy_ports = this.parseEnvList('http_proxy_ports');
		const http_proxy_pretends = this.parseEnvList('http_proxy_pretends');

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

	async importFromEnvOnce() {
		if (fs.existsSync(IMPORTED_MARKER)) {
			return;
		}

		try {
			const empty = !(this.config.httpProxyRules && this.config.httpProxyRules.length) &&
				!(this.config.wsProxyRules && this.config.wsProxyRules.length);
			if (empty) {
				const { httpProxyRules, wsProxyRules } = this.buildRulesFromEnv();
				if (httpProxyRules.length || wsProxyRules.length) {
					this.config.httpProxyRules = httpProxyRules;
					this.config.wsProxyRules = wsProxyRules;
					await this.saveConfiguration(this.config, false);
					console.log('✅ Imported proxy rules from environment variables');
				}
			}
			fs.writeFileSync(IMPORTED_MARKER, new Date().toISOString(), 'utf-8');
		} catch (error) {
			console.error('⛔ Error during one-time environment import:', error);
			throw error;
		}
	}

	/**
	 * Migrate configuration from environment variables to JSON file
	 */
	async migrateFromEnv() {
		console.log('🔄 Migrating configuration from environment variables...');

		// Get environment variables
		const username = process.env.username || 'land007';
		const password = process.env.password || '';
		const max_session = parseInt(process.env.max_session || '0');
		const domainName = process.env.DOMAIN_NAME || 'voice.qhkly.com';

		const { httpProxyRules, wsProxyRules } = this.buildRulesFromEnv();

		// Build configuration object
		const config = {
			version: '1.0',
			lastModified: new Date().toISOString(),
			settings: {
				maxSession: max_session,
				defaultAuth: {
					enabled: true,
					username: username,
					password: password
				}
			},
			httpProxyRules,
			wsProxyRules,
			sslCertificates: []
		};

		// Add SSL certificates for detected domains
		const certDir = path.join(__dirname, 'cert');
		if (fs.existsSync(certDir)) {
			const files = fs.readdirSync(certDir);
			const domains = new Set();

			files.forEach(file => {
				if (file.endsWith('_chain.crt')) {
					const domain = file.replace('_chain.crt', '');
					domains.add(domain);
				}
			});

			domains.forEach(domain => {
				config.sslCertificates.push({
					domain: domain,
					certFile: `cert/${domain}_chain.crt`,
					keyFile: `cert/${domain}_key.key`,
					expiresAt: null
				});
			});
		}

		// Validate and save
		const validation = configValidator.validateConfig(config);
		if (!validation.valid) {
			console.warn('⚠️  Migrated configuration has validation errors:');
			validation.errors.forEach(error => console.warn(`  - ${error}`));
		}

		await this.saveConfiguration(config);
		console.log('✅ Configuration migrated from environment variables successfully');
		console.log('⚠️  WARNING: Environment variables will no longer be used');
		console.log('⚠️  Please use the web UI or edit proxy-config.json directly');
	}

	/**
	 * Save configuration to file (with backup)
	 * @param {Object} config - Configuration to save
	 * @param {boolean} backup - Whether to create a backup before saving
	 */
	async saveConfiguration(config, backup = true) {
		// Validate before saving
		const validation = configValidator.validateConfig(config);
		if (!validation.valid) {
			throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
		}

		// Create backup if requested
		if (backup && fs.existsSync(CONFIG_PATH)) {
			await this.createBackup();
		}

		// Update timestamp
		config.lastModified = new Date().toISOString();

		// Write directly to the config file (preserves the inode). A rename-based "atomic"
		// write breaks Docker single-file bind mounts (e.g. ./proxy-config.json:/node_/proxy-config.json)
		// with EBUSY and silently fails to persist. A fresh backup is always taken above, so a
		// direct write is safe here.
		fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');

		this.config = config;
		console.log('💾 Configuration saved successfully');
	}

	/**
	 * Create a backup of the current configuration
	 */
	async createBackup() {
		if (!fs.existsSync(CONFIG_PATH)) {
			return;
		}

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const backupPath = path.join(BACKUP_DIR, `proxy-config-${timestamp}.json`);

		try {
			fs.copyFileSync(CONFIG_PATH, backupPath);
			console.log(`💾 Backup created: ${backupPath}`);

			// Clean up old backups (keep only last 10)
			await this.cleanOldBackups();
		} catch (error) {
			console.error('⛔ Error creating backup:', error);
		}
	}

	/**
	 * Clean up old backups, keeping only the most recent 10
	 */
	async cleanOldBackups() {
		try {
			const files = fs.readdirSync(BACKUP_DIR);
			const backups = files
				.filter(f => f.startsWith('proxy-config-') && f.endsWith('.json'))
				.map(f => ({
					name: f,
					path: path.join(BACKUP_DIR, f),
					time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
				}))
				.sort((a, b) => b.time - a.time);

			// Remove old backups beyond the most recent 10
			if (backups.length > 10) {
				const toDelete = backups.slice(10);
				toDelete.forEach(backup => {
					fs.unlinkSync(backup.path);
					console.log(`🗑️  Deleted old backup: ${backup.name}`);
				});
			}
		} catch (error) {
			console.error('⛔ Error cleaning old backups:', error);
		}
	}

	/**
	 * Restore configuration from a backup
	 * @param {string} backupName - Name of the backup file
	 */
	async restoreFromBackup(backupName) {
		const backupPath = path.join(BACKUP_DIR, backupName);

		if (!fs.existsSync(backupPath)) {
			throw new Error(`Backup file not found: ${backupName}`);
		}

		// Read backup
		const data = fs.readFileSync(backupPath, 'utf-8');
		const config = JSON.parse(data);

		// Validate
		const validation = configValidator.validateConfig(config);
		if (!validation.valid) {
			throw new Error(`Invalid backup configuration: ${validation.errors.join(', ')}`);
		}

		// Create backup of current config before restoring
		if (fs.existsSync(CONFIG_PATH)) {
			await this.createBackup();
		}

		// Restore
		await this.saveConfiguration(config, false);
		console.log(`✅ Configuration restored from backup: ${backupName}`);
	}

	/**
	 * Get list of available backups
	 * @returns {Array} - Array of backup file info
	 */
	getBackups() {
		if (!fs.existsSync(BACKUP_DIR)) {
			return [];
		}

		try {
			const files = fs.readdirSync(BACKUP_DIR);
			return files
				.filter(f => f.startsWith('proxy-config-') && f.endsWith('.json'))
				.map(f => {
					const stat = fs.statSync(path.join(BACKUP_DIR, f));
					return {
						name: f,
						size: stat.size,
						created: stat.mtime
					};
				})
				.sort((a, b) => b.created - a.created);
		} catch (error) {
			console.error('⛔ Error listing backups:', error);
			return [];
		}
	}

	/**
	 * Ensure backup directory exists
	 */
	ensureBackupDir() {
		if (!fs.existsSync(BACKUP_DIR)) {
			fs.mkdirSync(BACKUP_DIR, { recursive: true });
			console.log(`📁 Created backup directory: ${BACKUP_DIR}`);
		}
	}
}

// Create singleton instance
const loader = new ProxyConfigLoader();

module.exports = loader;
