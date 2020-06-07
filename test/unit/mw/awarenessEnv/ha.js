"use strict";

const helper = require("../../../helper.js");
const assert = require('assert');

const sinon = require('sinon');

describe("Testing awarenessEnv HA", () => {
	
	let provisionStub;
	
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
		
		done();
	});
	
	after((done) => {
		if (provisionStub) {
			provisionStub.restore();
		}
		done();
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