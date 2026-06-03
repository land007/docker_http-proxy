/**
 * Configuration Validator
 * Validates proxy configuration structure and values
 */

const fs = require('fs');
const path = require('path');

const CONFIG_SCHEMA = {
	version: { type: 'string', required: true, pattern: /^\d+\.\d+$/ },
	lastModified: { type: 'string', required: true, format: 'iso-date' },
	settings: {
		type: 'object',
		required: false,
		properties: {
			maxSession: { type: 'number', required: false, min: 0 },
			defaultAuth: {
				type: 'object',
				required: false,
				properties: {
					enabled: { type: 'boolean', required: false },
					username: { type: 'string', required: false, minLength: 1 },
					password: { type: 'string', required: false, minLength: 1 }
				}
			}
		}
	},
	httpProxyRules: {
		type: 'array',
		required: false,
		item: {
			id: { type: 'string', required: true, minLength: 1 },
			enabled: { type: 'boolean', required: true },
			protocol: { type: 'string', required: true, enum: ['http:', 'https:'] },
			domain: { type: 'string', required: false },
			path: { type: 'string', required: true, minLength: 1 },
			targetHost: { type: 'string', required: true, minLength: 1 },
			targetPort: { type: 'number', required: true, min: 1, max: 65535 },
			pretendMode: { type: 'boolean', required: true },
			priority: { type: 'number', required: true, min: 1 },
			users: { type: 'object', required: false }
		}
	},
	wsProxyRules: {
		type: 'array',
		required: false,
		item: {
			id: { type: 'string', required: true, minLength: 1 },
			enabled: { type: 'boolean', required: true },
			protocol: { type: 'string', required: true, enum: ['ws:', 'wss:'] },
			domain: { type: 'string', required: false },
			path: { type: 'string', required: true, minLength: 1 },
			targetHost: { type: 'string', required: true, minLength: 1 },
			targetPort: { type: 'number', required: true, min: 1, max: 65535 },
			pretendMode: { type: 'boolean', required: true },
			priority: { type: 'number', required: true, min: 1 },
			users: { type: 'object', required: false }
		}
	},
	sslCertificates: {
		type: 'array',
		required: false,
		item: {
			domain: { type: 'string', required: true, minLength: 1 },
			certFile: { type: 'string', required: true, minLength: 1 },
			keyFile: { type: 'string', required: true, minLength: 1 },
			expiresAt: { type: 'string', required: false, format: 'iso-date' }
		}
	}
};

class ConfigValidator {
	/**
	 * Validate the entire configuration object
	 * @param {Object} config - Configuration object to validate
	 * @returns {Object} - { valid: boolean, errors: string[] }
	 */
	validateConfig(config) {
		const errors = [];

		// Check if config is an object
		if (!config || typeof config !== 'object') {
			return { valid: false, errors: ['Configuration must be an object'] };
		}

		// Validate required top-level fields
		if (!config.version) {
			errors.push('Missing required field: version');
		} else if (!CONFIG_SCHEMA.version.pattern.test(config.version)) {
			errors.push('Version must be in format X.Y (e.g., 1.0)');
		}

		if (!config.lastModified) {
			errors.push('Missing required field: lastModified');
		}

		// Validate settings
		if (config.settings) {
			const settingsErrors = this.validateSettings(config.settings);
			errors.push(...settingsErrors);
		}

		// Validate HTTP proxy rules
		if (config.httpProxyRules) {
			const httpRulesErrors = this.validateHttpProxyRules(config.httpProxyRules);
			errors.push(...httpRulesErrors);
		}

		// Validate WebSocket proxy rules
		if (config.wsProxyRules) {
			const wsRulesErrors = this.validateWsProxyRules(config.wsProxyRules);
			errors.push(...wsRulesErrors);
		}

		// Validate SSL certificates
		if (config.sslCertificates) {
			const certErrors = this.validateSslCertificates(config.sslCertificates);
			errors.push(...certErrors);
		}

		// Check SSL certificate files on disk. A missing cert file must NOT make the whole
		// configuration invalid (that would prevent the service - and the admin UI used to fix
		// it - from starting, e.g. on a fresh ACME deployment before any cert is issued).
		// Report these as non-fatal warnings instead.
		const warnings = [];
		if (config.sslCertificates) {
			const fileErrors = this.validateCertFiles(config.sslCertificates);
			if (fileErrors.length > 0) {
				warnings.push(...fileErrors);
				fileErrors.forEach(w => console.warn(`⚠️  ${w}`));
			}
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings
		};
	}

