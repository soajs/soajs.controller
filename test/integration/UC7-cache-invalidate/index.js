"use strict";

const assert = require('assert');
const express = require('express');
const request = require('request');
const helper = require("../../helper.js");
let Controller = helper.requireModule('./server/controller');
let localConfig = helper.requireModule('./config.js');

//NOTE: the gateway custom registry caches the spaces service with the mongo model, per user except
//		/catalog which is per tenant. Both tokens are users of the console tenant.
const tenantId = "5c0e74ba9acc3c5a84a51259";
const ownerToken = "cfb209a91b23896820f510aadbf1f4284b512123";
const ownerId = "5c8d0c505653de3985aa0ffd";
const secondToken = "c4c4e5e5f6f6a7a7b8b8c9c9d0d0e1e1f2f2a301";
const secondId = "5c8d0c505653de3985aa2001";
const maintenanceUri = 'http://127.0.0.1:5001/cache/invalidate';

function startService(calls, callback) {
	const sApp = express();
	const mApp = express();
	let answer = (name) => (req, res) => {
		calls[name] = (calls[name] || 0) + 1;
		res.json({ "result": true, "data": { "call": calls[name], "url": req.url } });
	};
	sApp.get('/spaces', answer("spaces"));
	sApp.get('/space/:id', answer("space"));
	sApp.get('/catalog', answer("catalog"));
	sApp.get('/slow', (req, res) => {
		calls.slow = (calls.slow || 0) + 1;
		let call = calls.slow;
		setTimeout(() => {
			res.json({ "result": true, "data": { "call": call } });
		}, 1000);
	});
	mApp.get('/heartbeat', (req, res) => {
		res.json({ "result": true, "ts": Date.now(), "service": { "service": "spaces", "type": "rest", "route": "/heartbeat" } });
	});
	let sAppServer = sApp.listen(4015, () => {
		let mAppServer = mApp.listen(5016, () => {
			return callback({ "sAppServer": sAppServer, "mAppServer": mAppServer });
		});
	});
}

