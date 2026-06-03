const path = require('path');

const DATA_DIR = process.env.DATA_DIR || __dirname;
const resolve = (...parts) => path.join(DATA_DIR, ...parts);

module.exports = {
	DATA_DIR,
	resolve,
	CONFIG_PATH: resolve('proxy-config.json'),
	ADMIN_USERS_PATH: resolve('admin_users.json'),
	CERT_DIR: resolve('cert'),
	BACKUP_DIR: resolve('backups'),
	SESSIONS_DIR: resolve('sessions'),
	IMPORTED_MARKER: resolve('.env-imported'),
	STATS_FILE: resolve('proxy-stats.json'),
	DDNS_CONFIG: process.env.DDNS_CONFIG || resolve('ddns-config.json')
};
