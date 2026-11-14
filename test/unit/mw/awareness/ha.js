"use strict";

const helper = require("../../../helper.js");
const assert = require('assert');
const sinon = require('sinon');

describe("Testing awareness HA", () => {
	let ha;
	let registryModule;
	let getStub;
	let loadStub;
	let clock;
	let env = (process.env.SOAJS_ENV || "dev").toLowerCase();
	let log = {"error": () => {}, "debug": () => {}};

	before((done) => {
		ha = helper.requireModule('./mw/awareness/ha.js');
		registryModule = helper.requireModule('./modules/registry/index.js');
		getStub = sinon.stub(registryModule, 'get').callsFake(() => {
			return {
				"serviceConfig": {"awareness": {"cacheTTL": 1000}},
				"deployer": {"type": "container", "selected": "container.kubernetes", "container": {"kubernetes": {"namespace": "soajs"}}}
			};
		});
		loadStub = sinon.stub(registryModule, 'loadByEnv').callsFake((input, cb) => {
			return cb(new Error("no infra"));
		});
		clock = sinon.useFakeTimers();
		done();
	});

	after((done) => {
		clock.restore();
		getStub.restore();
		loadStub.restore();
		done();
	});

	it("the cache is rebuilt again after cacheTTL when a rebuild fails", (done) => {
		ha.init({"serviceName": "controller", "serviceVersion": "1", "log": log});
		assert.strictEqual(loadStub.callCount, 1);
		clock.tick(1000);
		assert.strictEqual(loadStub.callCount, 2);
		clock.tick(1000);
		assert.strictEqual(loadStub.callCount, 3);
		done();
	});

	it("the gateway's host has the namespace of the current deployer", (done) => {
		ha.getServiceHost("controller", (host) => {
			assert.strictEqual(host, env + "-controller.soajs");
			done();
		});
	});
});
