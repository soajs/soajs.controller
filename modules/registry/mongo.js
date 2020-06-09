"use strict";

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const soajsLib = require("soajs.core.libs");
const soajsUtils = soajsLib.utils;

const core = require('soajs.core.modules');
const Mongo = core.mongo;
const fs = require('fs');
const regFile = (process.env.SOAJS_PROFILE || __dirname + "/../../profiles/single.js");
const environmentCollectionName = 'environment';
const hostCollectionName = 'hosts';
const resourcesCollectionName = 'resources';
const customCollectionName = 'custom_registry';
const marketplaceCollectionName = 'marketplace';
const controllersCollectionName = 'controllers';

function buildResources(destination, resources, envCode) {
	if (resources && Array.isArray(resources) && resources.length > 0) {
		for (let i = 0; i < resources.length; i++) {
			if (resources[i].type) {
				if (!destination[resources[i].type]) {
					destination[resources[i].type] = {};
				}
				if (resources[i].created === envCode.toUpperCase() || !resources[i].sharedEnvs || (resources[i].sharedEnvs && resources[i].sharedEnvs[envCode.toUpperCase()])) {
					destination[resources[i].type][resources[i].name] = resources[i];
				}
			}
		}
	}
}

function buildCustomRegistry(destination, custom, envCode) {
	if (custom && Array.isArray(custom) && custom.length > 0) {
		for (let i = 0; i < custom.length; i++) {
			if (custom[i].created === envCode.toUpperCase() || !custom[i].sharedEnvs || (custom[i].sharedEnvs && custom[i].sharedEnvs[envCode.toUpperCase()])) {
				destination[custom[i].name] = custom[i];
			}
		}
	}
}

