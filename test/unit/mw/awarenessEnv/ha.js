"use strict";

const helper = require("../../../helper.js");
const assert = require('assert');

const sinon = require('sinon');

describe("Testing awarenessEnv HA", () => {
	
	let provisionStub;
	let loadStub;
	let env = (process.env.SOAJS_ENV || "dev").toLowerCase();
	
	let ha;
	let registryModule;
	
	before((done) => {
		ha = helper.requireModule('./mw/awarenessEnv/ha.js');
		registryModule = helper.requireModule('./modules/registry/index.js');
		let localConfig = helper.requireModule('./config.js');
		ha.init({"serviceName": localConfig.serviceName});
		
		provisionStub = sinon.stub(registryModule, 'get').callsFake(() => {
			return {
				deployer: {
					selected: "test0.test1.test2",
					container: {
						test1: {
							test2: {
								namespace: {
									default: 'test'
								}
							}
						}
					}
				}
			};
		});
		
		loadStub = sinon.stub(registryModule, 'loadByEnv').callsFake((input, cb) => {
			if (input.envCode === "nowhere") {
				return cb(new Error("no registry"));
			}
			return cb(null, {
				deployer: {
					type: "container",
					selected: "container.kubernetes",
					container: {kubernetes: {namespace: input.envCode + "-ns"}}
				}
			});
		});
		
		done();
	});
	
	after((done) => {
		if (provisionStub) {
			provisionStub.restore();
		}
		if (loadStub) {
			loadStub.restore();
		}
		done();
	});
	
	it("this environment: the older deployer's namespace", (done) => {
		ha.getControllerEnvHost(env, (host) => {
			assert.strictEqual(host, env + "-controller.test");
			done();
		});
	});
	
	it("another environment: the namespace of its own deployer", (done) => {
		ha.getControllerEnvHost("stg", (host) => {
			assert.strictEqual(host, "stg-controller.stg-ns");
			done();
		});
	});
	
	it("another environment without a registry: no host", (done) => {
		ha.getControllerEnvHost("1", "nowhere", (host) => {
			assert.strictEqual(host, null);
			done();
		});
	});
	
	it("test getControllerEnvHost args case 2 ", (done) => {
		let serviceName = 'test';
		
		ha.getControllerEnvHost(serviceName, (host) => {
			done();
		});
	});
	
	it("test getControllerEnvHost args case 3 ", (done) => {
		let serviceName = 'test';
		let version = 1;
		
		ha.getControllerEnvHost(serviceName, version, (host) => {
			done();
		});
	});
	
	it("test getControllerEnvHost args case 4", (done) => {
		let serviceName = 'test';
		let version = 1;
		let env = 'dashboard';
		
		ha.getControllerEnvHost(serviceName, version, env, (host) => {
			done();
		});
	});
});