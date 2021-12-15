"use strict";

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const async = require('async');
const os = require("os");
const soajsLib = require("soajs.core.libs");

let regEnvironment = (process.env.SOAJS_ENV || "dev");
regEnvironment = regEnvironment.toLowerCase();

let registry_struct = {};
registry_struct[regEnvironment] = null;

let autoReloadTimeout = {};

let modelName = "mongo";
if (process.env.SOAJS_SOLO && process.env.SOAJS_SOLO === "true") {
	modelName = "local";
}
const model = require("./" + modelName + ".js");

let sensitiveEnvCodes = ["dashboard"];
if (process.env.SOAJS_SENSITIVE_ENVS) {
	let temp_sensitiveEnvCodes = null;
	try {
		temp_sensitiveEnvCodes = JSON.parse(process.env.SOAJS_SENSITIVE_ENVS);
	} catch (e) {
		temp_sensitiveEnvCodes = null;
	}
	if (Array.isArray(temp_sensitiveEnvCodes) && temp_sensitiveEnvCodes > 0) {
		sensitiveEnvCodes = temp_sensitiveEnvCodes;
	}
}

let build = {
	"metaAndCoreDB": (STRUCT, envCode, timeLoaded) => {
		let metaAndCoreDB = {"metaDB": {}, "coreDB": {}};
		
		if (STRUCT && STRUCT.dbs && STRUCT.dbs.databases) {
			for (let dbName in STRUCT.dbs.databases) {
				if (Object.hasOwnProperty.call(STRUCT.dbs.databases, dbName)) {
					let dbRec = STRUCT.dbs.databases[dbName];
					let dbObj = null;
					
					if (dbRec.cluster) {
						let clusterRec = {};
						if (STRUCT.dbs.clusters && STRUCT.dbs.clusters[dbRec.cluster]) {
							clusterRec = STRUCT.dbs.clusters[dbRec.cluster];
						} else if (STRUCT.resources && STRUCT.resources.cluster && STRUCT.resources.cluster[dbRec.cluster]) {
							clusterRec = STRUCT.resources.cluster[dbRec.cluster];
						}
						dbObj = {
							"prefix": (dbRec.prefix && dbRec.prefix !== "") ? dbRec.prefix : STRUCT.dbs.config.prefix,
							"cluster": dbRec.cluster
						};
						if (clusterRec.config) {
							for (let dataConf in clusterRec.config) {
								if (Object.hasOwnProperty.call(clusterRec.config, dataConf)) {
									dbObj[dataConf] = clusterRec.config[dataConf];
								}
							}
						} else {
							dbObj.servers = clusterRec.servers || null;
							dbObj.credentials = clusterRec.credentials || null;
							dbObj.streaming = clusterRec.streaming || null;
							dbObj.URLParam = clusterRec.URLParam || null;
							dbObj.extraParam = clusterRec.extraParam || null;
						}
					} else {
						dbObj = {
							"prefix": (dbRec.prefix && dbRec.prefix !== "") ? dbRec.prefix : STRUCT.dbs.config.prefix,
							"servers": dbRec.servers || null,
							"credentials": dbRec.credentials,
							"streaming": dbRec.streaming || null,
							"URLParam": dbRec.URLParam || null,
							"extraParam": dbRec.extraParam || null
						};
					}
					if (dbRec.tenantSpecific) {
						dbObj.name = "#TENANT_NAME#_" + dbName;
						metaAndCoreDB.metaDB[dbName] = dbObj;
						if (dbRec.cluster) {
							dbObj.registryLocation = {
								"l1": "metaDB",
								"l2": dbObj.name,
								"env": envCode,
								"cluster": dbRec.cluster,
								"timeLoaded": timeLoaded
							};
						}
					} else {
						dbObj.registryLocation = {
							"l1": "coreDB",
							"l2": dbName,
							"env": envCode,
							"timeLoaded": timeLoaded
						};
						if (dbRec.cluster) {
							dbObj.registryLocation.cluster = dbRec.cluster;
						}
						dbObj.name = dbName;
						metaAndCoreDB.coreDB[dbName] = dbObj;
					}
				}
			}
		}
		return metaAndCoreDB;
	},
	
	"sessionDB": (STRUCT, env, timeLoaded) => {
		let sessionDB = null;
		if (STRUCT && STRUCT.dbs && STRUCT.dbs.config) {
			let dbRec = {};
			if (STRUCT.dbs.config.session) {
				dbRec = STRUCT.dbs.config.session;
			} else if (STRUCT.dbs.session) {
				dbRec = STRUCT.dbs.session;
			}
			sessionDB = {
				"name": dbRec.name,
				"prefix": (dbRec.prefix && dbRec.prefix !== "") ? dbRec.prefix : STRUCT.dbs.config.prefix,
				'store': dbRec.store,
				"collection": dbRec.collection,
				'stringify': dbRec.stringify,
				'expireAfter': dbRec.expireAfter,
				'registryLocation': {
					"l1": "coreDB", "l2": "session", "env": env, "timeLoaded": timeLoaded
				}
			};
			if (dbRec.cluster) {
				let clusterRec = {};
				if (STRUCT.dbs.clusters && STRUCT.dbs.clusters[dbRec.cluster]) {
					clusterRec = STRUCT.dbs.clusters[dbRec.cluster];
				} else if (STRUCT.resources && STRUCT.resources.cluster && STRUCT.resources.cluster[dbRec.cluster]) {
					clusterRec = STRUCT.resources.cluster[dbRec.cluster];
				}
				sessionDB.cluster = dbRec.cluster;
				sessionDB.registryLocation.cluster = dbRec.cluster;
				
				if (clusterRec.config) {
					for (let dataConf in clusterRec.config) {
						if (Object.hasOwnProperty.call(clusterRec.config, dataConf)) {
							sessionDB[dataConf] = clusterRec.config[dataConf];
						}
					}
				} else {
					sessionDB.servers = clusterRec.servers || null;
					sessionDB.credentials = clusterRec.credentials || null;
					sessionDB.URLParam = clusterRec.URLParam || null;
					sessionDB.extraParam = clusterRec.extraParam || null;
				}
			} else {
				sessionDB.servers = dbRec.servers || null;
				sessionDB.credentials = dbRec.credentials || null;
				sessionDB.URLParam = dbRec.URLParam || null;
				sessionDB.extraParam = dbRec.extraParam || null;
			}
		}
		return sessionDB;
	},
	
	"registerNewService": (dbConfiguration, serviceObj, collection, cb) => {
		if (process.env.SOAJS_DEPLOY_HA) {
			return cb(null);
		}
		let port = parseInt(serviceObj.configuration.port);
		if (isNaN(port)) {
			let error1 = new Error('Service port must be integer: [' + serviceObj.configuration.port + ']');
			return cb(error1);
		}
		return model.registerNewService(dbConfiguration, serviceObj, collection, cb);
	},
	
	"allServices": (STRUCT, servicesObj, gatewayServiceName) => {
		if (STRUCT && Array.isArray(STRUCT) && STRUCT.length > 0) {
			for (let i = 0; i < STRUCT.length; i++) {
				if (STRUCT[i].name === gatewayServiceName || STRUCT[i].name === "controller") {
					continue;
				}
				servicesObj[STRUCT[i].name] = {
					"group": STRUCT[i].configuration.group || "service",
					"port": STRUCT[i].configuration.port,
					"requestTimeoutRenewal": STRUCT[i].configuration.requestTimeoutRenewal || 0,
					"requestTimeout": STRUCT[i].configuration.requestTimeout || 30,
				};
				if (STRUCT[i].src && STRUCT[i].src.provider && STRUCT[i].src.provider === "apibuilder") {
					servicesObj[STRUCT[i].name].type = STRUCT[i].type;
					servicesObj[STRUCT[i].name].subType = STRUCT[i].configuration.subType;
					servicesObj[STRUCT[i].name].src = STRUCT[i].src;
				}
				if (STRUCT[i].versions) {
					servicesObj[STRUCT[i].name].versions = {};
					for (let j = 0; j < STRUCT[i].versions.length; j++) {
						let ver = STRUCT[i].versions[j];
						servicesObj[STRUCT[i].name].versions[ver.version] = {
							"extKeyRequired": ver.extKeyRequired || false,
							"urac": ver.urac || false,
							"urac_Profile": ver.urac_Profile || false,
							"urac_ACL": ver.urac_ACL || false,
							"urac_Config": ver.urac_Config || false,
							"urac_GroupConfig": ver.urac_GroupConfig || false,
							"tenant_Profile": ver.tenant_Profile || false,
							"provision_ACL": ver.provision_ACL || false,
							"oauth": ver.oauth || false,
							"interConnect": ver.interConnect || null,
							"maintenance": ver.maintenance || null
						};
						//NOTE: set heartbeat on root object
						if (!servicesObj[STRUCT[i].name].maintenance && ver.maintenance) {
							if (ver.maintenance.readiness && ver.maintenance.port) {
								servicesObj[STRUCT[i].name].maintenance = {
									"readiness": ver.maintenance.readiness,
									"port": ver.maintenance.port
								};
							}
						}
						//TODO: remove the below after checking if these root values are nto needed anymore
						// version at the root level is bing use in buildextrapram when type is endpoint to get the latest
						if (!servicesObj[STRUCT[i].name].version) {
							servicesObj[STRUCT[i].name].version = ver.version;
							servicesObj[STRUCT[i].name].extKeyRequired = servicesObj[STRUCT[i].name].versions[ver.version].extKeyRequired || false;
							servicesObj[STRUCT[i].name].oauth = servicesObj[STRUCT[i].name].versions[ver.version].oauth || false;
						} else if (soajsLib.version.isLatest(ver.version, servicesObj[STRUCT[i].name].version)) {
							servicesObj[STRUCT[i].name].version = ver.version;
							servicesObj[STRUCT[i].name].extKeyRequired = servicesObj[STRUCT[i].name].versions[ver.version].extKeyRequired || false;
							servicesObj[STRUCT[i].name].oauth = servicesObj[STRUCT[i].name].versions[ver.version].oauth || false;
						}
					}
				}
			}
		}
	},
	
	"allDaemons": (STRUCT, servicesObj, gatewayServiceName) => {
		if (STRUCT && Array.isArray(STRUCT) && STRUCT.length > 0) {
			for (let i = 0; i < STRUCT.length; i++) {
				if (STRUCT[i].name === gatewayServiceName) {
					continue;
				}
				servicesObj[STRUCT[i].name] = {
					"group": STRUCT[i].configuration.group || "mdaemon",
					"port": STRUCT[i].configuration.port
				};
				if (STRUCT[i].versions) {
					servicesObj[STRUCT[i].name].versions = {};
					for (let j = 0; j < STRUCT[i].versions.length; j++) {
						let ver = STRUCT[i].versions[j];
						servicesObj[STRUCT[i].name].versions[ver.version] = {
							"maintenance": ver.maintenance || null
						};
						//NOTE: set heartbeat on root object
						if (!servicesObj[STRUCT[i].name].maintenance && ver.maintenance) {
							if (ver.maintenance.readiness && ver.maintenance.port) {
								servicesObj[STRUCT[i].name].maintenance = {
									"readiness": ver.maintenance.readiness,
									"port": ver.maintenance.port
								};
							}
						}
					}
				}
			}
		}
	},
	
	"servicesHosts": (STRUCT, servicesObj) => {
		if (STRUCT && Array.isArray(STRUCT) && STRUCT.length > 0) {
			for (let i = 0; i < STRUCT.length; i++) {
				//if (STRUCT[i].env === regEnvironment) {
				if (servicesObj[STRUCT[i].name] && STRUCT[i].name !== "controller") {
					//if (STRUCT[i].env.toUpperCase() !== "DASHBOARD" && STRUCT[i].port && !isNaN(STRUCT[i].port)) {
					if (!sensitiveEnvCodes.includes(STRUCT[i].env.toLowerCase()) && STRUCT[i].port && !isNaN(STRUCT[i].port)) {
						servicesObj[STRUCT[i].name].oport = servicesObj[STRUCT[i].name].port;
						servicesObj[STRUCT[i].name].port = STRUCT[i].port;
					}
					
					if (!STRUCT[i].version) {
						STRUCT[i].version = "1";
					}
					if (!servicesObj[STRUCT[i].name].hosts) {
						servicesObj[STRUCT[i].name].hosts = {};
						servicesObj[STRUCT[i].name].hosts.latest = STRUCT[i].version;
						servicesObj[STRUCT[i].name].hosts[STRUCT[i].version] = [];
					}
					if (!servicesObj[STRUCT[i].name].hosts[STRUCT[i].version]) {
						servicesObj[STRUCT[i].name].hosts[STRUCT[i].version] = [];
					}
					if (soajsLib.version.isLatest(STRUCT[i].version, servicesObj[STRUCT[i].name].hosts.latest)) {
						servicesObj[STRUCT[i].name].hosts.latest = STRUCT[i].version;
					}
					if (servicesObj[STRUCT[i].name].hosts[STRUCT[i].version].indexOf(STRUCT[i].ip) === -1) {
						servicesObj[STRUCT[i].name].hosts[STRUCT[i].version].push(STRUCT[i].ip);
					}
				}
				//}
			}
		}
	},
	
	"controllerHosts": (STRUCT, controllerObj) => {
		if (STRUCT && Array.isArray(STRUCT) && STRUCT.length > 0) {
			for (let i = 0; i < STRUCT.length; i++) {
				//if (STRUCT[i].name === controllerObj.name && STRUCT[i].env === regEnvironment) {
				if (STRUCT[i].name === controllerObj.name) {
					if (!STRUCT[i].version) {
						STRUCT[i].version = controllerObj.version;
					}
					if (!controllerObj.hosts) {
						controllerObj.hosts = {};
						controllerObj.hosts.latest = STRUCT[i].version;
						controllerObj.hosts[STRUCT[i].version] = [];
					}
					if (!controllerObj.hosts[STRUCT[i].version]) {
						controllerObj.hosts[STRUCT[i].version] = [];
					}
					if (STRUCT[i].version > controllerObj.hosts.latest) {
						controllerObj.hosts.latest = STRUCT[i].version;
					}
					if (controllerObj.hosts[STRUCT[i].version].indexOf(STRUCT[i].ip) === -1) {
						controllerObj.hosts[STRUCT[i].version].push(STRUCT[i].ip);
					}
				}
			}
		}
	},
};

