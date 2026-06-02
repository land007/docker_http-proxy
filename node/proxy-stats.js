const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(__dirname, 'proxy-stats.json');
const BUCKET_MS = 60 * 1000;
const BUCKET_COUNT = 24 * 60;

function emptyState() {
	return {
		startedAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		totalRequests: 0,
		totalErrors: 0,
		totalBytes: 0,
		totalDurationMs: 0,
		activeHttp: 0,
		activeWs: 0,
		ruleStats: {},
		minuteBuckets: []
	};
}

let state = emptyState();
let flushTimer = null;
let flushInterval = null;

function minuteTs(time = Date.now()) {
	return Math.floor(time / BUCKET_MS) * BUCKET_MS;
}

function pruneBuckets() {
	const minTs = minuteTs() - (BUCKET_COUNT - 1) * BUCKET_MS;
	state.minuteBuckets = state.minuteBuckets.filter(bucket => bucket.ts >= minTs);
}

function getBucket(time = Date.now()) {
	const ts = minuteTs(time);
	let bucket = state.minuteBuckets.find(item => item.ts === ts);
	if (!bucket) {
		bucket = { ts, requests: 0, errors: 0, bytes: 0, durationMs: 0 };
		state.minuteBuckets.push(bucket);
		state.minuteBuckets.sort((a, b) => a.ts - b.ts);
		pruneBuckets();
	}
	return bucket;
}

function getRule(rule) {
	const key = rule && rule.key ? rule.key : 'unmatched';
	if (!state.ruleStats[key]) {
		state.ruleStats[key] = {
			key,
			kind: rule && rule.kind || 'http',
			domain: rule && rule.domain || '',
			path: rule && rule.path || '/',
			target: rule && rule.target || '',
			protocol: rule && rule.protocol || '',
			requests: 0,
			errors: 0,
			bytes: 0,
			durationMs: 0,
			active: 0,
			lastStatus: null,
			lastSeenAt: null
		};
	}
	return state.ruleStats[key];
}

function touch() {
	state.updatedAt = new Date().toISOString();
}

function scheduleFlush() {
	ensureFlushInterval();
	if (flushTimer) return;
	flushTimer = setTimeout(() => {
		flushTimer = null;
		flush();
	}, 1000);
	if (flushTimer.unref) flushTimer.unref();
}

function ensureFlushInterval() {
	if (flushInterval) return;
	flushInterval = setInterval(flush, 5000);
	if (flushInterval.unref) flushInterval.unref();
}

function flush() {
	try {
		touch();
		pruneBuckets();
		const tmp = `${STATS_FILE}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
		fs.renameSync(tmp, STATS_FILE);
	} catch (error) {
		console.error('⛔ Error writing proxy stats:', error.message);
	}
}

function loadPersistedState() {
	try {
		if (!fs.existsSync(STATS_FILE)) return;
		const data = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
		state = {
			...emptyState(),
			...data,
			activeHttp: 0,
			activeWs: 0,
			ruleStats: data.ruleStats || {},
			minuteBuckets: Array.isArray(data.minuteBuckets) ? data.minuteBuckets : []
		};
		pruneBuckets();
	} catch (error) {
		console.error('⛔ Error loading proxy stats:', error.message);
	}
}

function beginHttp(rule) {
	state.activeHttp += 1;
	const ruleState = getRule(rule);
	ruleState.active += 1;
	touch();
	scheduleFlush();
	return {
		startedAt: Date.now(),
		rule,
		bytesWritten: 0
	};
}

function finishHttp(sample, statusCode, bytesWritten) {
	const durationMs = Math.max(0, Date.now() - (sample && sample.startedAt || Date.now()));
	const bytes = Math.max(0, Number(bytesWritten || 0) - Number(sample && sample.bytesWritten || 0));
	const error = Number(statusCode || 0) >= 500;
	state.activeHttp = Math.max(0, state.activeHttp - 1);
	state.totalRequests += 1;
	state.totalErrors += error ? 1 : 0;
	state.totalBytes += bytes;
	state.totalDurationMs += durationMs;

	const bucket = getBucket();
	bucket.requests += 1;
	bucket.errors += error ? 1 : 0;
	bucket.bytes += bytes;
	bucket.durationMs += durationMs;

	const ruleState = getRule(sample && sample.rule);
	ruleState.active = Math.max(0, ruleState.active - 1);
	ruleState.requests += 1;
	ruleState.errors += error ? 1 : 0;
	ruleState.bytes += bytes;
	ruleState.durationMs += durationMs;
	ruleState.lastStatus = statusCode || null;
	ruleState.lastSeenAt = new Date().toISOString();
	touch();
	scheduleFlush();
}

function openWs(rule) {
	state.activeWs += 1;
	state.totalRequests += 1;
	const bucket = getBucket();
	bucket.requests += 1;
	const ruleState = getRule(rule);
	ruleState.active += 1;
	ruleState.requests += 1;
	ruleState.lastStatus = 101;
	ruleState.lastSeenAt = new Date().toISOString();
	touch();
	scheduleFlush();
	return { rule, openedAt: Date.now() };
}

function closeWs(sample, hadError) {
	state.activeWs = Math.max(0, state.activeWs - 1);
	if (hadError) state.totalErrors += 1;
	const bucket = getBucket();
	if (hadError) bucket.errors += 1;
	const ruleState = getRule(sample && sample.rule);
	ruleState.active = Math.max(0, ruleState.active - 1);
	ruleState.errors += hadError ? 1 : 0;
	ruleState.lastSeenAt = new Date().toISOString();
	touch();
	scheduleFlush();
}

function readSnapshot() {
	try {
		const data = fs.existsSync(STATS_FILE) ? JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')) : state;
		const now = minuteTs();
		const bucketsByTs = new Map((data.minuteBuckets || []).map(bucket => [bucket.ts, bucket]));
		const minuteBuckets = [];
		for (let i = BUCKET_COUNT - 1; i >= 0; i -= 1) {
			const ts = now - i * BUCKET_MS;
			minuteBuckets.push(bucketsByTs.get(ts) || { ts, requests: 0, errors: 0, bytes: 0, durationMs: 0 });
		}
		return {
			...data,
			activeHttp: data.activeHttp || 0,
			activeWs: data.activeWs || 0,
			minuteBuckets,
			ruleStats: data.ruleStats || {}
		};
	} catch (error) {
		return emptyState();
	}
}

loadPersistedState();

module.exports = {
	beginHttp,
	finishHttp,
	openWs,
	closeWs,
	readSnapshot,
	flush
};
