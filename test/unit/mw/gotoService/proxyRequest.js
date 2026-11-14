"use strict";

const helper = require("../../../helper.js");
const assert = require('assert');
const sinon = require('sinon');
const http = require('http');
const stream = require('stream');

describe("Unit test for: mw - gotoService proxyRequest", function () {
	let registryModule;
	let loadStub;
	let server;
	let port;
	let proxyRequest;

	before((done) => {
		registryModule = helper.requireModule('./modules/registry/index.js');
		proxyRequest = helper.requireModule('./mw/gotoService/proxyRequest.js')({
			"core": {"error": {"getError": (code) => ({"code": code})}}
		});
		// a remote gateway that takes the request and never answers
		server = http.createServer(() => {});
		server.listen(0, "127.0.0.1", () => {
			port = server.address().port;
			loadStub = sinon.stub(registryModule, 'loadByEnv').callsFake((input, cb) => {
				return cb(null, {"protocol": "http", "domain": "127.0.0.1", "port": port});
			});
			done();
		});
	});

	after((done) => {
		loadStub.restore();
		server.closeAllConnections();
		server.close(() => done());
	});

	it("a remote gateway that does not answer within requestTimeout: 135", function (done) {
		this.timeout(5000);
		let req = new stream.PassThrough();
		req.method = "GET";
		req.headers = {"key": "k"};
		req.query = {};
		req.soajs = {
			"tenant": {"code": "T"},
			"controller": {"serviceParams": {"parsedUrl": {"query": {"proxyRoute": "/svc/x", "__env": "remote", "extKey": "remote-key"}}}},
			"registry": {"services": {"controller": {"requestTimeout": 1}}},
			"log": {"error": () => {}, "debug": () => {}},
			"controllerResponse": (obj) => {
				assert.deepStrictEqual(obj, {"code": 135});
				done();
			}
		};
		let res = {"writeHead": () => {}, "end": () => {}, "on": () => {}, "once": () => {}, "emit": () => {}, "write": () => true};
		proxyRequest(req, res, () => {});
		req.end();
	});
});