function buildRegistry(param, registry, registryDBInfo, callback) {
	let metaAndCoreDB = build.metaAndCoreDB(registryDBInfo.ENV_schema, registry.environment, registry.timeLoaded);
	registry.tenantMetaDB = metaAndCoreDB.metaDB;
	if (!registryDBInfo.ENV_schema || !registryDBInfo.ENV_schema.services || !registryDBInfo.ENV_schema.services.config) {
		return callback(new Error('Unable to get [' + registry.environment + '] environment services from db'));
	}
	
	registry.domain = registryDBInfo.ENV_schema.domain;
	registry.apiPrefix = registryDBInfo.ENV_schema.apiPrefix;
	registry.sitePrefix = registryDBInfo.ENV_schema.sitePrefix;
	registry.protocol = registryDBInfo.ENV_schema.protocol;
	registry.port = registryDBInfo.ENV_schema.port;
	
	registry.endpoints = registryDBInfo.ENV_schema.endpoints || {};
	
	registry.serviceConfig = registryDBInfo.ENV_schema.services.config;
	
	registry.deployer = registryDBInfo.ENV_schema.deployer || {};
	
	registry.custom = registryDBInfo.ENV_schema.custom || {};
	
	registry.resources = registryDBInfo.ENV_schema.resources || {};
	
	for (let coreDBName in metaAndCoreDB.coreDB) {
		if (Object.hasOwnProperty.call(metaAndCoreDB.coreDB, coreDBName)) {
			registry.coreDB[coreDBName] = metaAndCoreDB.coreDB[coreDBName];
		}
	}
	
	registry.services = {
		"controller": {
			"name": registryDBInfo.ENV_schema.services.controller.name || "controller",
			"group": registryDBInfo.ENV_schema.services.controller.group || "Gateway",
			"version": registryDBInfo.ENV_schema.services.controller.version || "1",
			"maxPoolSize": registryDBInfo.ENV_schema.services.controller.maxPoolSize,
			"authorization": registryDBInfo.ENV_schema.services.controller.authorization,
			"port": registryDBInfo.ENV_schema.services.config.ports.controller,
			"requestTimeout": registryDBInfo.ENV_schema.services.controller.requestTimeout || 30,
			"requestTimeoutRenewal": registryDBInfo.ENV_schema.services.controller.requestTimeoutRenewal || 0
		}
	};
	
	registry.coreDB.session = build.sessionDB(registryDBInfo.ENV_schema, registry.environment, registry.timeLoaded);
	
	registry.daemons = {};
	return callback(null, registry);
}

