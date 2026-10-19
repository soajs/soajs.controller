"use strict";

const assert = require('assert');
const crypto = require('crypto');
const express = require('express');
const request = require('request');
const helper = require("../../helper.js");
let Controller = helper.requireModule('./server/controller');
let localConfig = helper.requireModule('./config.js');

//NOTE: the gateway custom registry turns idempotency on with the mongo model for every route of the
//		idempotent service, and throttles /throttled to one call per minute
const ownerToken = "cfb209a91b23896820f510aadbf1f4284b512123";

function startService(calls, callback) {
	const sApp = express();
	const mApp = express();
	let failed = false;
	let count = (route) => {
		calls[route] = (calls[route] || 0) + 1;
	};
	sApp.post('/ok', (req, res) => {
		count("ok");
		res.json({ "result": true, "data": { "call": calls.ok } });
	});
	sApp.post('/fail', (req, res) => {
		count("fail");
		if (!failed) {
			failed = true;
			return res.status(503).json({ "result": false, "errors": { "codes": [503], "details": [{ "code": 503, "message": "unavailable" }] } });
		}
		res.json({ "result": true, "data": { "call": calls.fail } });
	});
	sApp.post('/bad', (req, res) => {
		count("bad");
		res.status(400).json({ "result": false, "errors": { "codes": [400], "details": [{ "code": 400, "message": "bad input" }] } });
	});
	sApp.post('/slow', (req, res) => {
		count("slow");
		setTimeout(() => {
			res.json({ "result": true, "data": { "call": calls.slow } });
		}, 1500);
	});
	sApp.post('/throttled', (req, res) => {
		count("throttled");
		res.json({ "result": true, "data": { "call": calls.throttled } });
	});
	mApp.get('/heartbeat', (req, res) => {
		res.json({ "result": true, "ts": Date.now(), "service": { "service": "idempotent", "type": "rest", "route": "/heartbeat" } });
	});
	let sAppServer = sApp.listen(4014, () => {
		let mAppServer = mApp.listen(5015, () => {
			return callback({ "sAppServer": sAppServer, "mAppServer": mAppServer });
		});
	});
}

describe("Integration for Usecase 6 - idempotency", function () {
	let extKey = "3d90163cf9d6b3076ad26aa5ed58556348069258e5c6c941ee0f18448b570ad1c5c790e2d2a1989680c55f4904e2005ff5f8e71606e4aa641e67882f4210ebbc5460ff305dcb36e6ec2a2299cf0448ef60b9e38f41950ec251c1cf41f05f3ce9";

	let c = new Controller({
		"serviceName": localConfig.serviceName,
		"serviceVersion": localConfig.serviceVersion,
		"serviceGroup": localConfig.serviceGroup,
		"servicePort": localConfig.servicePort,
		"maintenance": localConfig.maintenance
	});
	let registry = null;
	let log = null;
	let service = null;
	let server = null;
	let serverMaintenance = null;
	let mockServers = null;
	let calls = {};

	function call(route, key, cb) {
		request.post({
			"uri": 'http://127.0.0.1:' + localConfig.servicePort + '/idempotent' + route,
			"json": true,
			"headers": {
				"key": extKey,
				"idempotency-key": key,
				"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2227.1 Safari/537.36"
			},
			"qs": { "access_token": ownerToken }
		}, (error, response, body) => {
			assert.ifError(error);
			return cb(response.statusCode, body);
		});
	}

	before((done) => {
		//NOTE: the unit tests run in the same process and connect the idempotency mongo model to a dummy
		//		database, the model connects only once, drop it so the gateway connects it to the real one
		helper.requireModule('./mw/idempotency/model/mongo').mongo = null;
		startService(calls, (servers) => {
			mockServers = servers;
			c.init((_registry, _log, _service, _server, _serverMaintenance) => {
				registry = _registry;
				log = _log;
				service = _service;
				server = _server;
				serverMaintenance = _serverMaintenance;
				c.start(registry, log, service, server, serverMaintenance, () => {
					setTimeout(function () {
						done();
					}, 5000);
				});
			});
		});
	});

	it("a service answer is completed and replayed", function (done) {
		let key = crypto.randomUUID();
		call("/ok", key, (status, body) => {
			assert.strictEqual(status, 200, JSON.stringify(body));
			assert.strictEqual(calls.ok, 1);
			call("/ok", key, (status, body) => {
				assert.strictEqual(status, 200);
				assert.strictEqual(body.data.call, 1);
				assert.strictEqual(calls.ok, 1);
				done();
			});
		});
	});

	it("a 4xx of the service is completed and replayed", function (done) {
		let key = crypto.randomUUID();
		call("/bad", key, (status) => {
			assert.strictEqual(status, 400);
			call("/bad", key, (status) => {
				assert.strictEqual(status, 400);
				assert.strictEqual(calls.bad, 1);
				done();
			});
		});
	});

	it("a 5xx of the service releases the key, the retry reaches the service", function (done) {
		let key = crypto.randomUUID();
		call("/fail", key, (status) => {
			assert.strictEqual(status, 503);
			call("/fail", key, (status, body) => {
				assert.strictEqual(status, 200, JSON.stringify(body));
				assert.strictEqual(calls.fail, 2);
				call("/fail", key, (status, body) => {
					assert.strictEqual(status, 200);
					assert.strictEqual(body.data.call, 2);
					assert.strictEqual(calls.fail, 2);
					done();
				});
			});
		});
	});

	it("a duplicate while the first is running gets 409/181", function (done) {
		let key = crypto.randomUUID();
		let first = null;
		call("/slow", key, (status) => {
			first = status;
		});
		setTimeout(() => {
			call("/slow", key, (status, body) => {
				assert.strictEqual(status, 409);
				assert.deepStrictEqual(body.errors.codes, [181]);
				setTimeout(() => {
					assert.strictEqual(first, 200);
					assert.strictEqual(calls.slow, 1);
					done();
				}, 2000);
			});
		}, 300);
	});

	it("a throttled request releases the key, the retry is not refused with 409", function (done) {
		call("/throttled", crypto.randomUUID(), (status, body) => {
			assert.strictEqual(status, 200, JSON.stringify(body));
			let key = crypto.randomUUID();
			call("/throttled", key, (status) => {
				assert.strictEqual(status, 429);
				call("/throttled", key, (status, body) => {
					assert.strictEqual(status, 429, JSON.stringify(body));
					assert.strictEqual(calls.throttled, 1);
					done();
				});
			});
		});
	});

	after((done) => {
		mockServers.sAppServer.close();
		mockServers.mAppServer.close();
		c.stop(registry, log, service, server, serverMaintenance, () => {
			done();
		});
	});
});