	/**
	 * Validate settings object
	 */
	validateSettings(settings) {
		const errors = [];

		if (settings.maxSession !== undefined) {
			if (typeof settings.maxSession !== 'number' || settings.maxSession < 0) {
				errors.push('settings.maxSession must be a non-negative number');
			}
		}

		if (settings.defaultAuth) {
			if (settings.defaultAuth.enabled !== undefined && typeof settings.defaultAuth.enabled !== 'boolean') {
				errors.push('settings.defaultAuth.enabled must be a boolean');
			}

			if (settings.defaultAuth.username !== undefined) {
				if (typeof settings.defaultAuth.username !== 'string' || settings.defaultAuth.username.length === 0) {
					errors.push('settings.defaultAuth.username must be a non-empty string');
				}
			}

			if (settings.defaultAuth.password !== undefined) {
				if (typeof settings.defaultAuth.password !== 'string' || settings.defaultAuth.password.length === 0) {
					errors.push('settings.defaultAuth.password must be a non-empty string');
				}
			}
		}

		return errors;
	}

	/**
	 * Validate HTTP proxy rules array
	 */
	validateHttpProxyRules(rules) {
		const errors = [];

		if (!Array.isArray(rules)) {
			errors.push('httpProxyRules must be an array');
			return errors;
		}

		const ids = new Set();

		rules.forEach((rule, index) => {
			if (!rule.id || typeof rule.id !== 'string' || rule.id.length === 0) {
				errors.push(`httpProxyRules[${index}].id must be a non-empty string`);
			} else if (ids.has(rule.id)) {
				errors.push(`httpProxyRules[${index}].id must be unique: ${rule.id}`);
			} else {
				ids.add(rule.id);
			}

			if (typeof rule.enabled !== 'boolean') {
				errors.push(`httpProxyRules[${index}].enabled must be a boolean`);
			}

			if (!rule.protocol || !['http:', 'https:'].includes(rule.protocol)) {
				errors.push(`httpProxyRules[${index}].protocol must be 'http:' or 'https:'`);
			}

			if (rule.domain !== undefined && typeof rule.domain !== 'string') {
				errors.push(`httpProxyRules[${index}].domain must be a string`);
			}

			if (!rule.path || typeof rule.path !== 'string' || rule.path.length === 0) {
				errors.push(`httpProxyRules[${index}].path must be a non-empty string`);
			}

			if (!rule.targetHost || typeof rule.targetHost !== 'string' || rule.targetHost.length === 0) {
				errors.push(`httpProxyRules[${index}].targetHost must be a non-empty string`);
			}

			if (!rule.targetPort || typeof rule.targetPort !== 'number' || rule.targetPort < 1 || rule.targetPort > 65535) {
				errors.push(`httpProxyRules[${index}].targetPort must be a number between 1 and 65535`);
			}

			if (typeof rule.pretendMode !== 'boolean') {
				errors.push(`httpProxyRules[${index}].pretendMode must be a boolean`);
			}

			if (!rule.priority || typeof rule.priority !== 'number' || rule.priority < 1) {
				errors.push(`httpProxyRules[${index}].priority must be a number greater than 0`);
			}

			errors.push(...this.validateRuleUsers(rule.users, `httpProxyRules[${index}].users`));
		});

		return errors;
	}

