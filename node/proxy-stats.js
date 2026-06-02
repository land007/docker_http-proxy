const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(__dirname, 'proxy-stats.json');
const BUCKET_MS = 60 * 1000;
const BUCKET_COUNT = 24 * 60;
const MAX_RULE_STATS = 200;

function emptyCounters() {
	return {
		requests: 0,
		successes: 0,
		redirects: 0,
		clientErrors: 0,
		serverErrors: 0,
		authChallenges: 0,
		upstreamErrors: 0,
		errors: 0,
		bytes: 0,
		durationMs: 0
	};
}

function emptyState() {
	return {
		startedAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		totalRequests: 0,
		totalSuccesses: 0,
		totalRedirects: 0,
		totalClientErrors: 0,
		totalServerErrors: 0,
		totalAuthChallenges: 0,
		totalUpstreamErrors: 0,
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

function normalizeBucket(bucket) {
	return {
		ts: bucket && bucket.ts || minuteTs(),
		...emptyCounters(),
		...(bucket || {}),
		errors: bucket && bucket.errors != null ? bucket.errors : bucket && bucket.serverErrors || 0,
		serverErrors: bucket && bucket.serverErrors != null ? bucket.serverErrors : bucket && bucket.errors || 0
	};
}

function getBucket(time = Date.now()) {
	const ts = minuteTs(time);
	let bucket = state.minuteBuckets.find(item => item.ts === ts);
	if (!bucket) {
		bucket = { ts, ...emptyCounters() };
		state.minuteBuckets.push(bucket);
		state.minuteBuckets.sort((a, b) => a.ts - b.ts);
		pruneBuckets();
	}
	return bucket;
}

function classifyStatus(statusCode) {
	const status = Number(statusCode || 0);
	return {
		success: status === 101 || status >= 200 && status < 300,
		redirect: status >= 300 && status < 400,
		clientError: status >= 400 && status < 500,
		serverError: status >= 500,
		authChallenge: status === 401 || status === 403,
		upstreamError: status >= 500
	};
}

function buildSnapshot(data) {
	const now = minuteTs();
	const bucketsByTs = new Map((data.minuteBuckets || []).map(bucket => [bucket.ts, normalizeBucket(bucket)]));
	const minuteBuckets = [];
	for (let i = BUCKET_COUNT - 1; i >= 0; i -= 1) {
		const ts = now - i * BUCKET_MS;
		minuteBuckets.push(bucketsByTs.get(ts) || { ts, ...emptyCounters() });
	}
	return {
		...data,
		totalErrors: data.totalErrors != null ? data.totalErrors : data.totalServerErrors || 0,
		totalServerErrors: data.totalServerErrors != null ? data.totalServerErrors : data.totalErrors || 0,
		totalClientErrors: data.totalClientErrors || 0,
		totalAuthChallenges: data.totalAuthChallenges || 0,
		totalUpstreamErrors: data.totalUpstreamErrors || 0,
		totalSuccesses: data.totalSuccesses || 0,
		totalRedirects: data.totalRedirects || 0,
		activeHttp: data.activeHttp || 0,
		activeWs: data.activeWs || 0,
		minuteBuckets,
		ruleStats: data.ruleStats || {}
	};
}

function applyCounters(target, statusCode, bytes, durationMs) {
	const status = classifyStatus(statusCode);
	target.requests += 1;
	target.successes += status.success ? 1 : 0;
	target.redirects += status.redirect ? 1 : 0;
	target.clientErrors += status.clientError ? 1 : 0;
	target.serverErrors += status.serverError ? 1 : 0;
	target.authChallenges += status.authChallenge ? 1 : 0;
	target.upstreamErrors += status.upstreamError ? 1 : 0;
	target.errors += status.serverError ? 1 : 0;
	target.bytes += bytes;
	target.durationMs += durationMs;
}

function pruneRuleStats() {
	const keys = Object.keys(state.ruleStats);
	if (keys.length <= MAX_RULE_STATS) return;
	keys
		.map(key => ({ key, lastSeenAt: state.ruleStats[key].lastSeenAt || '', requests: state.ruleStats[key].requests || 0 }))
		.sort((a, b) => {
			if (a.key === 'unmatched') return 1;
			if (b.key === 'unmatched') return -1;
			return (a.lastSeenAt || '').localeCompare(b.lastSeenAt || '') || a.requests - b.requests;
		})
		.slice(0, keys.length - MAX_RULE_STATS)
		.forEach(item => delete state.ruleStats[item.key]);
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
			...emptyCounters(),
			active: 0,
			lastStatus: null,
			lastSeenAt: null
		};
		pruneRuleStats();
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
		pruneRuleStats();
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
		const normalizedRules = {};
		Object.entries(data.ruleStats || {}).forEach(([key, value]) => {
			normalizedRules[key] = {
				key,
				kind: value.kind || 'http',
				domain: value.domain || '',
				path: value.path || '/',
				target: value.target || '',
				protocol: value.protocol || '',
				...emptyCounters(),
				...value,
				errors: value.errors != null ? value.errors : value.serverErrors || 0,
				serverErrors: value.serverErrors != null ? value.serverErrors : value.errors || 0,
				active: 0,
				lastStatus: value.lastStatus || null,
				lastSeenAt: value.lastSeenAt || null
			};
		});
		state = {
			...emptyState(),
			...data,
			totalErrors: data.totalErrors != null ? data.totalErrors : data.totalServerErrors || 0,
			totalServerErrors: data.totalServerErrors != null ? data.totalServerErrors : data.totalErrors || 0,
			totalClientErrors: data.totalClientErrors || 0,
			totalAuthChallenges: data.totalAuthChallenges || 0,
			totalUpstreamErrors: data.totalUpstreamErrors || 0,
			totalSuccesses: data.totalSuccesses || 0,
			totalRedirects: data.totalRedirects || 0,
			activeHttp: 0,
			activeWs: 0,
			ruleStats: normalizedRules,
			minuteBuckets: Array.isArray(data.minuteBuckets) ? data.minuteBuckets.map(normalizeBucket) : []
		};
		pruneBuckets();
		pruneRuleStats();
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
	state.activeHttp = Math.max(0, state.activeHttp - 1);
	const status = classifyStatus(statusCode);
	state.totalRequests += 1;
	state.totalSuccesses += status.success ? 1 : 0;
	state.totalRedirects += status.redirect ? 1 : 0;
	state.totalClientErrors += status.clientError ? 1 : 0;
	state.totalServerErrors += status.serverError ? 1 : 0;
	state.totalAuthChallenges += status.authChallenge ? 1 : 0;
	state.totalUpstreamErrors += status.upstreamError ? 1 : 0;
	state.totalErrors += status.serverError ? 1 : 0;
	state.totalBytes += bytes;
	state.totalDurationMs += durationMs;

	const bucket = getBucket();
	applyCounters(bucket, statusCode, bytes, durationMs);

	const ruleState = getRule(sample && sample.rule);
	ruleState.active = Math.max(0, ruleState.active - 1);
	applyCounters(ruleState, statusCode, bytes, durationMs);
	ruleState.lastStatus = statusCode || null;
	ruleState.lastSeenAt = new Date().toISOString();
	touch();
	scheduleFlush();
}

function openWs(rule) {
	state.activeWs += 1;
	state.totalRequests += 1;
	state.totalSuccesses += 1;
	const bucket = getBucket();
	applyCounters(bucket, 101, 0, 0);
	const ruleState = getRule(rule);
	ruleState.active += 1;
	applyCounters(ruleState, 101, 0, 0);
	ruleState.lastStatus = 101;
	ruleState.lastSeenAt = new Date().toISOString();
	touch();
	scheduleFlush();
	return { rule, openedAt: Date.now() };
}

function closeWs(sample, hadError) {
	state.activeWs = Math.max(0, state.activeWs - 1);
	if (hadError) {
		state.totalServerErrors += 1;
		state.totalUpstreamErrors += 1;
		state.totalErrors += 1;
	}
	const bucket = getBucket();
	if (hadError) {
		bucket.serverErrors += 1;
		bucket.upstreamErrors += 1;
		bucket.errors += 1;
	}
	const ruleState = getRule(sample && sample.rule);
	ruleState.active = Math.max(0, ruleState.active - 1);
	if (hadError) {
		ruleState.serverErrors += 1;
		ruleState.upstreamErrors += 1;
		ruleState.errors += 1;
	}
	ruleState.lastSeenAt = new Date().toISOString();
	touch();
	scheduleFlush();
}

function recordUnmatched(kind = 'http', statusCode = 200, bytes = 0, durationMs = 0) {
	state.totalRequests += 1;
	const status = classifyStatus(statusCode);
	state.totalSuccesses += status.success ? 1 : 0;
	state.totalRedirects += status.redirect ? 1 : 0;
	state.totalClientErrors += status.clientError ? 1 : 0;
	state.totalServerErrors += status.serverError ? 1 : 0;
	state.totalAuthChallenges += status.authChallenge ? 1 : 0;
	state.totalUpstreamErrors += status.upstreamError ? 1 : 0;
	state.totalErrors += status.serverError ? 1 : 0;
	state.totalBytes += bytes;
	state.totalDurationMs += durationMs;
	const bucket = getBucket();
	applyCounters(bucket, statusCode, bytes, durationMs);
	const ruleState = getRule({ key: 'unmatched', kind, path: '', target: '', protocol: '' });
	applyCounters(ruleState, statusCode, bytes, durationMs);
	ruleState.lastStatus = statusCode;
	ruleState.lastSeenAt = new Date().toISOString();
	touch();
	scheduleFlush();
}

function readSnapshot() {
	try {
		const data = fs.existsSync(STATS_FILE) ? JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')) : state;
		return buildSnapshot(data);
	} catch (error) {
		return buildSnapshot(emptyState());
	}
}

loadPersistedState();

module.exports = {
	beginHttp,
	finishHttp,
	openWs,
	closeWs,
	recordUnmatched,
	readSnapshot,
	flush
};
