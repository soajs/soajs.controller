'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const request = require('request');
const async = require('async');

let gatewayServiceName = null;
let regEnvironment = (process.env.SOAJS_ENV || "dev");
regEnvironment = regEnvironment.toLowerCase();

let serviceAwarenessObj = {};
let controllerHosts = null;
let timeLoaded = 0;
let registry = null;

let fetchControllerHosts = function (core, log, next) {
	registry = core.registry.get();
	core.registry.loadOtherEnvControllerHosts(gatewayServiceName, function (error, hosts) {
		if (error) {
			log.warn("Failed to load controller hosts. reusing from previous load. Reason: " + error.message);
		} else {
			controllerHosts = hosts;
		}
		log.debug("Self Awareness ENV reloaded controller hosts. next reload is in [" + registry.serviceConfig.awareness.autoRelaodRegistry + "] milliseconds");
		setTimeout(() => {
			fetchControllerHosts(core, log);
		}, registry.serviceConfig.awareness.autoRelaodRegistry);
		
		if (next && typeof next === "function") {
			next();
		}
	});
};

let awareness_healthCheck = function (core, log) {
	registry = core.registry.get();
	
	let resume = () => {
		if (controllerHosts && Array.isArray(controllerHosts) && controllerHosts.length > 0) {
			let controllerPort = registry.services.controller.port;
			async.each(controllerHosts,
				function (sObj, callback) {
					if (!serviceAwarenessObj[sObj.env]) {
						serviceAwarenessObj[sObj.env] = {};
					}
					if (!serviceAwarenessObj[sObj.env][sObj.name]) {
						serviceAwarenessObj[sObj.env][sObj.name] = {"healthy": {}, "indexes": {}, "latest": 1};
					}
					if (!serviceAwarenessObj[sObj.env][sObj.name].healthy[sObj.version]) {
						serviceAwarenessObj[sObj.env][sObj.name].healthy[sObj.version] = [];
					}
					if (!serviceAwarenessObj[sObj.env][sObj.name].indexes[sObj.version]) {
						serviceAwarenessObj[sObj.env][sObj.name].indexes[sObj.version] = 0;
					}
					request({
						'uri': 'http://' + sObj.ip + ':' + (controllerPort + registry.serviceConfig.ports.maintenanceInc) + '/heartbeat'
					}, function (error, response) {
						if (serviceAwarenessObj[sObj.env][sObj.name].latest < sObj.version) {
							serviceAwarenessObj[sObj.env][sObj.name].latest = sObj.version;
						}
						if (!error && response.statusCode === 200) {
							if (serviceAwarenessObj[sObj.env][sObj.name].healthy[sObj.version].indexOf(sObj.ip) === -1) {
								serviceAwarenessObj[sObj.env][sObj.name].healthy[sObj.version].push(sObj.ip);
							}
						} else {
							if (serviceAwarenessObj[sObj.env][sObj.name].healthy[sObj.version].indexOf(sObj.ip) !== -1) {
								//TODO: if we guarantee uniqueness we will not need the for loop
								for (let ii = 0; ii < serviceAwarenessObj[sObj.env][sObj.name].healthy[sObj.version].length; ii++) {
									if (serviceAwarenessObj[sObj.env][sObj.name].healthy[sObj.version][ii] === sObj.ip) {
										serviceAwarenessObj[sObj.env][sObj.name].healthy[sObj.version].splice(ii, 1);
									}
								}
							}
						}
						callback();
					});
				}, function (err) {
					if (err) {
						log.warn('Unable to build awareness ENV structure for controllers: ' + err);
					}
				});
		}
		setTimeout(() => {
			awareness_healthCheck(core, log);
		}, registry.serviceConfig.awareness.healthCheckInterval);
	};
	
	if (timeLoaded !== registry.timeLoaded) {
		fetchControllerHosts(core, log, resume);
	} else {
		resume();
	}
	
	timeLoaded = registry.timeLoaded;
};


function roundRobin() {
	let s, v, env, cb;
	cb = arguments[arguments.length - 1];
	switch (arguments.length) {
		//dash, cb
		case 2:
			env = arguments[0];
			break;
		case 3:
			//1, dash, cb
			v = arguments[0];
			env = arguments[1];
			break;
		case 4:
			//controller, 1, dash, cb
			v = arguments[1];
			env = arguments[2];
			break;
	}
	
	env = env || regEnvironment;
	s = gatewayServiceName;
	if (env && s && serviceAwarenessObj[env] && serviceAwarenessObj[env][s] && serviceAwarenessObj[env][s].healthy) {
		if (!v) {
			v = serviceAwarenessObj[env][s].latest;
		}
		if (serviceAwarenessObj[env][s].healthy[v] && serviceAwarenessObj[env][s].healthy[v].length > 0) {
			if (!serviceAwarenessObj[env][s].indexes) {
				serviceAwarenessObj[env][s].indexes = {};
			}
			if (!serviceAwarenessObj[env][s].indexes[v] || serviceAwarenessObj[env][s].indexes[v] >= serviceAwarenessObj[env][s].healthy[v].length) {
				serviceAwarenessObj[env][s].indexes[v] = 0;
			}
			let host = serviceAwarenessObj[env][s].healthy[v][serviceAwarenessObj[env][s].indexes[v]];
			serviceAwarenessObj[env][s].indexes[v] += 1;
			return cb(host);
		} else {
			return cb(null);
		}
	} else {
		return cb(null);
	}
}

function init(param) {
	gatewayServiceName = param.serviceName;
	registry = param.core.registry.get();
	if (registry.serviceConfig.awareness.autoRelaodRegistry) {
		setTimeout(() => {
			fetchControllerHosts(param.core, param.log);
		}, registry.serviceConfig.awareness.autoRelaodRegistry);
	}
	if (registry.serviceConfig.awareness.healthCheckInterval) {
		awareness_healthCheck(param.core, param.log);
	}
}

module.exports = {
	"init": init,
	"getControllerEnvHost": roundRobin
};