describe("Integration for Usecase 7 - cache invalidation", function () {
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

	// GET through the gateway, resolves with the X-Cache header and the body
	function get(path, token) {
		return new Promise((resolve) => {
			request.get({
				"uri": 'http://127.0.0.1:' + localConfig.servicePort + '/spaces' + path,
				"json": true,
				"headers": {
					"key": extKey,
					"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2227.1 Safari/537.36"
				},
				"qs": { "access_token": token }
			}, (error, response, body) => {
				assert.ifError(error);
				resolve({ "cache": response.headers['x-cache'], "status": response.statusCode, body });
			});
		});
	}

	function invalidate(body, method) {
		return new Promise((resolve) => {
			request({
				"method": method || 'POST',
				"uri": maintenanceUri,
				"json": body === undefined ? true : body
			}, (error, response, responseBody) => {
				assert.ifError(error);
				resolve({ "status": response.statusCode, "body": responseBody });
			});
		});
	}

	// the response is stored once the proxy finishes, after the client got it
	const settle = () => new Promise((r) => setTimeout(r, 150));

	before((done) => {
		//NOTE: the unit tests run in the same process and connect the cache mongo model to a dummy
		//		database, the model connects only once, drop it so the gateway connects it to the real one
		helper.requireModule('./mw/cache/model/mongo').mongo = null;
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

	it("a cached response is served from the cache", async () => {
		let first = await get('/spaces', ownerToken);
		assert.strictEqual(first.status, 200, JSON.stringify(first.body));
		assert.strictEqual(first.cache, 'MISS');
		await settle();
		let second = await get('/spaces', ownerToken);
		assert.strictEqual(second.cache, 'HIT');
		assert.strictEqual(second.body.data.call, first.body.data.call);
	});

	it("one user: every query variant of the api is removed, the other user keeps theirs", async () => {
		await get('/spaces?page=1', ownerToken);
		await get('/spaces?page=2', ownerToken);
		await get('/spaces', secondToken);
		await settle();
		assert.strictEqual((await get('/spaces?page=1', ownerToken)).cache, 'HIT');
		assert.strictEqual((await get('/spaces', secondToken)).cache, 'HIT');

		let outcome = await invalidate({ "tenant": tenantId, "service": "spaces", "api": "GET /spaces", "user": ownerId });
		assert.strictEqual(outcome.status, 200, JSON.stringify(outcome.body));
		assert.strictEqual(outcome.body.result, true);
		assert.strictEqual(outcome.body.data.removed, 3);

		assert.strictEqual((await get('/spaces', ownerToken)).cache, 'MISS');
		assert.strictEqual((await get('/spaces?page=1', ownerToken)).cache, 'MISS');
		assert.strictEqual((await get('/spaces?page=2', ownerToken)).cache, 'MISS');
		assert.strictEqual((await get('/spaces', secondToken)).cache, 'HIT');
	});

	it("without a user every user's entries are removed", async () => {
		await settle();
		assert.strictEqual((await get('/spaces', ownerToken)).cache, 'HIT');
		assert.strictEqual((await get('/spaces', secondToken)).cache, 'HIT');
		let outcome = await invalidate({ "tenant": tenantId, "service": "spaces", "api": "GET /spaces" });
		assert.strictEqual(outcome.status, 200);
		assert.ok(outcome.body.data.removed >= 2);
		assert.strictEqual((await get('/spaces', ownerToken)).cache, 'MISS');
		assert.strictEqual((await get('/spaces', secondToken)).cache, 'MISS');
	});

	it("an api with a path param is removed for every value", async () => {
		await get('/space/1', ownerToken);
		await get('/space/2', ownerToken);
		await settle();
		assert.strictEqual((await get('/space/1', ownerToken)).cache, 'HIT');
		let outcome = await invalidate({ "tenant": tenantId, "service": "spaces", "api": "GET /space/:id", "user": ownerId });
		assert.strictEqual(outcome.body.data.removed, 2);
		assert.strictEqual((await get('/space/1', ownerToken)).cache, 'MISS');
		assert.strictEqual((await get('/space/2', ownerToken)).cache, 'MISS');
	});

	it("a tenant scoped entry is shared by users, and removed without a user", async () => {
		await get('/catalog', ownerToken);
		await settle();
		assert.strictEqual((await get('/catalog', secondToken)).cache, 'HIT');
		let outcome = await invalidate({ "tenant": tenantId, "service": "spaces", "api": "GET /catalog" });
		assert.strictEqual(outcome.body.data.removed, 1);
		assert.strictEqual((await get('/catalog', secondToken)).cache, 'MISS');
	});

	it("a request that started before the invalidation is not stored", async () => {
		let inFlight = get('/slow', ownerToken);
		await new Promise((r) => setTimeout(r, 300));
		let outcome = await invalidate({ "tenant": tenantId, "service": "spaces", "api": "GET /slow", "user": ownerId });
		assert.strictEqual(outcome.status, 200);
		let first = await inFlight;
		assert.strictEqual(first.status, 200);
		await settle();
		let next = await get('/slow', ownerToken);
		assert.strictEqual(next.cache, 'MISS');
		assert.strictEqual(next.body.data.call, first.body.data.call + 1);
		await settle();
		assert.strictEqual((await get('/slow', ownerToken)).cache, 'HIT');
	});

	it("refuses an invalid request", async () => {
		assert.strictEqual((await invalidate({ "service": "spaces" })).status, 400);
		assert.strictEqual((await invalidate({ "tenant": tenantId, "service": "spaces", "api": "/spaces" })).status, 400);
		let wrongMethod = await invalidate(undefined, 'GET');
		assert.strictEqual(wrongMethod.status, 405);
		assert.strictEqual(wrongMethod.body.result, false);
	});

	after((done) => {
		mockServers.sAppServer.close();
		mockServers.mAppServer.close();
		c.stop(registry, log, service, server, serverMaintenance, () => {
			done();
		});
	});
});