	/**
	 * Validate WebSocket proxy rules array
	 */
	validateWsProxyRules(rules) {
		const errors = [];

		if (!Array.isArray(rules)) {
			errors.push('wsProxyRules must be an array');
			return errors;
		}

		const ids = new Set();

		rules.forEach((rule, index) => {
			if (!rule.id || typeof rule.id !== 'string' || rule.id.length === 0) {
				errors.push(`wsProxyRules[${index}].id must be a non-empty string`);
			} else if (ids.has(rule.id)) {
				errors.push(`wsProxyRules[${index}].id must be unique: ${rule.id}`);
			} else {
				ids.add(rule.id);
			}

			if (typeof rule.enabled !== 'boolean') {
				errors.push(`wsProxyRules[${index}].enabled must be a boolean`);
			}

			if (!rule.protocol || !['ws:', 'wss:'].includes(rule.protocol)) {
				errors.push(`wsProxyRules[${index}].protocol must be 'ws:' or 'wss:'`);
			}

			if (rule.domain !== undefined && typeof rule.domain !== 'string') {
				errors.push(`wsProxyRules[${index}].domain must be a string`);
			}

			if (!rule.path || typeof rule.path !== 'string' || rule.path.length === 0) {
				errors.push(`wsProxyRules[${index}].path must be a non-empty string`);
			}

			if (!rule.targetHost || typeof rule.targetHost !== 'string' || rule.targetHost.length === 0) {
				errors.push(`wsProxyRules[${index}].targetHost must be a non-empty string`);
			}

			if (!rule.targetPort || typeof rule.targetPort !== 'number' || rule.targetPort < 1 || rule.targetPort > 65535) {
				errors.push(`wsProxyRules[${index}].targetPort must be a number between 1 and 65535`);
			}

			if (typeof rule.pretendMode !== 'boolean') {
				errors.push(`wsProxyRules[${index}].pretendMode must be a boolean`);
			}

			if (!rule.priority || typeof rule.priority !== 'number' || rule.priority < 1) {
				errors.push(`wsProxyRules[${index}].priority must be a number greater than 0`);
			}

			errors.push(...this.validateRuleUsers(rule.users, `wsProxyRules[${index}].users`));
		});

		return errors;
	}

	/**
	 * Validate SSL certificates array
	 */
	validateSslCertificates(certs) {
		const errors = [];

		if (!Array.isArray(certs)) {
			errors.push('sslCertificates must be an array');
			return errors;
		}

		const domains = new Set();

		certs.forEach((cert, index) => {
			if (!cert.domain || typeof cert.domain !== 'string' || cert.domain.length === 0) {
				errors.push(`sslCertificates[${index}].domain must be a non-empty string`);
			} else if (domains.has(cert.domain)) {
				errors.push(`sslCertificates[${index}].domain must be unique: ${cert.domain}`);
			} else {
				domains.add(cert.domain);
			}

			if (!cert.certFile || typeof cert.certFile !== 'string' || cert.certFile.length === 0) {
				errors.push(`sslCertificates[${index}].certFile must be a non-empty string`);
			}

			if (!cert.keyFile || typeof cert.keyFile !== 'string' || cert.keyFile.length === 0) {
				errors.push(`sslCertificates[${index}].keyFile must be a non-empty string`);
			}

			if (cert.expiresAt) {
				const date = new Date(cert.expiresAt);
				if (isNaN(date.getTime())) {
					errors.push(`sslCertificates[${index}].expiresAt must be a valid ISO date`);
				}
			}
		});

		return errors;
	}

	/**
	 * Validate SSL certificate files exist
	 */
	validateCertFiles(certs) {
		const errors = [];
		const certDir = path.join(__dirname, 'cert');

		certs.forEach((cert, index) => {
			if (cert.certFile) {
				const certPath = path.join(__dirname, cert.certFile);
				if (!fs.existsSync(certPath)) {
					errors.push(`sslCertificates[${index}].certFile does not exist: ${cert.certFile}`);
				}
			}

			if (cert.keyFile) {
				const keyPath = path.join(__dirname, cert.keyFile);
				if (!fs.existsSync(keyPath)) {
					errors.push(`sslCertificates[${index}].keyFile does not exist: ${cert.keyFile}`);
				}
			}
		});

		return errors;
	}

