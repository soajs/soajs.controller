"use strict";

const helper = require("../../../helper.js");
const assert = require('assert');
const coreModules = require('soajs.core.modules');

const emitter = helper.requireModule('./mw/events/emitter');

describe("Unit test for: mw - events emitter", () => {
	let logs;
	let log = {"error": (m) => logs.push(m), "info": () => {}, "debug": () => {}};
	let registry = {"custom": {"gateway": {"value": {"events": {"enabled": true, "sink": "log"}}}}};

	beforeEach(() => {
		logs = [];
	});

	it("a full queue drops and counts without waiting", (done) => {
		emitter.init(log, () => registry);
		let release = null;
		let written = 0;
		emitter.setTestSink({
			"write": (batch, cb) => {
				release = () => {
					written += batch.length;
					cb();
				};
			}
		});
		let accepted = 0;
		let start = Date.now();
		for (let i = 0; i < 1000; i++) {
			if (emitter.emit({"method": "GET", "status": 200}, {"queueSize": 4})) {
				accepted++;
			}
		}
		assert.ok(Date.now() - start < 200);
		assert.strictEqual(accepted, 4);
		assert.strictEqual(emitter.stats().dropped, 996);
		emitter.flush(() => {
			assert.strictEqual(written, 4);
			done();
		});
		setTimeout(() => release(), 20);
	});

	it("a failing sink drops the batch and counts it; reports are rate limited, with the totals", (done) => {
		emitter.init(log, () => registry);
		emitter.setTestSink({"write": (batch, cb) => cb(new Error("down"))});
		for (let i = 0; i < 450; i++) {
			emitter.emit({"method": "GET", "status": 200}, {});
		}
		emitter.flush(() => {
			let stats = emitter.stats();
			assert.strictEqual(stats.dropped, 450);
			assert.strictEqual(stats.failures, 3);
			// the first report, then one forced by the flush with the totals
			assert.ok(logs.length <= 2, logs.join("\n"));
			assert.ok(logs[logs.length - 1].indexOf("450 dropped, 3 sink failures") !== -1, logs.join("\n"));
			done();
		});
	});

	it("the mongo sink: a time-series collection, Int32 integers", function (done) {
		this.timeout(10000);
		let dbConfig = {"name": "test_call_events", "prefix": "", "servers": [{"host": "127.0.0.1", "port": 27017}], "credentials": null, "streaming": {}, "URLParam": {}};
		let mongoRegistry = {
			"coreDB": {"gateway": dbConfig},
			"custom": {"gateway": {"value": {"events": {"enabled": true, "sink": "mongo", "mongo": {"db": "gateway", "collection": "call_events"}}}}}
		};
		let client = new coreModules.mongo(dbConfig);
		client.getMongoDB().then((db) => db.dropDatabase().then(() => db)).then((db) => {
			emitter.init(log, () => mongoRegistry);
			emitter.emit({"ts": new Date(), "durationMs": 12, "env": "dev", "method": "GET", "status": 200, "code": 154, "tenant": {"id": "t1", "code": "T1"}}, {});
			emitter.flush(() => {
				db.listCollections({"name": "call_events"}).toArray().then((list) => {
					assert.strictEqual(list.length, 1);
					assert.strictEqual(list[0].type, "timeseries");
					assert.strictEqual(list[0].options.timeseries.timeField, "ts");
					assert.strictEqual(list[0].options.timeseries.metaField, "tenant");
					return db.collection("call_events").find({}, {"promoteValues": false}).toArray();
				}).then((docs) => {
					assert.strictEqual(docs.length, 1);
					["durationMs", "status", "code"].forEach((field) => {
						assert.strictEqual(docs[0][field]._bsontype, "Int32", field);
					});
					return db.dropDatabase();
				}).then(() => {
					client.closeDb && client.closeDb();
					done();
				}).catch(done);
			});
		}).catch(done);
	});
});