let model = {
	"mongo": null,
	"init": (dbConfiguration) => {
		if (!model.mongo) {
			model.mongo = new Mongo(dbConfiguration);
		}
	},
	"loadData": (dbConfiguration, envCode, param, callback) => {
		model.init(dbConfiguration);
		model.mongo.findOne(environmentCollectionName, {'code': envCode.toUpperCase()}, (error, envRecord) => {
			if (error) {
				return callback(error);
			}
			let obj = {};
			if (envRecord && JSON.stringify(envRecord) !== '{}') {
				obj.ENV_schema = envRecord;
			} else {
				obj.ENV_schema = {};
			}
			//build resources plugged for this environment
			let criteria = {};
			if ("DASHBOARD" === envCode.toUpperCase()) {
				criteria = {
					'created': envCode.toUpperCase(),
					'plugged': true
				};
			} else {
				criteria = {
					$or: [
						{
							'created': envCode.toUpperCase(),
							'plugged': true
						}, {
							// 'created': "DASHBOARD",
							'plugged': true,
							'shared': true
						}]
				};
			}
			model.mongo.find(resourcesCollectionName, criteria, null, (error, resourcesRecords) => {
				obj.ENV_schema.resources = {};
				if (resourcesRecords) {
					buildResources(obj.ENV_schema.resources, resourcesRecords, envCode);
				}
				//build custom registry
				model.mongo.find(customCollectionName, criteria, null, (error, customRecords) => {
					if (!obj.ENV_schema.custom) {
						obj.ENV_schema.custom = {};
					}
					if (customRecords) {
						buildCustomRegistry(obj.ENV_schema.custom, customRecords, envCode);
					}
					//FIX
					model.mongo.find(marketplaceCollectionName, {"$or": [{'type': 'service'}, {'type': 'endpoint'}]}, null, (error, servicesRecords) => {
						if (error) {
							return callback(error);
						}
						if (servicesRecords && Array.isArray(servicesRecords) && servicesRecords.length > 0) {
							obj.services_schema = servicesRecords;
						}
						//FIX
						model.mongo.find(marketplaceCollectionName, {'type': 'mdaemon'}, null, (error, daemonsRecords) => {
							if (error) {
								return callback(error);
							}
							if (servicesRecords && Array.isArray(daemonsRecords) && daemonsRecords.length > 0) {
								obj.daemons_schema = daemonsRecords;
							}
							if (process.env.SOAJS_DEPLOY_HA) {
								return callback(null, obj);
							} else {
								model.mongo.find(hostCollectionName, {'env': envCode}, null, (error, hostsRecords) => {
									if (error) {
										return callback(error);
									}
									if (hostsRecords && Array.isArray(hostsRecords) && hostsRecords.length > 0) {
										obj.ENV_hosts = hostsRecords;
									}
									return callback(null, obj);
								});
							}
						});
					});
				});
			});
		});
	},
	"loadProfile": (envFrom, cb) => {
		if (fs.existsSync(regFile)) {
			delete require.cache[require.resolve(regFile)];
			let regFileObj = require(regFile);
			if (regFileObj && typeof regFileObj === 'object') {
				let registry = {
					"timeLoaded": new Date().getTime(),
					"name": envFrom,
					"environment": envFrom,
					"profileOnly": true,
					"coreDB": {
						"provision": regFileObj
					}
				};
				registry.coreDB.provision.registryLocation = {
					"l1": "coreDB",
					"l2": "provision",
					"env": registry.environment,
					"timeLoaded": registry.timeLoaded
				};
				return cb(null, registry);
			} else {
				return cb(new Error('Invalid profile file: ' + regFile), null);
			}
		} else {
			return cb(new Error('Invalid profile path: ' + regFile), null);
		}
	},
	
	"addUpdateServiceIP": (dbConfiguration, hostObj, cb) => {
		model.init(dbConfiguration);
		if (hostObj) {
			let criteria = {
				'env': hostObj.env,
				'name': hostObj.name,
				'version': hostObj.version
			};
			if (hostObj.serviceHATask) {
				criteria.serviceHATask = hostObj.serviceHATask;
			} else {
				criteria.ip = hostObj.ip;
				criteria.hostname = hostObj.hostname;
			}
			model.mongo.updateOne(hostCollectionName, criteria, {'$set': hostObj}, {'upsert': true}, (err) => {
				if (err) {
					return cb(err, false);
				} else {
					return cb(null, true);
				}
			});
		} else {
			return cb(null, false);
		}
	},
	
	"getAllEnvironments": (cb) => {
		if (model.mongo) {
			model.mongo.find(environmentCollectionName, {}, null, cb);
		} else {
			return cb(null, null);
		}
	},
	
	"loadOtherEnvHosts": (param, cb) => {
		model.init(param.dbConfig);
		let pattern = new RegExp(param.gatewayName, "i");
		let condition = (process.env.SOAJS_TEST) ? {'name': {'$regex': pattern}} : {
			'name': {'$regex': pattern},
			'env': {'$ne': param.envCode}
		};
		model.mongo.find(hostCollectionName, condition, null, cb);
	},
	"registerNewService": (dbConfiguration, serviceObj, collection, cb) => {
		model.init(dbConfiguration);
		model.mongo.findOne(collection, {
			'type': serviceObj.type,
			'configuration.port': serviceObj.configuration.port
		}, (error, record) => {
			if (error) {
				return cb(error, null);
			}
			if (record) {
				if (record.name === serviceObj.name) {
					// check for version and update
					let options = {};
					let s = {'$set': {}};
					
					if (serviceObj.description) {
						s.$set.description = serviceObj.description;
					}
					for (let p in serviceObj.configuration) {
						if (serviceObj.configuration.hasOwnProperty(p)) {
							s.$set["configuration." + p] = serviceObj.configuration[p];
						}
					}
					if (!record.versions || !Array.isArray(record.versions) || record.versions.length === 0) {
						s.$set.versions = serviceObj.versions;
					} else {
						let found = false;
						let ver_svc = serviceObj.versions[0];
						for (let i = 0; i < record.versions.length; i++) {
							let ver_rec = record.versions[i];
							if (ver_rec.version === ver_svc.version) {
								for (let p in ver_svc) {
									if (ver_svc.hasOwnProperty(p)) {
										s.$set['versions.$[elem].' + p] = ver_svc[p];
									}
								}
								options.arrayFilters = [{"elem.version": ver_svc.version}];
								found = true;
								break;
							}
						}
						if (!found) {
							s.$push = {versions: ver_svc};
						}
					}
					model.mongo.updateOne(collection, {'_id': record._id}, s, options, (error) => {
						return cb(error);
					});
				} else {
					return cb(new Error('Item of type [' + serviceObj.type + '] with port [' + serviceObj.configuration.port + '] is taken by [' + record.name + '].'));
				}
			} else {
				let s = {
					"type": serviceObj.type,
					"name": serviceObj.name,
					"configuration": serviceObj.configuration,
					"versions": serviceObj.versions
				};
				model.mongo.insertOne(collection, s, {}, false, (error) => {
					return cb(error);
				});
			}
		});
	},
	
	"addUpdateEnvControllers": (param, cb) => {
		let condition = {
			"env": param.env.toLowerCase(),
			"ip": param.ip
		};
		if (!process.env.SOAJS_MANUAL) {
			condition.ip = "127.0.0.1";
		}
		if (param.data && param.data.services) {
			for (let service in param.data.services) {
				if (param.data.services.hasOwnProperty(service)) {
					if (param.data.services[service].awarenessStats) {
						for (let hostIp in param.data.services[service].awarenessStats) {
							if (param.data.services[service].awarenessStats.hasOwnProperty(hostIp)) {
								let hostIp2 = hostIp.replace(/\./g, "_dot_");
								param.data.services[service].awarenessStats[hostIp2] = soajsUtils.cloneObj(param.data.services[service].awarenessStats[hostIp]);
								if (hostIp2 !== hostIp) {
									delete param.data.services[service].awarenessStats[hostIp];
								}
							}
						}
					}
					if (param.data.services[service].hosts) {
						for (let ver in param.data.services[service].hosts) {
							if (param.data.services[service].hosts.hasOwnProperty(ver)) {
								let san_ver = soajsLib.version.sanitize(ver);
								param.data.services[service].hosts[san_ver] = soajsUtils.cloneObj(param.data.services[service].hosts[ver]);
								if (san_ver !== ver) {
									delete param.data.services[service].hosts[ver];
								}
							}
						}
					}
					if (param.data.services[service].versions) {
						for (let ver in param.data.services[service].versions) {
							if (param.data.services[service].versions.hasOwnProperty(ver)) {
								let san_ver = soajsLib.version.sanitize(ver);
								param.data.services[service].versions[san_ver] = soajsUtils.cloneObj(param.data.services[service].versions[ver]);
								if (san_ver !== ver) {
									delete param.data.services[service].versions[ver];
								}
							}
						}
					}
				}
			}
		}
		
		if (param.data && param.data.daemons) {
			for (let service in param.data.daemons) {
				if (param.data.daemons.hasOwnProperty(service)) {
					if (param.data.daemons[service].awarenessStats) {
						for (let hostIp in param.data.daemons[service].awarenessStats) {
							if (param.data.daemons[service].awarenessStats.hasOwnProperty(hostIp)) {
								let hostIp2 = hostIp.replace(/\./g, "_dot_");
								param.data.daemons[service].awarenessStats[hostIp2] = soajsUtils.cloneObj(param.data.daemons[service].awarenessStats[hostIp]);
								delete param.data.daemons[service].awarenessStats[hostIp];
							}
						}
					}
					if (param.data.daemons[service].hosts) {
						for (let ver in param.data.daemons[service].hosts) {
							if (param.data.daemons[service].hosts.hasOwnProperty(ver)) {
								let san_ver = soajsLib.version.sanitize(ver);
								param.data.daemons[service].hosts[san_ver] = soajsUtils.cloneObj(param.data.daemons[service].hosts[ver]);
								delete param.data.daemons[service].hosts[ver];
							}
						}
					}
					if (param.data.daemons[service].versions) {
						for (let ver in param.data.daemons[service].versions) {
							if (param.data.daemons[service].versions.hasOwnProperty(ver)) {
								let san_ver = soajsLib.version.sanitize(ver);
								param.data.daemons[service].versions[san_ver] = soajsUtils.cloneObj(param.data.daemons[service].versions[ver]);
								delete param.data.daemons[service].versions[ver];
							}
						}
					}
				}
			}
		}
		let document = {
			"$set": {
				"data": param.data,
				"ts": param.ts
			}
		};
		model.mongo.updateOne(controllersCollectionName, condition, document, {"upsert": true}, cb);
	}
};

module.exports = model;