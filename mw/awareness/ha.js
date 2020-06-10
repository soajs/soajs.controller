'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const async = require('async');
const coreLibs = require("soajs.core.libs");

const registryModule = require("./../../modules/registry");

let param = null;
let timeout = null;
let regEnvironment = (process.env.SOAJS_ENV || "dev");
regEnvironment = regEnvironment.toLowerCase();

let awarenessCache = {};

let lib = {
	"getHostFromCache": function (serviceName, version) {
		if (awarenessCache[serviceName] &&
			awarenessCache[serviceName][version] &&
			awarenessCache[serviceName][version].host) {
			param.log.debug('Got ' + serviceName + ' - ' + version + ' - ' + awarenessCache[serviceName][version].host + ' from awareness cache');
			return awarenessCache[serviceName][version].host;
		}
		
		return null;
	},
	
	"getHostFromAPI": function (serviceName, version, cb) {
		if (!version) {
			let options = null;
			let input = {
				"configuration": {"env": regEnvironment},
				"itemName": serviceName
			};
			param.infra.kubernetes.get.item_latestVersion(param, input, options, (error, obtainedVersion) => {
				if (error) {
					param.log.error(error.message);
					return cb(null);
				}
				getHost(obtainedVersion);
			});
		} else {
			getHost(version);
		}
		
		function getHost(version) {
			param.log.debug('Getting host for ' + serviceName + ' - ' + version + ' ....');
			let options = null;
			let input = {
				"configuration": {"env": regEnvironment},
				"item": {"name": serviceName, "version": version, "env": regEnvironment}
			};
			param.infra.kubernetes.get.host(param, input, options, (error, host) => {
				if (error) {
					param.log.error(error.message);
					return cb(null);
				}
				if (!awarenessCache[serviceName]) {
					awarenessCache[serviceName] = {};
				}
				if (!awarenessCache[serviceName][version]) {
					awarenessCache[serviceName][version] = {};
				}
				awarenessCache[serviceName][version].host = host;
				return cb(host);
			});
		}
	},
	
	"rebuildAwarenessCache": function () {
		let myCache = {};
		let options = null;
		let input = {
			"configuration": {"env": regEnvironment}
		};
		param.infra.kubernetes.get.all(param, input, options, (error, services) => {
			if (error) {
				param.log.error(error.message);
				return;
			}
			async.each(services, function (oneService, callback) {
				let version, serviceName;
				if (oneService.metadata.labels['soajs.service.type'] !== "service" && oneService.metadata.labels['soajs.service.type'] !== "mdaemon") {
					return callback();
				}
				if (oneService.metadata.labels && oneService.metadata.labels['soajs.service.version']) {
					version = oneService.metadata.labels['soajs.service.version'];
				}
				
				if (oneService.metadata.labels && oneService.metadata.labels['soajs.service.name']) {
					serviceName = oneService.metadata.labels['soajs.service.name'];
				}
				
				if (!serviceName) {
					return callback();
				}
				if (oneService.spec.clusterIP) {
					if (!myCache[serviceName]) {
						myCache[serviceName] = {};
					}
					if (!myCache[serviceName][version]) {
						myCache[serviceName][version] = {};
					}
					myCache[serviceName][version].host = oneService.spec.clusterIP;
				}
				return callback();
			}, function () {
				awarenessCache = myCache;
				param.log.debug("Awareness cache rebuilt successfully");
				param.log.debug(awarenessCache);
				
				let cacheTTL = registryModule.get().serviceConfig.awareness.cacheTTL;
				if (cacheTTL) {
					if (timeout) {
						clearTimeout(timeout);
					}
					param.log.debug("rebuilding cache in: " + cacheTTL);
					timeout = setTimeout(lib.rebuildAwarenessCache, cacheTTL);
				}
			});
		});
	}
};

let ha = {
	"init": function (_param) {
		param = _param;
		lib.rebuildAwarenessCache();
	},
	
	"getServiceHost": function () {
		let env = regEnvironment;
		let serviceName = param.serviceName, version = null, cb = arguments[arguments.length - 1];
		switch (arguments.length) {
			//controller, cb
			case 2:
				serviceName = arguments[0];
				break;
			
			//controller, 1, cb
			case 3:
				serviceName = arguments[0];
				version = arguments[1];
				break;
			
			//controller, 1, dash, cb [dash is ignored]
			case 4:
				serviceName = arguments[0];
				version = arguments[1];
				break;
		}
		
		if (serviceName === param.serviceName) {
			if (process.env.SOAJS_DEPLOY_HA === 'kubernetes') {
				serviceName += "-v" + param.serviceVersion + "-service";
			}
			let info = registryModule.get().deployer.selected.split('.');
			let deployerConfig = registryModule.get().deployer.container[info[1]][info[2]];
			let namespace = '';
			if (deployerConfig && deployerConfig.namespace && deployerConfig.namespace.default) {
				namespace = '.' + deployerConfig.namespace.default;
				if (deployerConfig.namespace.perService) {
					namespace += '-' + env + '-' + param.serviceName + '-v' + param.serviceVersion;
				}
			}
			return cb(env + "-" + serviceName + namespace);
		} else {
			let hostname = lib.getHostFromCache(serviceName, version);
			if (hostname) {
				return cb(hostname);
			} else {
				lib.getHostFromAPI(serviceName, version, cb);
			}
		}
	},
	
	"getLatestVersion": function (name, cb) {
		if (!awarenessCache[name]) {
			return cb(null);
		}
		
		let serviceVersions = Object.keys(awarenessCache[name]);
		if (serviceVersions.length === 0) {
			return cb(null);
		}
		let latestVersion = null;
		for (let i = 0; i < serviceVersions.length; i++) {
			latestVersion = coreLibs.version.getLatest(latestVersion, serviceVersions[i]);
		}
		if (latestVersion) {
			return cb(latestVersion);
		} else {
			return cb(null);
		}
	},
	
	"getLatestVersionFromCluster": function (name, cb) {
		let options = null;
		let input = {
			"configuration": {"env": regEnvironment},
			"itemName": name
		};
		param.infra.kubernetes.get.item_latestVersion(param, input, options, (error, obtainedVersion) => {
			if (error) {
				param.log.error(error.message);
				return cb(null);
			}
			return cb(obtainedVersion);
		});
	}
};

module.exports = ha;
