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

const DNS_PROVIDERS = {
	dns_dp: {
		id: 'dns_dp',
		name: 'DNSPod',
		fields: [
			{ name: 'DP_Id', label: 'DP_Id', type: 'text' },
			{ name: 'DP_Key', label: 'DP_Key', type: 'password' }
		]
	},
	dns_ali: {
		id: 'dns_ali',
		name: 'Aliyun',
		fields: [
			{ name: 'Ali_Key', label: 'Ali_Key', type: 'text' },
			{ name: 'Ali_Secret', label: 'Ali_Secret', type: 'password' }
		]
	},
	dns_cf: {
		id: 'dns_cf',
		name: 'Cloudflare',
		fields: [
			{ name: 'CF_Token', label: 'CF_Token', type: 'password', optional: true },
			{ name: 'CF_Account_ID', label: 'CF_Account_ID', type: 'text', optional: true },
			{ name: 'CF_Key', label: 'CF_Key', type: 'password', optional: true },
			{ name: 'CF_Email', label: 'CF_Email', type: 'email', optional: true }
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
		expiresAt
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

	const requiredMissing = provider.fields
		.filter(field => !field.optional)
		.filter(field => !options.credentials || !options.credentials[field.name])
		.map(field => field.name);

	if (requiredMissing.length > 0) {
		throw new Error(`Missing DNS credentials: ${requiredMissing.join(', ')}`);
	}

	const args = ['--issue', '--dns', options.dnsProvider, '-d', cleanDomain];
	if (options.server) {
		args.push('--server', options.server);
	} else if (process.env.ACME_URL) {
		args.push('--server', process.env.ACME_URL);
	}

	await runAcme(args, { env: buildEnv(options.credentials) });
	const certificate = await installCertificate(cleanDomain);

	return { certificate };
}

async function renew(domain) {
	const cleanDomain = assertDomain(domain);
	const args = ['--renew', '-d', cleanDomain, '--force'];
	if (process.env.ACME_URL) {
		args.push('--server', process.env.ACME_URL);
	}

	await runAcme(args);
	const certificate = await installCertificate(cleanDomain);

	return { certificate };
}

module.exports = {
	isAvailable,
	listCerts,
	issue,
	renew,
	getProviders() {
		return Object.values(DNS_PROVIDERS);
	},
	getDefaultServer() {
		return process.env.ACME_URL || '';
	}
};
