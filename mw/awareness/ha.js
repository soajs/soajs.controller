'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const async = require('async');

const drivers = require('soajs.core.drivers');
const coreLibs = require("soajs.core.libs");

const coreModules = require("soajs.core.modules");
let core = coreModules.core;

let param = null;
let timeout = null;
let regEnvironment = (process.env.SOAJS_ENV || "dev");
regEnvironment = regEnvironment.toLowerCase();

let awarenessCache = {};

let lib = {
	"constructDriverParam": function (serviceName) {
		let info = core.registry.get().deployer.selected.split('.');
		let deployerConfig = core.registry.get().deployer.container[info[1]][info[2]];
		
		let strategy = process.env.SOAJS_DEPLOY_HA;
		if (strategy === 'swarm') {
			strategy = 'docker';
		}
		
		let options = {
			"strategy": strategy,
			"driver": info[1] + "." + info[2],
			"deployerConfig": deployerConfig,
			"soajs": {
				"registry": core.registry.get()
			},
			"model": {},
			"params": {
				"env": regEnvironment
			}
		};
		
		if (serviceName) {
			options.params.serviceName = serviceName;
		}
		
		return options;
	},
	
	"getLatestVersion": function (serviceName, cb) {
		let options = lib.constructDriverParam(serviceName);
		drivers.execute({"type": "container", "driver": options.strategy}, 'getLatestVersion', options, cb);
	},
	
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
		let options = lib.constructDriverParam(serviceName);
		if (!version) {
			//if no version was supplied, find the latest version of the service
			lib.getLatestVersion(serviceName, function (err, obtainedVersion) {
				if (err) {
					//todo: need to find a better way to do this log
					param.log.error(err);
					return cb(null);
				}
				
				getHost(obtainedVersion);
			});
		} else {
			getHost(version);
		}
		
		function getHost(version) {
			options.params.version = version;
			drivers.execute({
				"type": "container",
				"driver": options.strategy
			}, 'getServiceHost', options, (error, response) => {
				if (error) {
					param.log.error(error);
					return cb(null);
				}
				
				//lib.setHostInCache(serviceName, version, response);
				param.log.debug(' .... got ' + serviceName + ' - ' + version + ' - ' + response + ' from cluster API');
				return cb(response);
			});
		}
	},
	
	"rebuildAwarenessCache": function () {
		let myCache = {};
		let options = lib.constructDriverParam();
		drivers.execute({
			"type": "container",
			"driver": options.strategy
		}, 'listServices', options, (error, services) => {
			if (error) {
				param.log.error(error);
				return;
			}
			
			async.each(services, function (oneService, callback) {
				let version, serviceName;
				if (oneService.labels['soajs.service.type'] !== "service" && oneService.labels['soajs.service.type'] !== "daemon") {
					return callback();
				}
				if (oneService.labels && oneService.labels['soajs.service.version']) {
					version = oneService.labels['soajs.service.version'];
				}
				
				if (oneService.labels && oneService.labels['soajs.service.name']) {
					serviceName = oneService.labels['soajs.service.name'];
				}
				
				param.log.debug('Building awareness for ' + serviceName + ' - ' + version + ' ....');
				
				if (!serviceName) {
					return callback();
				}
				//if no version is found, lib.getHostFromAPI() will get it from cluster api
				lib.getHostFromAPI(serviceName, version, function (hostname) {
					if (!myCache[serviceName]) {
						myCache[serviceName] = {};
					}
					if (!myCache[serviceName][version]) {
						myCache[serviceName][version] = {};
					}
					myCache[serviceName][version].host = hostname;
					return callback();
				});
			}, function () {
				awarenessCache = myCache;
				param.log.debug("Awareness cache rebuilt successfully");
				param.log.debug(awarenessCache);
				
				let cacheTTL = core.registry.get().serviceConfig.awareness.cacheTTL;
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
		let serviceName, version, env, cb;
		serviceName = param.serviceName;
		cb = arguments[arguments.length - 1];
		
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
		
		env = regEnvironment;
		
		if (serviceName === param.serviceName) {
			if (process.env.SOAJS_DEPLOY_HA === 'kubernetes') {
				serviceName += "-v" + param.serviceVersion + "-service";
			}
			
			let info = core.registry.get().deployer.selected.split('.');
			let deployerConfig = core.registry.get().deployer.container[info[1]][info[2]];
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
				param.log.debug('Getting host for ' + serviceName + ' - ' + version + ' ....');
				lib.getHostFromAPI(serviceName, version, cb);
			}
		}
	},
	
	"getLatestVersionFromCache": function (serviceName) {
		if (!awarenessCache[serviceName]) {
			return null;
		}
		
		let serviceVersions = Object.keys(awarenessCache[serviceName]);
		if (serviceVersions.length === 0) {
			return null;
		}
		let latestVersion = null;
		for (let i = 0; i < serviceVersions.length; i++) {
			latestVersion = coreLibs.version.getLatest(latestVersion, serviceVersions[i]);
			/*
			if (serviceVersions[i] > latestVersion) {
				latestVersion = serviceVersions[i];
			}
			*/
		}
		if (latestVersion) {
			return latestVersion;
		} else {
			return null;
		}
	}
};

module.exports = ha;
