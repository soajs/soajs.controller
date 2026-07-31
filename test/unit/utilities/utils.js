"use strict"
const assert = require('assert');
const helper = require("../../helper.js");

let utils = helper.requireModule('./utilities/utils.js');

describe("Testing utilities", () => {

	const TOKEN = "e2d0ffb0f0e34bd6a8e0a0b4a1d1b6c1f2a3b4c5";
	const EKEY = "aa39b5490c4a4ed0e56d7ec1232a428f771e8bb83cfcee16de14f735d0f5da58";
	const IKEY = "38145c67717c73d3febd16df38abf311";

	let logged = {
		"error": [],
		"warn": []
	};

	/**
	 * bunyan semantics: log.<level>() with no argument returns whether that level is
	 * enabled, log.<level>(input) writes the record. The gateway relies on the first
	 * form to skip building log payloads that would be discarded.
	 */
	let makeLog = (enabled) => {
		return {
			error: (input) => {
				if (input === undefined) {
					return enabled;
				}
				logged.error.push(input);
			},
			warn: (input) => {
				if (input === undefined) {
					return enabled;
				}
				logged.warn.push(input);
			}
		};
	};

	let makeReq = (enabled) => {
		return {
			method: "GET",
			url: "/urac/user/getprofile?access_token=" + TOKEN + "&key=" + EKEY + "&id=42",
			headers: {
				"access_token": TOKEN,
				"key": EKEY,
				"authorization": "Bearer " + TOKEN
			},
			getClientIP: () => {
				return "196.218.44.17";
			},
			getClientUserAgent: () => {
				return "mocha-agent";
			},
			soajs: {
				log: makeLog(enabled),
				controller: {
					serviceParams: {
						name: "urac",
						version: "3",
						parsedUrl: { pathname: "/urac/user/getprofile" }
					}
				},
				tenant: {
					id: "5c0e74ba9acc3c5a84a51259",
					code: "TSTM",
					key: { iKey: IKEY, eKey: EKEY },
					application: { product: "TPROD", package: "TPROD_BASIC" }
				},
				buildResponse: (input) => {
					return input;
				},
				controllerResponse: (input) => {
					return input;
				}
			}
		};
	};

	let res = {
		status: () => {
			return {
				send: (input2) => {
					return input2;
				}
			};
		},
		jsonp: () => {
			return 2;
		}
	};

	let req = makeReq(true);

	beforeEach(() => {
		logged.error = [];
		logged.warn = [];
	});

	it("logErrors - number error", (done) => {
		utils.logErrors(123, req, res, (error) => {
			done();
		});
	});

	it("logErrors - object, no code no message", (done) => {
		utils.logErrors({}, req, res, (error) => {
			done();
		});
	});

	it("logErrors - string error", (done) => {
		utils.logErrors("error", req, res, (error) => {
			done();
		});
	});

	it("controllerClientErrorHandler - request without xhr", (done) => {
		utils.controllerClientErrorHandler(null, req, res, () => {
			done();
		});
	});
	it("controllerClientErrorHandler - request xhr", (done) => {
		req.xhr = {};
		utils.controllerClientErrorHandler(null, req, res, () => {
			done();
		});
	});

	it("controllerErrorHandler - number error", (done) => {
		req.xhr = {};
		utils.controllerErrorHandler(150, req, res, null);
		done();
	});
	it("controllerErrorHandler - with error", (done) => {
		utils.controllerErrorHandler({ "code": 200, "msg": "dummy200" }, req, res, null);
		done();
	});

	it("controllerErrorHandler - emits the redacted context at error level", (done) => {
		let r = makeReq(true);
		utils.controllerErrorHandler({ "code": 401, "msg": "The access token provided is invalid." }, r, res, null);

		assert.strictEqual(logged.error.length, 1);
		let ctx = JSON.parse(logged.error[0]);
		assert.strictEqual(ctx.code, 401);
		assert.strictEqual(ctx.msg, "The access token provided is invalid.");
		assert.strictEqual(ctx.method, "GET");
		assert.strictEqual(ctx.service, "urac");
		assert.strictEqual(ctx.version, "3");
		assert.strictEqual(ctx.api, "/urac/user/getprofile");
		assert.strictEqual(ctx.ip, "196.218.44.17");
		assert.strictEqual(ctx.ua, "mocha-agent");
		assert.deepStrictEqual(ctx.tenant, { "id": "5c0e74ba9acc3c5a84a51259", "code": "TSTM" });
		assert.strictEqual(ctx.iKey, IKEY);
		assert.deepStrictEqual(ctx.application, { "product": "TPROD", "package": "TPROD_BASIC" });
		done();
	});

	it("controllerErrorHandler - masks credentials and never logs headers", (done) => {
		let r = makeReq(true);
		utils.controllerErrorHandler({ "code": 401, "msg": "bad token" }, r, res, null);

		let line = logged.error[0];
		assert.strictEqual(line.indexOf(TOKEN), -1, "access_token leaked into the error context");
		assert.strictEqual(line.indexOf(EKEY), -1, "eKey leaked into the error context");
		assert.strictEqual(line.indexOf("authorization"), -1, "headers leaked into the error context");

		let ctx = JSON.parse(line);
		assert.strictEqual(ctx.url, "/urac/user/getprofile?access_token=***&key=***&id=42");
		done();
	});

	it("controllerErrorHandler - numeric error resolves code and message", (done) => {
		let r = makeReq(true);
		utils.controllerErrorHandler(143, r, res, null);

		let ctx = JSON.parse(logged.error[0]);
		assert.strictEqual(ctx.code, 143);
		assert.strictEqual(ctx.msg, "invalid_request: Malformed auth header");
		done();
	});

	it("controllerErrorHandler - includes the resolved username when present", (done) => {
		let r = makeReq(true);
		r.soajs.uracDriver = { "username": "owner" };
		utils.controllerErrorHandler({ "code": 401, "msg": "bad token" }, r, res, null);

		let ctx = JSON.parse(logged.error[0]);
		assert.strictEqual(ctx.username, "owner");
		done();
	});

	it("controllerErrorHandler - degraded request without tenant or serviceParams", (done) => {
		let r = makeReq(true);
		r.soajs.controller = {};
		delete r.soajs.tenant;
		utils.controllerErrorHandler(130, r, res, null);

		let ctx = JSON.parse(logged.error[0]);
		assert.strictEqual(ctx.service, null);
		assert.strictEqual(ctx.version, null);
		assert.strictEqual(ctx.api, null);
		assert.strictEqual(ctx.tenant, undefined);
		assert.strictEqual(ctx.iKey, undefined);
		assert.strictEqual(ctx.application, undefined);
		done();
	});

	it("controllerErrorHandler - skips both payloads when the levels are off", (done) => {
		let r = makeReq(false);
		utils.controllerErrorHandler({ "code": 401, "msg": "bad token" }, r, res, null);

		assert.strictEqual(logged.error.length, 0);
		assert.strictEqual(logged.warn.length, 0);
		done();
	});

	it("controllerErrorHandler - the warn dump still carries the raw headers", (done) => {
		let r = makeReq(true);
		utils.controllerErrorHandler({ "code": 401, "msg": "bad token" }, r, res, null);

		assert.strictEqual(logged.warn.length, 1);
		let dump = JSON.parse(logged.warn[0]);
		assert.strictEqual(dump.headers.access_token, TOKEN);
		assert.strictEqual(dump.url, r.url);
		done();
	});
});
