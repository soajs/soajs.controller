'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

/**
 * Writes call events off the request path: a bounded queue, and a worker that writes batches
 * (up to BATCH_SIZE events, at least every FLUSH_MS) to the sink the custom registry
 * gateway.events names: a time-series collection in a core database (mongo) or the log (log).
 * When the queue is full an event is dropped and counted; a request never waits. Drops and sink
 * failures are logged at most once a minute, with the running total.
 */

const core = require('soajs.core.modules');
const Mongo = core.mongo;

const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);

const DEFAULT_QUEUE_SIZE = 10000;
const BATCH_SIZE = 200;
const FLUSH_MS = 1000;
const REPORT_MS = 60000;

let state = null;
let signalHooked = false;

function newState(log, registry) {
	return {
		"log": log,
		"registry": registry,
		"queue": [],
		"size": DEFAULT_QUEUE_SIZE,
		"started": false,
		"writing": false,
		"timer": null,
		"dropped": 0,
		"written": 0,
		"failures": 0,
		"reportedDropped": 0,
		"reportedFailures": 0,
		"lastReport": 0,
		"sinkKey": null,
		"sink": null,
		"reported": {}
	};
}

/**
 * @param log the gateway's logger
 * @param registry () => the registry
 */
function init(log, registry) {
	if (state && state.timer) {
		clearInterval(state.timer);
	}
	state = newState(log, registry);
	//NOTE: on the graceful stop (lib/shutdown.js) the events still queued are written
	if (!signalHooked) {
		signalHooked = true;
		require('../../lib/shutdown.js').register("call events", (signal, done) => flush(() => {
			if (state && state.timer) {
				clearInterval(state.timer);
				state.timer = null;
			}
			return done();
		}));
	}
}

function configOf(registry) {
	let events = get(["custom", "gateway", "value", "events"], registry);
	if (!events || events.enabled !== true) {
		return null;
	}
	return events;
}

function logOnce(id, message) {
	if (!state.reported[id]) {
		state.reported[id] = true;
		state.log.error(message);
	}
}

function report(force) {
	let now = Date.now();
	if (!force && now - state.lastReport < REPORT_MS) {
		return;
	}
	if (state.dropped !== state.reportedDropped || state.failures !== state.reportedFailures) {
		state.log.error("Call events: " + state.dropped + " dropped, " + state.failures + " sink failures so far");
		state.reportedDropped = state.dropped;
		state.reportedFailures = state.failures;
		state.lastReport = now;
	}
}

/**
 * The sink of the current configuration, kept while it does not change.
 */
function resolveSink(cb) {
	let registry = state.registry();
	let config = configOf(registry);
	if (!config) {
		return cb(null, null);
	}
	if (state.testSink) {
		return cb(null, state.testSink);
	}
	let mongo = config.mongo || {};
	let key = config.sink + "|" + mongo.db + "|" + mongo.collection;
	if (state.sink && state.sinkKey === key) {
		return cb(null, state.sink);
	}
	if (config.sink === "log") {
		state.sink = {
			"write": (batch, done) => {
				batch.forEach((event) => state.log.info("call event", JSON.stringify(event)));
				return done();
			}
		};
		state.sinkKey = key;
		return cb(null, state.sink);
	}
	if (config.sink !== "mongo") {
		logOnce("sink-" + config.sink, "configuration error: unknown call events sink [" + config.sink + "]; it can only be [mongo || log]");
		return cb(null, null);
	}
	if (!mongo.db || !mongo.collection) {
		logOnce("mongo-config", "configuration error: call events mongo needs db and collection");
		return cb(null, null);
	}
	let dbConfig = get(["coreDB", mongo.db], registry);
	if (!dbConfig) {
		logOnce("mongo-db-" + mongo.db, "configuration error: call events mongo db [" + mongo.db + "] is not a core database of the environment");
		return cb(null, null);
	}
	let client = new Mongo(dbConfig);
	client.getMongoDB().then((db) => {
		let options = {"timeseries": {"timeField": "ts", "metaField": "tenant", "granularity": "seconds"}};
		return db.createCollection(mongo.collection, options).catch((error) => {
			// 48: NamespaceExists, the collection is used as it is
			if (error && error.code === 48) {
				return null;
			}
			throw error;
		}).then(() => db.collection(mongo.collection));
	}).then((collection) => {
		state.sink = {
			"write": (batch, done) => {
				collection.insertMany(batch, {"ordered": false}).then(() => done()).catch((error) => done(error));
			}
		};
		state.sinkKey = key;
		return cb(null, state.sink);
	}).catch((error) => cb(error));
}

/**
 * Writes the next batch; calls back when the queue holds no full batch or the write is done.
 */
function writeBatch(done) {
	if (state.writing || state.queue.length === 0) {
		return done();
	}
	state.writing = true;
	let batch = state.queue.splice(0, BATCH_SIZE);
	let finish = (error) => {
		if (error) {
			state.failures++;
			state.dropped += batch.length;
		} else {
			state.written += batch.length;
		}
		state.writing = false;
		report(false);
		return done();
	};
	resolveSink((error, sink) => {
		if (error || !sink) {
			if (error) {
				state.log.error("Call events: no sink: " + error.message);
			}
			state.dropped += batch.length;
			state.writing = false;
			report(false);
			return done();
		}
		sink.write(batch, finish);
	});
}

function start(size) {
	state.started = true;
	if (typeof size === "number" && size > 0) {
		state.size = size;
	}
	state.timer = setInterval(() => writeBatch(() => report(false)), FLUSH_MS);
	if (state.timer.unref) {
		state.timer.unref();
	}
}

/**
 * Queues an event without waiting; when the queue is full the event is dropped and counted.
 *
 * @param event the call event
 * @param config gateway.events, its queueSize read when the first event is queued
 * @returns {boolean} queued
 */
function emit(event, config) {
	if (!state) {
		return false;
	}
	if (!state.started) {
		start(config && config.queueSize);
	}
	if (state.queue.length >= state.size) {
		state.dropped++;
		return false;
	}
	state.queue.push(event);
	if (state.queue.length >= BATCH_SIZE) {
		setImmediate(() => writeBatch(() => {}));
	}
	return true;
}

/**
 * Writes everything queued, then calls back.
 */
function flush(cb) {
	if (!state) {
		return cb();
	}
	let next = () => {
		if (state.queue.length === 0 && !state.writing) {
			report(true);
			return cb();
		}
		if (state.writing) {
			return setTimeout(next, 10);
		}
		writeBatch(next);
	};
	next();
}

function stats() {
	return state ? {"queued": state.queue.length, "dropped": state.dropped, "written": state.written, "failures": state.failures} : null;
}

// tests: a sink {write(batch, done)} used whatever the configuration
function setTestSink(sink) {
	state.testSink = sink;
}

module.exports = {init, emit, flush, stats, configOf, setTestSink, "BATCH_SIZE": BATCH_SIZE};