	/**
	 * Validate a single HTTP proxy rule
	 */
	validateHttpProxyRule(rule) {
		const errors = [];

		if (!rule.id || typeof rule.id !== 'string' || rule.id.length === 0) {
			errors.push('id must be a non-empty string');
		}

		if (typeof rule.enabled !== 'boolean') {
			errors.push('enabled must be a boolean');
		}

		if (!rule.protocol || !['http:', 'https:'].includes(rule.protocol)) {
			errors.push('protocol must be "http:" or "https:"');
		}

		if (rule.domain !== undefined && typeof rule.domain !== 'string') {
			errors.push('domain must be a string');
		}

		if (!rule.path || typeof rule.path !== 'string' || rule.path.length === 0) {
			errors.push('path must be a non-empty string');
		}

		if (!rule.targetHost || typeof rule.targetHost !== 'string' || rule.targetHost.length === 0) {
			errors.push('targetHost must be a non-empty string');
		}

		if (!rule.targetPort || typeof rule.targetPort !== 'number' || rule.targetPort < 1 || rule.targetPort > 65535) {
			errors.push('targetPort must be a number between 1 and 65535');
		}

		if (typeof rule.pretendMode !== 'boolean') {
			errors.push('pretendMode must be a boolean');
		}

		if (!rule.priority || typeof rule.priority !== 'number' || rule.priority < 1) {
			errors.push('priority must be a number greater than 0');
		}

		errors.push(...this.validateRuleUsers(rule.users, 'users'));

		return {
			valid: errors.length === 0,
			errors
		};
	}

	/**
	 * Validate a single WebSocket proxy rule
	 */
	validateWsProxyRule(rule) {
		const errors = [];

		if (!rule.id || typeof rule.id !== 'string' || rule.id.length === 0) {
			errors.push('id must be a non-empty string');
		}

		if (typeof rule.enabled !== 'boolean') {
			errors.push('enabled must be a boolean');
		}

		if (!rule.protocol || !['ws:', 'wss:'].includes(rule.protocol)) {
			errors.push('protocol must be "ws:" or "wss:"');
		}

		if (rule.domain !== undefined && typeof rule.domain !== 'string') {
			errors.push('domain must be a string');
		}

		if (!rule.path || typeof rule.path !== 'string' || rule.path.length === 0) {
			errors.push('path must be a non-empty string');
		}

		if (!rule.targetHost || typeof rule.targetHost !== 'string' || rule.targetHost.length === 0) {
			errors.push('targetHost must be a non-empty string');
		}

		if (!rule.targetPort || typeof rule.targetPort !== 'number' || rule.targetPort < 1 || rule.targetPort > 65535) {
			errors.push('targetPort must be a number between 1 and 65535');
		}

		if (typeof rule.pretendMode !== 'boolean') {
			errors.push('pretendMode must be a boolean');
		}

		if (!rule.priority || typeof rule.priority !== 'number' || rule.priority < 1) {
			errors.push('priority must be a number greater than 0');
		}

		errors.push(...this.validateRuleUsers(rule.users, 'users'));

		return {
			valid: errors.length === 0,
			errors
		};
	}

	validateRuleUsers(users, fieldName) {
		const errors = [];
		if (users === undefined) {
			return errors;
		}
		if (!users || typeof users !== 'object' || Array.isArray(users)) {
			errors.push(`${fieldName} must be an object`);
			return errors;
		}
		Object.entries(users).forEach(([username, hash]) => {
			if (!username) {
				errors.push(`${fieldName} usernames must be non-empty strings`);
			}
			if (typeof hash !== 'string') {
				errors.push(`${fieldName}.${username} must be a string`);
			}
		});
		return errors;
	}
}

module.exports = new ConfigValidator();
