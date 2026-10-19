"use strict";

const assert = require('assert');
const express = require('express');
const helper = require("../../helper.js");
const requester = require('../requester');
let Controller = helper.requireModule('./server/controller');
let localConfig = helper.requireModule('./config.js');

let mock = require('../UC2-http-methods/service-mock/index.js');

//NOTE: the users of these tokens live in tenant HOME, the key belongs to tenant DBTN which names
//		the department resolver in its profile
const memberToken = "d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d901";
const outsiderToken = "d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d902";
const ownerToken = "cfb209a91b23896820f510aadbf1f4284b512123";

function startResolver(calls, callback) {
	const sApp = express();
	const mApp = express();
	sApp.use(express.json());
	sApp.post('/tenant/access', (req, res) => {
		calls.push({ "body": req.body, "injectObj": JSON.parse(req.headers.soajsinjectobj) });
		if (req.body.user.username === "dept_member" && req.body.subject === "dept_1") {
			return res.json({
				"result": true,
				"data": {
					"access": true,
					"groups": ["member"],
					"groupsConfig": { "allowedPackages": { "DSBRD": ["DSBRD_OWNER"] } }
				}
			});
		}
		return res.json({ "result": true, "data": { "access": false } });
	});
	mApp.get('/heartbeat', (req, res) => {
		res.json({ "result": true, "ts": Date.now(), "service": { "service": "departments", "type": "rest", "route": "/heartbeat" } });
	});
	let sAppServer = sApp.listen(4013, () => {
		let mAppServer = mApp.listen(5014, () => {
			return callback({ "sAppServer": sAppServer, "mAppServer": mAppServer, "name": "departments" });
		});
	});
}

describe("Integration for Usecase 5 - tenant access resolver", function () {
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
	let httpmethods = null;
	let resolver = null;
	let calls = [];

	function call(token, cb) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/httpmethods/myroute',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			},
			"qs": {
				access_token: token
			}
		};
		requester('get', options, cb);
	}

	before((done) => {
		startResolver(calls, (servers) => {
			resolver = servers;
			mock.startServer(null, function (servers) {
				httpmethods = servers;
			});
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
	beforeEach(() => {
		calls.length = 0;
	});

	it("department member switching to the tenant gets the resolver ACL", function (done) {
		call(memberToken, (error, body) => {
			assert.ifError(error);
			assert.ok(body);
			assert.strictEqual(body.result, true, JSON.stringify(body.errors));
			assert.deepStrictEqual(body.data.method, 'GET');
			assert.strictEqual(calls.length, 1);
			assert.deepStrictEqual(calls[0].body, {
				"user": {
					"id": "5c8d0c505653de3985aa1001",
					"username": "dept_member",
					"tenant": { "id": "5c0e74ba9acc3c5a84a51260", "code": "HOME" }
				},
				"tenant": { "id": "5c0e74ba9acc3c5a84a51259", "code": "DBTN" },
				"subject": "dept_1"
			});
			assert.strictEqual(calls[0].injectObj.tenant.id, "5c0e74ba9acc3c5a84a51259");
			assert.strictEqual(calls[0].injectObj.application.product, "DSBRD");
			done();
		});
	});

	it("user outside the department is refused after the urac fallback", function (done) {
		call(outsiderToken, (error, body) => {
			assert.ok(body);
			assert.strictEqual(body.result, false);
			assert.deepStrictEqual(body.errors.codes, [146]);
			assert.strictEqual(calls.length, 1);
			done();
		});
	});

	it("user of the tenant itself does not call the resolver", function (done) {
		call(ownerToken, (error, body) => {
			assert.ifError(error);
			assert.ok(body);
			assert.strictEqual(body.result, true, JSON.stringify(body.errors));
			assert.strictEqual(calls.length, 0);
			done();
		});
	});

	after((done) => {
		mock.killServer(httpmethods);
		resolver.sAppServer.close();
		resolver.mAppServer.close();
		c.stop(registry, log, service, server, serverMaintenance, () => {
			done();
		});
	});
});
