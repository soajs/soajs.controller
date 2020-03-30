"use strict";

const helper = require("../../../helper.js");
const assert = require('assert');

const sinon = require('sinon');

describe("Testing awarenessEnv HA", () => {
	
	let provisionStub;
	
	let ha;
	let coreModules;
	let core;
	
	before((done) => {
		ha = helper.requireModule('./mw/awarenessEnv/ha.js');
		let localConfig = helper.requireModule('./config.js');
		ha.init({"serviceName": localConfig.serviceName});
		coreModules = require("soajs.core.modules");
		core = coreModules.core;
		
		provisionStub = sinon.stub(core.registry, 'get').callsFake(() => {
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