function buildSpecificRegistry(param, options, registry, registryDBInfo, callback) {
	//IF: gateway
	if (param.name === registry.services.controller.name) {
		
		build.allServices(registryDBInfo.services_schema, registry.services, registry.services.controller.name);
		if (!process.env.SOAJS_DEPLOY_HA) {
			build.servicesHosts(registryDBInfo.ENV_hosts, registry.services);
		}
		
		build.allDaemons(registryDBInfo.daemons_schema, registry.daemons, registry.services.controller.name);
		if (!process.env.SOAJS_DEPLOY_HA) {
			build.servicesHosts(registryDBInfo.ENV_hosts, registry.daemons);
		}
		
		if (!process.env.SOAJS_DEPLOY_HA) {
			build.controllerHosts(registryDBInfo.ENV_hosts, registry.services.controller);
		}
		
		if (process.env.SOAJS_DEPLOY_HA || options.reload || options.setBy === "loadByEnv") {
			return callback(null, registry);
		}
		
		// Only register gateway item if not reload and not HA and not loadByEnv
		let newServiceObj = {
			'type': 'service',
			'name': registry.services.controller.name,
			'configuration': {
				'subType': 'soajs',
				'port': param.oPort,
				'group': registry.services.controller.group
			},
			'versions': [
				{
					"version": registry.services.controller.version
				}
			]
		};
		if (param.maintenance) {
			newServiceObj.versions[0].maintenance = param.maintenance;
		}
		build.registerNewService(registry.coreDB.provision, newServiceObj, 'marketplace', function (error) {
			if (error) {
				return callback(new Error('Unable to register new service ' + param.name + ' : ' + error.message));
			}
			if (param.ip) {
				if (registry.serviceConfig.awareness.autoRegisterService) {
					if (!registry.services.controller.hosts) {
						registry.services.controller.hosts = {};
						registry.services.controller.hosts.latest = param.version;
						registry.services.controller.hosts[param.version] = [];
					}
					if (!registry.services.controller.hosts[param.version]) {
						registry.services.controller.hosts[param.version] = [];
					}
					if (registry.services.controller.hosts[param.version].indexOf(param.ip) === -1) {
						registry.services.controller.hosts[param.version].push(param.ip);
					}
				}
				return callback(null, registry);
			} else {
				return callback(new Error("Unable to register new host ip [" + param.ip + "] for gateway"));
			}
		});
	} else {
		//NOTE: not gateway
		return callback(null, registry);
	}
}

