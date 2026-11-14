'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const registryModule = require("./../../modules/registry");
const { checkStatus } = require("../../lib/request.js");

const async = require('async');

let registry = null;

let gatewayServiceName = null;
let serviceAwarenessObj = {};
let awarenessHosts = {
	"registryLoadedTime": 0,
	"servicesArr": []
};

let awareness_healthCheck = function (core, log) {
	registry = registryModule.get();
	if (awarenessHosts.registryLoadedTime !== registry.timeLoaded) {
		awarenessHosts = {
			"registryLoadedTime": registry.timeLoaded,
			"servicesArr": []
		};
		for (let s in registry.services) {
			if (Object.hasOwnProperty.call(registry.services, s)) {
				if (!serviceAwarenessObj[s]) {
					serviceAwarenessObj[s] = { "healthy": {}, "indexes": {} };
				}
				if (!serviceAwarenessObj[s].healthy) {
					serviceAwarenessObj[s].healthy = {};
				}
				//NOTE: the registry was reloaded, a host that left it is no longer healthy
				pruneHealthy(serviceAwarenessObj[s].healthy, registry.services[s].hosts);
				if (registry.services[s].hosts) {//} && registry.services[s].hosts.length > 0) {
					for (let h_ver in registry.services[s].hosts) {
						if (Object.hasOwnProperty.call(registry.services[s].hosts, h_ver) && h_ver !== "latest") {
							if (!serviceAwarenessObj[s].healthy[h_ver]) {
								serviceAwarenessObj[s].healthy[h_ver] = [];
							}
							if (!serviceAwarenessObj[s].indexes[h_ver]) {
								serviceAwarenessObj[s].indexes[h_ver] = 0;
							}
							if (registry.services[s].hosts[h_ver].length > 0) {
								for (let i = 0; i < registry.services[s].hosts[h_ver].length; i++) {
									let sObj = {
										"name": s,
										"group": registry.services[s].group,
										"port": registry.services[s].port,
										"host": registry.services[s].hosts[h_ver][i],
										"what": "services",
										"version": h_ver
									};
									awarenessHosts.servicesArr.push(sObj);
								}
							}
						}
					}
				}
			}
		}

		for (let s in registry.daemons) {
			if (Object.hasOwnProperty.call(registry.daemons, s)) {
				if (!serviceAwarenessObj[s]) {
					serviceAwarenessObj[s] = { "healthy": {}, "indexes": {} };
				}
				if (!serviceAwarenessObj[s].healthy) {
					serviceAwarenessObj[s].healthy = {};
				}
				//NOTE: the registry was reloaded, a host that left it is no longer healthy
				pruneHealthy(serviceAwarenessObj[s].healthy, registry.daemons[s].hosts);
				if (registry.daemons[s].hosts) {//} && registry.daemons[s].hosts.length > 0) {
					for (let h_ver in registry.daemons[s].hosts) {
						if (Object.hasOwnProperty.call(registry.daemons[s].hosts, h_ver) && h_ver !== "latest") {
							if (!serviceAwarenessObj[s].healthy[h_ver]) {
								serviceAwarenessObj[s].healthy[h_ver] = [];
							}
							if (!serviceAwarenessObj[s].indexes[h_ver]) {
								serviceAwarenessObj[s].indexes[h_ver] = 0;
							}
							if (registry.daemons[s].hosts[h_ver].length > 0) {
								for (let i = 0; i < registry.daemons[s].hosts[h_ver].length; i++) {
									let sObj = {
										"name": s,
										"port": registry.daemons[s].port,
										"group": registry.daemons[s].group,
										"host": registry.daemons[s].hosts[h_ver][i],
										"what": "daemons",
										"version": h_ver
									};
									awarenessHosts.servicesArr.push(sObj);
								}
							}
						}
					}
				}
			}
		}
	}
	async.each(awarenessHosts.servicesArr,
		function (sObj, callback) {

			let checkForHeartBeat = function (host, port, path, callback) {
				checkStatus ('http://' + host + ':' + port + path)
				.then (()=>{
					callback(true);
				})
				.catch (()=>{
					callback(false);
				});

				// request({
				// 	'uri': 'http://' + host + ':' + port + path
				// }, function (error, response) {
				// 	if (!error && response.statusCode === 200) {
				// 		callback(true);
				// 	} else {
				// 		callback(false);
				// 	}
				// });
			};

			let nextStep = function (found) {
				if (registry[sObj.what][sObj.name] && !registry[sObj.what][sObj.name].awarenessStats) {
					registry[sObj.what][sObj.name].awarenessStats = {};
				}
				let statusObj = { "lastCheck": new Date().getTime(), "healthy": false, "version": sObj.version };
				if (found) {
					statusObj.healthy = true;
					if (serviceAwarenessObj[sObj.name].healthy[sObj.version].indexOf(sObj.host) === -1) {
						serviceAwarenessObj[sObj.name].healthy[sObj.version].push(sObj.host);
					}
				} else {
					if (registry[sObj.what][sObj.name] && registry[sObj.what][sObj.name].awarenessStats[sObj.host] && registry[sObj.what][sObj.name].awarenessStats[sObj.host].healthy === false) {
						statusObj.downCount = registry[sObj.what][sObj.name].awarenessStats[sObj.host].downCount + 1;
						statusObj.downSince = registry[sObj.what][sObj.name].awarenessStats[sObj.host].downSince;
					} else {
						statusObj.downSince = statusObj.lastCheck;
						statusObj.downCount = 0;
					}

					let stopLoggingAfter = registry.serviceConfig.awareness.maxLogCount;
					if (statusObj.downCount <= stopLoggingAfter) {
						log.error("Self Awareness health check for service [" + sObj.name + "] for host [" + sObj.host + "] is NOT healthy");
					}
					if (serviceAwarenessObj[sObj.name].healthy[sObj.version].indexOf(sObj.host) !== -1) {
						//TODO: if we guarantee uniqueness we will not need the for loop
						for (let ii = 0; ii < serviceAwarenessObj[sObj.name].healthy[sObj.version].length; ii++) {
							if (serviceAwarenessObj[sObj.name].healthy[sObj.version][ii] === sObj.host) {
								serviceAwarenessObj[sObj.name].healthy[sObj.version].splice(ii, 1);
							}
						}
					}
				}

				if (registry[sObj.what][sObj.name] && registry[sObj.what][sObj.name].awarenessStats) {
					registry[sObj.what][sObj.name].awarenessStats[sObj.host] = statusObj;
				}
				callback();
			};

			if (registry.services[sObj.name] && registry.services[sObj.name].maintenance && registry.services[sObj.name].maintenance.readiness && registry.services[sObj.name].maintenance.port) {
				let port = sObj.port;
				let path = registry.services[sObj.name].maintenance.readiness;
				if ("maintenance" === registry.services[sObj.name].maintenance.port.type) {
					port = port + registry.serviceConfig.ports.maintenanceInc;
				} else if ("inherit" === registry.services[sObj.name].maintenance.port.type) {
					port = port;
				} else {
					let tempPort = parseInt(registry.services[sObj.name].maintenance.port.value);
					if (!isNaN(tempPort)) {
						port = registry.services[sObj.name].maintenance.port.value;
					}
				}
				checkForHeartBeat(sObj.host, port, path, function (found) {
					nextStep(found);
				});
			} else {
				checkForHeartBeat(sObj.host, sObj.port + registry.serviceConfig.ports.maintenanceInc, '/heartbeat', function (found) {
					if (found) {
						nextStep(found);
					} else {
						checkForHeartBeat(sObj.host, sObj.port, '/heartbeat', function (found) {
							nextStep(found);
						});
					}
				});
			}
		}, function (err) {
			if (err) {
				log.error('Unable to build awareness structure for services: ' + err);
			}
		});
	setTimeout(() => {
		awareness_healthCheck(core, log);
	}, registry.serviceConfig.awareness.healthCheckInterval);
};

