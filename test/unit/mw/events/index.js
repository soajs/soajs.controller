"use strict";

const helper = require("../../../helper.js");
const assert = require('assert');
const EventEmitter = require('events');

const mw = helper.requireModule('./mw/events/index');
const apiPathParam2apiRegExp = helper.requireModule('./lib/apiPathParam2apiRegExp');

const SECRET_KEY = "5bbf311a30f4acaec52b7472be854cc9secret";

describe("Unit test for: mw - events, the call event", () => {
	let got;
	let registry;

	let run = (prepare, answer, done) => {
		let req = {
			"method": "GET",
			"headers": {"key": SECRET_KEY, "authorization": "Bearer tok456"},
			"query": {"secret": "qvalue", "access_token": "tok123"},
			"getClientIP": () => "10.1.2.3",
			"soajs": {
				"registry": registry,
				"controller": {"serviceParams": {"service_n": "orders", "service_v": "1"}},
				"controllerResponse": function () {}
			}
		};
		let res = new EventEmitter();
		res.statusCode = 200;
		let functionMw = mw({
			"log": {"error": () => {}, "info": () => {}, "debug": () => {}},
			"registry": () => registry,
			"regEnvironment": "DEV",
			"serviceName": "controller",
			"serviceVersion": "1"
		});
		mw.emitter.setTestSink({
			"write": (batch, cb) => {
				got = got.concat(batch);
				return cb();
			}
		});
		functionMw(req, res, () => {
			if (prepare) {
				prepare(req);
			}
			answer(req, res);
			res.emit('finish');
			mw.emitter.flush(() => done(req));
		});
	};

	let config = (extra) => {
		registry = {"custom": {"gateway": {"value": {"events": Object.assign({"enabled": true, "sink": "log"}, extra || {})}}}};
	};

	beforeEach(() => {
		got = [];
		config();
	});

	it("off: nothing is wrapped and no event is written", (done) => {
		registry = {"custom": {"gateway": {"value": {"events": {"enabled": false, "sink": "log"}}}}};
		let original = null;
		let req = {"soajs": {"registry": registry, "controllerResponse": function () {}}};
		original = req.soajs.controllerResponse;
		let functionMw = mw({"log": {"error": () => {}}, "registry": () => registry});
		functionMw(req, new EventEmitter(), () => {
			assert.strictEqual(req.soajs.controllerResponse, original);
			assert.strictEqual(req.soajs.callEvent, undefined);
			done();
		});
	});

	it("the fields; the route, not the path; no key, token, query value or body", (done) => {
		let acl = apiPathParam2apiRegExp({"access": true, "apis": {"/orders/:id": {"access": true}}});
		run((req) => {
			let sp = req.soajs.controller.serviceParams;
			sp.name = "orders";
			sp.version = "1";
			sp.path = "/orders/7";
			sp.finalAcl = acl;
			sp.keyObj = {
				"tenant": {"id": "tenant-123", "code": "MYTEN", "main": {"id": "main-1", "code": "MAIN"}, "key": {"iKey": "ikey", "eKey": SECRET_KEY}},
				"application": {"product": "PROD", "package": "P_PKG", "appId": "app1"}
			};
			req.oauth = {"bearerToken": {"user": {"id": "u1", "username": "agent1", "restrictedTo": {"tenant": "tenant-123", "key": SECRET_KEY}}}};
			req.soajs.callEvent.cache = "HIT";
		}, (req, res) => {
			res.statusCode = 200;
		}, () => {
			assert.strictEqual(got.length, 1);
			let ev = got[0];
			assert.ok(ev.ts instanceof Date);
			assert.ok(Number.isInteger(ev.durationMs) && ev.durationMs >= 0);
			assert.ok(ev.requestId);
			assert.deepStrictEqual(Object.assign({}, ev, {"ts": null, "durationMs": null, "requestId": null}), {
				"ts": null, "durationMs": null, "requestId": null,
				"env": "dev",
				"tenant": {"id": "tenant-123", "code": "MYTEN", "main": {"id": "main-1", "code": "MAIN"}},
				"product": "PROD", "package": "P_PKG", "appId": "app1",
				"user": {"id": "u1", "username": "agent1", "agent": true},
				"service": "orders", "version": "1", "method": "GET", "api": "/orders/:id",
				"status": 200, "cache": "HIT", "ip": "10.1.2.3"
			});
			let text = JSON.stringify(ev);
			[SECRET_KEY, "tok123", "tok456", "qvalue", "Bearer", "ikey"].forEach((secret) => {
				assert.strictEqual(text.indexOf(secret), -1, "the event carries " + secret);
			});
			done();
		});
	});

	it("a refusal: its status and SOAJS code; no route matched, no api", (done) => {
		run((req) => {
			req.soajs.controller.serviceParams.path = "/elsewhere";
			req.soajs.controller.serviceParams.finalAcl = apiPathParam2apiRegExp({"apis": {"/orders/:id": {}}});
		}, (req, res) => {
			res.statusCode = 401;
			req.soajs.controllerResponse({"code": 154, "msg": "x", "status": 401});
		}, () => {
			assert.strictEqual(got.length, 1);
			assert.strictEqual(got[0].status, 401);
			assert.strictEqual(got[0].code, 154);
			assert.strictEqual(got[0].api, undefined);
			assert.strictEqual(got[0].tenant, undefined);
			assert.strictEqual(got[0].user, undefined);
			done();
		});
	});

	it("the user's ACL in effect gives the route; one without the service gives none", (done) => {
		run((req) => {
			let sp = req.soajs.controller.serviceParams;
			sp.path = "/orders/7";
			sp.finalAcl = apiPathParam2apiRegExp({"apis": {"/orders/:id": {}}});
			sp.uracAclApplied = true;
			sp.uracFinalAcl = null;
		}, () => {}, () => {
			assert.strictEqual(got[0].api, undefined);
			done();
		});
	});

	it("the gateway's routes: /soajs/mcp with its tool, /soajs/proxy", (done) => {
		run((req) => {
			let sp = req.soajs.controller.serviceParams;
			sp.gatewayApi = true;
			sp.name = "controller";
			sp.version = "1";
			sp.path = "/soajs/mcp";
			req.soajs.callEvent.mcpTool = "orders_getOrder";
		}, () => {}, () => {
			assert.strictEqual(got[0].service, "controller");
			assert.strictEqual(got[0].api, "/soajs/mcp");
			assert.strictEqual(got[0].mcpTool, "orders_getOrder");
			got = [];
			run((req) => {
				let sp = req.soajs.controller.serviceParams;
				sp.proxy = true;
				sp.name = "x";
			}, () => {}, () => {
				assert.strictEqual(got[0].service, "controller");
				assert.strictEqual(got[0].version, "1");
				assert.strictEqual(got[0].api, "/soajs/proxy");
				done();
			});
		});
	});

	it("with services, only those enabled emit", (done) => {
		config({"services": {"orders": {"enabled": true}, "other": {"enabled": false}}});
		run(null, () => {}, () => {
			assert.strictEqual(got.length, 1);
			got = [];
			run((req) => {
				req.soajs.controller.serviceParams.service_n = "other";
			}, () => {}, () => {
				assert.strictEqual(got.length, 0);
				done();
			});
		});
	});

	it("routeOf: the exact route, else the last expression that matches", (done) => {
		let acl = apiPathParam2apiRegExp({"apis": {"/a/b": {}, "/a/:x": {}, "/:y/:z": {}}});
		assert.strictEqual(mw.routeOf(acl, "/a/b"), "/a/b");
		// the expressions are listed later routes first: the last match is the one mt's apiCheck takes
		assert.strictEqual(mw.routeOf(acl, "/a/c"), "/a/:x");
		assert.strictEqual(mw.routeOf(acl, "/q"), null);
		assert.strictEqual(mw.routeOf(null, "/a"), null);
		done();
	});
});
