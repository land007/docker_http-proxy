/**
 * ACME manager
 * Wraps acme.sh for optional DNS-based certificate issue and renewal.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const configLoader = require('./proxy-config-loader');

const ACME_PATH = process.env.ACME_SH_PATH || '/root/.acme.sh/acme.sh';
const CERT_DIR = path.join(__dirname, 'cert');
const EXEC_TIMEOUT_MS = parseInt(process.env.ACME_EXEC_TIMEOUT_MS || '600000', 10);

function parsePositiveInt(value, fallback) {
	const parsed = parseInt(value, 10);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const AUTO_RENEW_INTERVAL_MS = parsePositiveInt(process.env.ACME_AUTO_RENEW_INTERVAL_MS, 12 * 60 * 60 * 1000);
const AUTO_RENEW_START_DELAY_MS = parsePositiveInt(process.env.ACME_AUTO_RENEW_START_DELAY_MS, 5 * 60 * 1000);

let autoRenewTimer = null;
let autoRenewStarted = false;
let autoRenewRunning = false;

const DNS_PROVIDERS = {
	dns_dp: {
		id: 'dns_dp',
		dns: 'dns_dp',
		name: 'DNSPod',
		fields: [
			{ name: 'DP_Id', label: 'DP_Id', type: 'text' },
			{ name: 'DP_Key', label: 'DP_Key', type: 'password' }
		]
	},
	dns_ali: {
		id: 'dns_ali',
		dns: 'dns_ali',
		name: 'Aliyun',
		fields: [
			{ name: 'Ali_Key', label: 'Ali_Key', type: 'text' },
			{ name: 'Ali_Secret', label: 'Ali_Secret', type: 'password' }
		]
	},
	dns_cf: {
		id: 'dns_cf',
		dns: 'dns_cf',
		name: 'Cloudflare',
		methods: [
			{
				id: 'token',
				label: 'API Token',
				fields: [
					{ name: 'CF_Token', label: 'CF_Token', type: 'password' },
					{ name: 'CF_Account_ID', label: 'CF_Account_ID', type: 'text', optional: true }
				]
			},
			{
				id: 'key',
				label: 'Global API Key',
				fields: [
					{ name: 'CF_Key', label: 'CF_Key', type: 'password' },
					{ name: 'CF_Email', label: 'CF_Email', type: 'email' }
				]
			}
		]
	}
};

function isAvailable() {
	return fs.existsSync(ACME_PATH);
}

function assertDomain(domain) {
	if (!domain || typeof domain !== 'string' || !/^[a-zA-Z0-9.-]+$/.test(domain)) {
		throw new Error('Invalid domain');
	}
	return domain.trim().toLowerCase();
}

function buildEnv(credentials = {}) {
	const env = { ...process.env };
	Object.entries(credentials).forEach(([key, value]) => {
		if (value !== undefined && value !== null && value !== '') {
			env[key] = String(value);
		}
	});
	return env;
}

async function runAcme(args, options = {}) {
	if (!isAvailable()) {
		throw new Error('acme.sh is not available in this container');
	}

	const result = await execFileAsync(ACME_PATH, args, {
		env: options.env || process.env,
		timeout: EXEC_TIMEOUT_MS,
		maxBuffer: 1024 * 1024 * 4
	});

	return {
		stdout: result.stdout,
		stderr: result.stderr
	};
}

async function getCertificateExpiry(certPath) {
	if (!fs.existsSync(certPath)) {
		return null;
	}

	try {
		const result = await execFileAsync('openssl', ['x509', '-enddate', '-noout', '-in', certPath], {
			timeout: 30000
		});
		const match = result.stdout.match(/notAfter=(.+)/);
		if (!match) {
			return null;
		}
		const expiresAt = new Date(match[1].trim());
		return isNaN(expiresAt.getTime()) ? null : expiresAt.toISOString();
	} catch (error) {
		return null;
	}
}

async function upsertCertificate(domain) {
	const certFileName = `${domain}_chain.crt`;
	const keyFileName = `${domain}_key.key`;
	const certPath = path.join(CERT_DIR, certFileName);
	const keyPath = path.join(CERT_DIR, keyFileName);

	if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
		throw new Error(`Installed certificate files were not found for ${domain}`);
	}

	const expiresAt = await getCertificateExpiry(certPath);
	const config = configLoader.getConfig();
	if (!config.sslCertificates) {
		config.sslCertificates = [];
	}

	config.sslCertificates = config.sslCertificates.filter(cert => cert.domain !== domain);
	config.sslCertificates.push({
		domain,
		certFile: `cert/${certFileName}`,
		keyFile: `cert/${keyFileName}`,
		expiresAt,
		acmeManaged: true
	});

	await configLoader.saveConfiguration(config, true);

	return config.sslCertificates.find(cert => cert.domain === domain);
}

async function installCertificate(domain) {
	if (!fs.existsSync(CERT_DIR)) {
		fs.mkdirSync(CERT_DIR, { recursive: true });
	}

	await runAcme([
		'--install-cert',
		'-d', domain,
		'--key-file', path.join(CERT_DIR, `${domain}_key.key`),
		'--fullchain-file', path.join(CERT_DIR, `${domain}_chain.crt`)
	]);

	return upsertCertificate(domain);
}

async function listCerts() {
	const config = configLoader.getConfig();
	const certs = config && config.sslCertificates ? config.sslCertificates : [];

	return Promise.all(certs.map(async cert => ({
		...cert,
		expiresAt: await getCertificateExpiry(path.join(__dirname, cert.certFile)) || cert.expiresAt || null
	})));
}

async function issue(domain, options = {}) {
	const cleanDomain = assertDomain(domain);
	const provider = DNS_PROVIDERS[options.dnsProvider];
	if (!provider) {
		throw new Error('Unsupported DNS provider');
	}

	const groups = provider.methods ? provider.methods.map(method => method.fields) : [provider.fields];
	const hasRequiredCredentials = groups.some(fields =>
		fields
			.filter(field => !field.optional)
			.every(field => options.credentials && options.credentials[field.name])
	);

	if (!hasRequiredCredentials) {
		throw new Error('Missing DNS credentials');
	}

	const dnsPlugin = provider.dns || provider.id;
	const server = options.server || process.env.ACME_URL || '';
	const env = buildEnv(options.credentials);
	const eabKid = options.eabKid || process.env.EAB_KID;
	const eabHmacKey = options.eabHmacKey || process.env.EAB_HMAC_KEY;

	if (eabKid && eabHmacKey) {
		const regArgs = ['--register-account'];
		if (server) {
			regArgs.push('--server', server);
		}
		regArgs.push('--eab-kid', eabKid, '--eab-hmac-key', eabHmacKey);
		await runAcme(regArgs, { env });
	}

	const args = ['--issue', '--dns', dnsPlugin, '-d', cleanDomain];
	if (server) {
		args.push('--server', server);
	}

	await runAcme(args, { env });
	const certificate = await installCertificate(cleanDomain);

	return { certificate };
}

async function renew(domain, options = {}) {
	const cleanDomain = assertDomain(domain);
	const args = ['--renew', '-d', cleanDomain];
	if (options.force !== false) {
		args.push('--force');
	}
	if (process.env.ACME_URL) {
		args.push('--server', process.env.ACME_URL);
	}

	await runAcme(args);
	const certificate = await installCertificate(cleanDomain);

	return { certificate };
}

function isAcmeManagedCert(cert) {
	if (!cert || !cert.domain) {
		return false;
	}
	if (cert.acmeManaged) {
		return true;
	}
	return cert.certFile === `cert/${cert.domain}_chain.crt` && cert.keyFile === `cert/${cert.domain}_key.key`;
}

function getRenewDomains() {
	const config = configLoader.getConfig();
	const certs = config && Array.isArray(config.sslCertificates) ? config.sslCertificates : [];
	return [...new Set(certs
		.filter(isAcmeManagedCert)
		.map(cert => cert.domain)
		.filter(Boolean))];
}

async function renewConfiguredCertificates(options = {}) {
	const domains = getRenewDomains();
	const results = [];

	for (const domain of domains) {
		try {
			await renew(domain, { force: options.force === true });
			results.push({ domain, status: 'ok' });
		} catch (error) {
			results.push({ domain, status: 'error', error: error.message });
		}
	}

	return results;
}

async function runAutoRenewal() {
	if (autoRenewRunning) {
		console.log('[ACME] Auto-renewal skipped because a previous run is still active');
		return;
	}
	if (!isAvailable()) {
		console.log('[ACME] Auto-renewal skipped because acme.sh is not available');
		return;
	}

	autoRenewRunning = true;
	try {
		const force = process.env.ACME_AUTO_RENEW_FORCE === 'true';
		const results = await renewConfiguredCertificates({ force });
		const ok = results.filter(result => result.status === 'ok').length;
		const failed = results.filter(result => result.status === 'error');
		console.log(`[ACME] Auto-renewal checked ${results.length} certificate(s), ok=${ok}, failed=${failed.length}`);
		failed.forEach(result => console.error(`[ACME] Auto-renewal failed for ${result.domain}: ${result.error}`));
	} finally {
		autoRenewRunning = false;
	}
}

function scheduleNextAutoRenewal(delay) {
	if (!autoRenewStarted) {
		return;
	}

	autoRenewTimer = setTimeout(async () => {
		try {
			await runAutoRenewal();
		} catch (error) {
			console.error('[ACME] Auto-renewal run failed:', error);
		} finally {
			scheduleNextAutoRenewal(AUTO_RENEW_INTERVAL_MS);
		}
	}, delay);

	if (autoRenewTimer.unref) {
		autoRenewTimer.unref();
	}
}

function startAutoRenewal() {
	if (process.env.ACME_AUTO_RENEW_ENABLED === 'false') {
		console.log('[ACME] Auto-renewal disabled by ACME_AUTO_RENEW_ENABLED=false');
		return;
	}
	if (autoRenewStarted) {
		return;
	}

	autoRenewStarted = true;
	scheduleNextAutoRenewal(Number.isFinite(AUTO_RENEW_START_DELAY_MS) && AUTO_RENEW_START_DELAY_MS > 0 ? AUTO_RENEW_START_DELAY_MS : 0);
	console.log(`[ACME] Auto-renewal scheduled every ${AUTO_RENEW_INTERVAL_MS}ms`);
}

function stopAutoRenewal() {
	autoRenewStarted = false;
	if (autoRenewTimer) {
		clearTimeout(autoRenewTimer);
		autoRenewTimer = null;
	}
}

module.exports = {
	isAvailable,
	listCerts,
	issue,
	renew,
	renewConfiguredCertificates,
	startAutoRenewal,
	stopAutoRenewal,
	getProviders() {
		return Object.values(DNS_PROVIDERS);
	},
	getDefaultServer() {
		return process.env.ACME_URL || '';
	}
};