function getRegistry(param, options, cb) {
	if (options.reload || process.env.SOAJS_TEST || !registry_struct[options.envCode]) {
		model.loadProfile(options.envCode, (err, registry) => {
			if (registry) {
				model.loadData(registry.coreDB.provision, registry.environment, param, (error, RegistryFromDB) => {
					if (error) {
						return cb(error);
					}
					if (!RegistryFromDB) {
						return cb(new Error("Unable to find any registry data!"));
					}
					registry.setBy = options.setBy;
					buildRegistry(param, registry, RegistryFromDB, (error, registry) => {
						if (error) {
							return cb(error);
						}
						if (options.donotBbuildSpecificRegistry) {
							if (registry) {
								if (!registry_struct[options.envCode]) {
									registry_struct[options.envCode] = registry;
								} else {
									for (let regEntry in registry) {
										if (registry.hasOwnProperty(regEntry)) {
											if ("services" === regEntry) {
												for (let regSvcEntry in registry.services) {
													if (registry.services.hasOwnProperty(regSvcEntry)) {
														registry_struct[options.envCode].services[regSvcEntry] = registry.services[regSvcEntry];
													}
												}
											} else {
												registry_struct[options.envCode][regEntry] = registry[regEntry];
											}
										}
									}
								}
							}
							return cb(null, registry_struct[options.envCode]);
						} else {
							buildSpecificRegistry(param, options, registry, RegistryFromDB, function (error, registry) {
								if (error) {
									return cb(error);
								}
								if (registry) {
									registry_struct[options.envCode] = registry;
								}
								if (registry && registry.serviceConfig.awareness.autoRelaodRegistry) {
									let autoReload = () => {
										options.setBy = "autoReload";
										getRegistry(param, options, () => {
											// cb(err, reg);
										});
									};
									if (!autoReloadTimeout[options.envCode]) {
										autoReloadTimeout[options.envCode] = {};
									}
									if (autoReloadTimeout[options.envCode].timeout) {
										clearTimeout(autoReloadTimeout[options.envCode].timeout);
									}
									autoReloadTimeout[options.envCode].setBy = options.setBy;
									autoReloadTimeout[options.envCode].timeout = setTimeout(autoReload, registry.serviceConfig.awareness.autoRelaodRegistry);
								}
								
								return cb(null, registry_struct[options.envCode]);
							});
						}
					});
				});
			} else {
				return cb(new Error("Empty profile, unable to continue loading registry"));
			}
		});
	} else {
		return cb(null, registry_struct[options.envCode]);
	}
}

