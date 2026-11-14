"use strict";

const helper = require("../../../helper.js");
const assert = require('assert');
const mw = helper.requireModule('./mw/url/index');

describe("Unit test for: mw - url, the key header", function () {
	let run = (url, headers, cb) => {
		let req = {
			"url": url,
			"headers": headers,
			"soajs": {
				"controller": {},
				"registry": {"services": {"urac": {"port": 4001}}},
				"log": {"fatal": () => {}, "warn": () => false, "debug": () => {}},
				"controllerResponse": (obj) => {
					return cb(new Error(JSON.stringify(obj)), req);
				}
			}
		};
		let functionMw = mw({"core": {"error": {"getError": (code) => ({"code": code})}}});
		functionMw(req, {}, () => cb(null, req));
	};

	it("no key in the header or the query: no key header", function (done) {
		run("/urac/user", {}, (err, req) => {
			assert.ifError(err);
			assert.strictEqual(Object.hasOwnProperty.call(req.headers, "key"), false);
			done();
		});
	});

	it("a key in the query becomes the key header", function (done) {
		run("/urac/user?key=abc", {}, (err, req) => {
			assert.ifError(err);
			assert.strictEqual(req.headers.key, "abc");
			done();
		});
	});

	it("the key header is kept", function (done) {
		run("/urac/user?key=abc", {"key": "def"}, (err, req) => {
			assert.ifError(err);
			assert.strictEqual(req.headers.key, "def");
			done();
		});
	});
});