/**
 * The next healthy host of a version, round-robin from index: at most one pass over the hosts,
 * then no host.
 *
 * @param hosts the version's hosts in the registry
 * @param healthy the hosts the health check found healthy
 * @param index where the previous call stopped
 * @returns {{host: string|null, index: number}} the host, and where the next call starts
 */
function nextHealthyHost(hosts, healthy, index) {
	if (!Array.isArray(hosts) || hosts.length === 0 || !Array.isArray(healthy)) {
		return {"host": null, "index": 0};
	}
	if (!index || index >= hosts.length) {
		index = 0;
	}
	for (let tries = 0; tries < hosts.length; tries++) {
		let host = hosts[index];
		index = (index + 1) % hosts.length;
		if (healthy.indexOf(host) !== -1) {
			return {"host": host, "index": index};
		}
	}
	return {"host": null, "index": index};
}

/**
 * Keeps, per version, only the healthy hosts the registry still lists.
 *
 * @param healthy {version: [host]}
 * @param hosts the registry's hosts {latest, version: [host]}
 */
function pruneHealthy(healthy, hosts) {
	if (!healthy) {
		return;
	}
	let listedIn = (v) => (hosts && Array.isArray(hosts[v])) ? hosts[v] : [];
	Object.keys(healthy).forEach((v) => {
		let listed = listedIn(v);
		healthy[v] = healthy[v].filter((host) => listed.indexOf(host) !== -1);
	});
}

let roundRobin = function (s, v, env, cb) {
	if (!cb && typeof env === "function") {
		cb = env;
	} else if (!cb && typeof v === "function") {
		cb = v;
		v = null;
	} else if (!cb && typeof s === "function") {
		cb = s;
		s = gatewayServiceName;
	}
	if (s && registry.services[s] && registry.services[s].hosts && registry.services[s].hosts.latest && serviceAwarenessObj[s] && serviceAwarenessObj[s].healthy) {
		if (!v) {
			v = registry.services[s].hosts.latest;
		}
		if (registry.services[s].hosts[v] && serviceAwarenessObj[s].healthy[v]) {
			if (serviceAwarenessObj[s].healthy[v] && serviceAwarenessObj[s].healthy[v].length > 0) {
				if (!serviceAwarenessObj[s].indexes) {
					serviceAwarenessObj[s].indexes = {};
				}
				let picked = nextHealthyHost(registry.services[s].hosts[v], serviceAwarenessObj[s].healthy[v], serviceAwarenessObj[s].indexes[v]);
				serviceAwarenessObj[s].indexes[v] = picked.index;
				return cb(picked.host);
			} else {
				return cb(null);
			}
		} else {
			return cb(null);
		}
	} else {
		return cb(null);
	}
};

function init(param) {
	gatewayServiceName = param.serviceName;
	registry = registryModule.get();
	if (registry && registry.serviceConfig && registry.serviceConfig.awareness && registry.serviceConfig.awareness.healthCheckInterval) {
		awareness_healthCheck(param.core, param.log);
	}
}

function getLatestVersion(name, cb) {
	if (registry && registry.services && registry.services[name] && registry.services[name].hosts) {
		return cb(registry.services[name].hosts.latest);
	} else {
		return cb(null);
	}
}

module.exports = {
	"init": init,
	"getServiceHost": roundRobin,
	"getLatestVersion": getLatestVersion,
	"nextHealthyHost": nextHealthyHost,
	"pruneHealthy": pruneHealthy
};