let registryModule = {
	"loadOtherEnvControllerHosts": (gatewayServiceName, cb) => {
		let dbConfig = null;
		if (!cb && typeof gatewayServiceName === "function") {
			cb = gatewayServiceName;
			gatewayServiceName = "controller";
		}
		let getHosts = () => {
			if (dbConfig) {
				return model.loadOtherEnvHosts({
					"gatewayName": gatewayServiceName,
					"envCode": regEnvironment,
					"dbConfig": dbConfig
				}, cb);
			} else {
				return cb(new Error("unable to find provision config information to connect to!"));
			}
		};
		if (registry_struct[regEnvironment]) {
			dbConfig = registry_struct[regEnvironment].coreDB.provision;
			getHosts();
		} else {
			model.loadProfile(regEnvironment, (err, registry) => {
				dbConfig = registry.coreDB.provision;
				getHosts();
			});
		}
	},
	"addUpdateEnvControllers": (param, cb) => {
		model.addUpdateEnvControllers(param, cb);
	},
	"registerHost": (param, registry, cb) => {
		if (param.ip) {
			let hostObj = {
				'type': param.type,
				'env': registry.name.toLowerCase(),
				'name': param.name,
				'ip': param.ip,
				'port': param.port,
				'hostname': os.hostname().toLowerCase(),
				'version': param.version
			};
			if (param.serviceHATask) {
				hostObj.serviceHATask = param.serviceHATask;
			}
			model.addUpdateServiceIP(registry.coreDB.provision, hostObj, (error, registered) => {
				if (error) {
					throw new Error("Unable to register new host for service:" + error.message);
				}
				cb(registered);
			});
		} else {
			cb(false);
		}
	},
	"register": (param, cb) => {
		if (param.ip && param.name) {
			param.extKeyRequired = param.extKeyRequired || false;
			let what = ((param.type === "service") ? "services" : "daemons");
			if (!registry_struct[regEnvironment][what][param.name]) {
				if (!param.port) {
					return cb(new Error("unable to register service. missing port param"));
				}
				if (param.type === "service") {
					registry_struct[regEnvironment][what][param.name] = {
						"group": param.group,
						"port": param.port,
						"requestTimeout": param.requestTimeout,
						"requestTimeoutRenewal": param.requestTimeoutRenewal
					};
				} else {
					registry_struct[regEnvironment][what][param.name] = {
						"group": param.group,
						"port": param.port
					};
				}
			}
			if (registry_struct[regEnvironment][what][param.name].port !== param.port) {
				registry_struct[regEnvironment][what][param.name].port = param.port;
			}
			if (!registry_struct[regEnvironment][what][param.name].versions) {
				registry_struct[regEnvironment][what][param.name].versions = {};
			}
			if (!registry_struct[regEnvironment][what][param.name].versions[param.version]) {
				registry_struct[regEnvironment][what][param.name].versions[param.version] = {};
			}
			if (param.maintenance) {
				registry_struct[regEnvironment][what][param.name].versions[param.version].maintenance = param.maintenance;
			}
			if ("service" === param.type) {
				registry_struct[regEnvironment][what][param.name].extKeyRequired = param.extKeyRequired;
				registry_struct[regEnvironment][what][param.name].version = param.version;
				
				registry_struct[regEnvironment][what][param.name].versions[param.version].extKeyRequired = param.extKeyRequired;
				registry_struct[regEnvironment][what][param.name].versions[param.version].oauth = param.oauth;
				registry_struct[regEnvironment][what][param.name].versions[param.version].urac = param.urac;
				registry_struct[regEnvironment][what][param.name].versions[param.version].urac_Profile = param.urac_Profile;
				registry_struct[regEnvironment][what][param.name].versions[param.version].urac_ACL = param.urac_ACL;
				registry_struct[regEnvironment][what][param.name].versions[param.version].urac_Config = param.urac_Config;
				registry_struct[regEnvironment][what][param.name].versions[param.version].urac_GroupConfig = param.urac_GroupConfig;
				registry_struct[regEnvironment][what][param.name].versions[param.version].tenant_Profile = param.tenant_Profile;
				registry_struct[regEnvironment][what][param.name].versions[param.version].provision_ACL = param.provision_ACL;
				registry_struct[regEnvironment][what][param.name].versions[param.version].interConnect = param.interConnect;
			}
			
			if (!registry_struct[regEnvironment][what][param.name].hosts) {
				registry_struct[regEnvironment][what][param.name].hosts = {};
				registry_struct[regEnvironment][what][param.name].hosts.latest = param.version;
			}
			
			if (!registry_struct[regEnvironment][what][param.name].hosts[param.version]) {
				registry_struct[regEnvironment][what][param.name].hosts[param.version] = [];
			}
			
			if (registry_struct[regEnvironment][what][param.name].hosts[param.version].indexOf(param.ip) === -1) {
				registry_struct[regEnvironment][what][param.name].hosts[param.version].push(param.ip);
			}
			registry_struct[regEnvironment].timeLoaded = new Date().getTime();
			
			//register in DB if MW
			if (param.mw) {
				if ("mdaemon" === param.type) {
					//adding daemon service for the first time to services collection
					let newDaemonServiceObj = {
						'type': param.type,
						'description': param.description,
						'name': param.name,
						'configuration': {
							'subType': param.subType,
							'group': param.group,
							'port': param.port
						},
						'versions': []
					};
					let verObj = {
						"version": param.version,
						"maintenance": param.maintenance || null
					};
					if (param.jobList) {
						verObj.jobs = param.jobList;
					}
					newDaemonServiceObj.versions.push(verObj);
					if (param.portHost) {
						registry_struct[regEnvironment][what][param.name].port = param.portHost;
					}
					
					try {
						registryModule.registerHost({
							"type": param.type,
							"name": param.name,
							"version": param.version,
							"port": param.portHost || param.port,
							"ip": param.ip
						}, registry_struct[regEnvironment], () => {
						});
					}
					catch (e) {
					
					}
					build.registerNewService(registry_struct[regEnvironment].coreDB.provision, newDaemonServiceObj, 'marketplace', (error) => {
						if (error) {
							let err = new Error('Unable to register new daemon service ' + param.name + ' : ' + error.message);
							return cb(err);
						}
						return cb(null, registry_struct[regEnvironment][what][param.name]);
					});
				} else {
					//adding service for the first time to services collection
					let newServiceObj = {
						'type': param.type,
						'description': param.description,
						'name': param.name,
						'configuration': {
							'subType': param.subType,
							'group': param.group,
							'port': param.port,
							'requestTimeout': param.requestTimeout,
							'requestTimeoutRenewal': param.requestTimeoutRenewal,
						},
						'versions': []
					};
					let verObj = {
						"version": param.version,
						"extKeyRequired": param.extKeyRequired,
						"urac": param.urac,
						"urac_Profile": param.urac_Profile,
						"urac_ACL": param.urac_ACL,
						"urac_Config": param.urac_Config,
						"urac_GroupConfig": param.urac_GroupConfig,
						"tenant_Profile": param.tenant_Profile,
						"provision_ACL": param.provision_ACL,
						"oauth": param.oauth,
						"interConnect": param.interConnect,
						"maintenance": param.maintenance || null
					};
					if (param.apiList) {
						verObj.apis = param.apiList;
					}
					newServiceObj.versions.push(verObj);
					
					if (param.portHost) {
						registry_struct[regEnvironment][what][param.name].port = param.portHost;
					}
					try {
						registryModule.registerHost({
							"type": param.type,
							"name": param.name,
							"version": param.version,
							"port": param.portHost || param.port,
							"ip": param.ip
						}, registry_struct[regEnvironment], () => {
						});
					}
					catch (e) {
					
					}
					
					build.registerNewService(registry_struct[regEnvironment].coreDB.provision, newServiceObj, 'marketplace', (error) => {
						if (error) {
							let err = new Error('Unable to register new service ' + param.name + ' : ' + error.message);
							return cb(err);
						}
						return cb(null, registry_struct[regEnvironment][what][param.name]);
					});
				}
			} else {
				return cb(null, registry_struct[regEnvironment][what][param.name]);
			}
		} else {
			return cb(new Error("unable to register service. missing ip or name param"));
		}
	},
	"loadByEnv": (param, cb) => {
		let options = {
			"reload": param.reload || false,
			"envCode": param.envCode.toLowerCase(),
			"setBy": "loadByEnv"
		};
		if (!param.hasOwnProperty("donotBbuildSpecificRegistry")) {
			options.donotBbuildSpecificRegistry = true;
		}
		if (options.envCode === regEnvironment && registry_struct[options.envCode]) {
			return cb(null, registry_struct[options.envCode]);
		}
		return getRegistry(param, options, (err, reg) => {
			if (err) {
				return cb(err);
			}
			return cb(null, reg);
		});
	},
	"get": (envCode) => {
		let env = envCode || regEnvironment;
		if (registry_struct[env]) {
			return registry_struct[env];
		} else {
			return null;
		}
	},
	"load": (param, cb) => {
		let options = {
			"reload": false,
			"envCode": regEnvironment,
			"setBy": "load"
		};
		return getRegistry(param, options, (err, reg) => {
			if (err) {
				throw new Error('Unable to load Registry Db Info: ' + err.message);
			} else {
				return cb(reg);
			}
		});
	},
	"reload": (param, cb) => {
		let options = {
			"reload": true,
			"envCode": regEnvironment,
			"setBy": "reload"
		};
		getRegistry(param, options, (err, reg) => {
			cb(err, reg);
			let envArray = [];
			for (let envCode in registry_struct) {
				if (registry_struct.hasOwnProperty(envCode)) {
					if (envCode !== regEnvironment && registry_struct[envCode]) {
						envArray.push({
							"options": {"reload": true, "envCode": envCode, "setBy": "reload"},
							"param": param
						});
					}
				}
			}
			if (envArray.length > 0) {
				async.mapSeries(envArray, (a, cb) => {
					getRegistry(a.param, a.options, cb);
				}, () => {
				});
			}
		});
	}
};

module.exports = registryModule;
