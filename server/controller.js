'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const connect = require("connect");
const http = require('http');

require("../lib/http");

const soajsLib = require("soajs.core.libs");
let soajsUtils = soajsLib.utils;
const coreModules = require("soajs.core.modules");
let core = coreModules.core;
let provision = coreModules.provision;

const lib = require("../lib");

const favicon_mw = require('../mw/favicon/index');
const cors_mw = require('../mw/cors/index');
const soajs_mw = require('../mw/soajs/index');
const response_mw = require('../mw/response/index');
const enhancer_mw = require('../mw/enhancer/index');
const awareness_mw = require('../mw/awareness/index');
const awarenessEnv_mw = require("../mw/awarenessEnv/index");
const url_mw = require("../mw/url/index");
const key_mw = require("../mw/key/index");
const keyACL_mw = require("../mw/keyACL/index");
const gotoService_mw = require("../mw/gotoService/index");
const mt_mw = require("../mw/mt/index");
const traffic_mw = require("../mw/traffic/index");

const utils = require("../utilities/utils");

let autoRegHost = process.env.SOAJS_SRV_AUTOREGISTERHOST || true;
if (autoRegHost && typeof(autoRegHost) !== 'boolean') {
	autoRegHost = (autoRegHost === 'true');
}
let regEnvironment = (process.env.SOAJS_ENV || "dev");
regEnvironment = regEnvironment.toLowerCase();

function Controller(config) {
	let _self = this;
	
	config = config || {};
	let param = lib.param(config);
	_self.soajs = {"param": param};
}

Controller.prototype.init = function (callback) {
	let _self = this;
	
	lib.ip(autoRegHost, (service) => {
		core.registry.load({
			"serviceName": _self.soajs.param.init.serviceName,
			"serviceGroup": _self.soajs.param.init.serviceGroup,
			"serviceVersion": _self.soajs.param.init.serviceVersion,
			"apiList": null,
			"serviceIp": service.ip,
			"maintenance": _self.soajs.param.config.maintenance
		}, (reg) => {
			let registry = reg;
			let log = core.getLogger(_self.soajs.param.init.serviceName, registry.serviceConfig.logger);
			if (service.fetched) {
				if (!service.fetched.result) {
					log.warn("Unable to find the service host ip. The service will NOT be registered for awareness.");
					log.info("IPs found: ", service.fetched.extra.ips);
					log.warn("The default service IP has been used [" + service.ip + "]");
				} else {
					log.info("The IP registered for service [" + _self.soajs.param.init.serviceName + "] awareness : ", service.fetched.ip);
				}
			}
			
			let app = connect();
			app.use(favicon_mw());
			app.use(soajs_mw({
				"log": log,
				"core": core
			}));
			app.use(cors_mw());
			app.use(response_mw({"controllerResponse": true}));
			
			log.info("Loading Provision ...");
			let dbConfig = registry.coreDB.provision;
			if (registry.coreDB.oauth) {
				dbConfig = {
					"provision": registry.coreDB.provision,
					"oauth": registry.coreDB.oauth
				};
			}
			provision.init(dbConfig, log);
			provision.loadProvision((loaded) => {
				if (loaded) {
					log.info("Service provision loaded.");
					let server = http.createServer(app);
					
					// Create maintenance routes
					let maintenance = require("./maintenance.js");
					let serverMaintenance = maintenance(core, log, _self.soajs.param.init, service.ip, regEnvironment, awareness_mw, soajsLib, provision);
					
					// Add gateway middleware
					app.use(awareness_mw.getMw({
						"awareness": _self.soajs.param.init.awareness,
						"serviceName": _self.soajs.param.init.serviceName,
						"core": core,
						"log": log,
						"serviceIp": service.ip
					}));
					log.info("Awareness middleware initialization done.");
					
					//added mw awarenessEnv so that proxy can use req.soajs.awarenessEnv.getHost('dev', cb)
					app.use(awarenessEnv_mw.getMw({
						"awarenessEnv": true,
						"serviceName": _self.soajs.param.init.serviceName,
						"core": core,
						"log": log
					}));
					log.info("AwarenessEnv middleware initialization done.");
					
					app.use(enhancer_mw());
					
					app.use(url_mw());
					
					app.use(key_mw({"provision": provision, "regEnvironment": regEnvironment}));
					
					app.use(keyACL_mw());
					
					app.use(gotoService_mw({
						"provision": provision,
						"serviceName": _self.soajs.param.init.serviceName,
						"serviceVersion": _self.soajs.param.init.serviceVersion,
						"serviceGroup": _self.soajs.param.init.serviceGroup,
						"core": core
					}));
					
					if (registry.serviceConfig.oauth) {
						let oauth_mw = require("../mw/oauth/index");
						// NOTE: oauth_mw is set on soajs.oauth and is triggered from inside mt_mw
						_self.soajs.oauth = oauth_mw({
							"soajs": _self.soajs,
							"serviceConfig": registry.serviceConfig,
							"model": provision.oauthModel
						});
						
						log.info("oAuth middleware initialization done.");
					}
					
					app.use(mt_mw({
						"soajs": _self.soajs,
						"app": app,
						"core": core,
						"serviceName": _self.soajs.param.init.serviceName,
						"regEnvironment": regEnvironment,
						"provision": provision
					}));
					log.info("SOAJS MT middleware initialization done.");
					
					app.use(traffic_mw({}));
					
					app.use((req, res, next) => {
						setImmediate(() => {
							req.soajs.controller.gotoservice(req, res, next);
						});
						
						req.on("error", (error) => {
							req.soajs.log.error("Error @ controller:", error);
							if (req.soajs.controller.redirectedRequest) {
								req.soajs.controller.redirectedRequest.abort();
							}
						});
						
						req.on("close", () => {
							if (req.soajs.controller.redirectedRequest) {
								req.soajs.log.info("Request closed:", req.url);
								req.soajs.controller.redirectedRequest.abort();
							}
						});
					});
					
					app.use(utils.logErrors);
					app.use(utils.controllerClientErrorHandler);
					app.use(utils.controllerErrorHandler);
					
					callback(registry, log, service, server, serverMaintenance);
				} else {
					log.error('Unable to load provision. controller will not start :(');
					callback(registry, log, service, null, null);
				}
			});
		});
	});
};

Controller.prototype.start = function (registry, log, service, server, serverMaintenance, callback) {
	let _self = this;
	let maintenancePort = registry.services.controller.port + registry.serviceConfig.ports.maintenanceInc;
	if (server) {
		server.on('error', (err) => {
			if (err.code === 'EADDRINUSE') {
				log.error('Address [port: ' + registry.services.controller.port + '] in use by another service, exiting');
			}
			else {
				log.error(err);
			}
		});
		
		let getAwarenessInfo = (terminate, cb) => {
			let tmp = core.registry.get();
			if (tmp && (tmp.services || tmp.daemons)) {
				let awarenessStatData = {
					"ts": Date.now(),
					"data": soajsUtils.cloneObj({"services": tmp.services, "daemons": tmp.daemons})
				};
				if (terminate) {
					for (let serviceName in awarenessStatData.data.services) {
						if (Object.hasOwnProperty.call(awarenessStatData.data.services, serviceName)) {
							if (serviceName === 'controller') {
								for (let serviceIP in awarenessStatData.data.services.controller.awarenessStats) {
									if (Object.hasOwnProperty.call(awarenessStatData.data.services.controller.awarenessStats, serviceIP)) {
										if (serviceIP === _self.serviceIp) {
											awarenessStatData.data.services.controller.awarenessStats[serviceIP].healthy = false;
											awarenessStatData.data.services.controller.awarenessStats[serviceIP].lastCheck = Date.now();
										}
									}
								}
							} else {
								delete awarenessStatData.data.services[serviceName];
							}
						}
					}
					delete awarenessStatData.data.daemons;
				}
				core.registry.addUpdateEnvControllers({
					"ip": _self.serviceIp,
					"ts": awarenessStatData.ts,
					"data": awarenessStatData.data,
					"env": regEnvironment
				}, cb);
			}
		};
		
		server.listen(registry.services.controller.port, (err) => {
			if (err) {
				log.error(err);
			} else {
				log.info(_self.soajs.param.init.serviceName + " service started on port: " + registry.services.controller.port);
				if (!process.env.SOAJS_DEPLOY_HA) {
					core.registry.registerHost({
						"serviceName": _self.soajs.param.init.serviceName,
						"serviceVersion": _self.soajs.param.init.serviceVersion,
						"servicePort": registry.services.controller.port,
						"serviceIp": service.ip,
						"serviceHATask": service.HATask
					}, registry, (registered) => {
						if (registered) {
							log.info("Host IP [" + service.ip + "] for service [" + _self.soajs.param.init.serviceName + "@" + _self.soajs.param.init.serviceVersion + "] successfully registered.");
							
							//update the database with the awareness Response generated.
							setTimeout(() => {
								getAwarenessInfo(false, (error) => {
									if (error) {
										log.error(error);
									}
								});
							}, registry.serviceConfig.awareness.healthCheckInterval);
							
							//update the database with the awareness Response generated.
							//controller has been terminated.
							process.on('SIGINT', () => {
								getAwarenessInfo(true, (error) => {
									if (error) {
										log.error(error);
									}
									log.warn("Service Terminated via interrupt signal.");
									process.exit();
								});
							});
						} else {
							log.warn("Unable to register host IP [" + service.ip + "] for service [" + _self.soajs.param.init.serviceName + "@" + _self.soajs.param.init.serviceVersion + "]");
						}
					});
				}
			}
			if (callback) {
				callback(err);
			}
		});
		serverMaintenance.on('error', (err) => {
			if (err.code === 'EADDRINUSE') {
				log.error('Address [port: ' + (maintenancePort) + '] in use by another service, exiting');
			} else {
				log.error(err);
			}
		});
		serverMaintenance.listen(maintenancePort, (err) => {
			if (err) {
				log.error(err);
			} else {
				log.info(_self.soajs.param.init.serviceName + " service maintenance is listening on port: " + maintenancePort);
			}
		});
		
	}
};

Controller.prototype.stop = function (registry, log, service, server, serverMaintenance, callback) {
	let maintenancePort = registry.services.controller.port + registry.serviceConfig.ports.maintenanceInc;
	log.info('stopping Server on port:', registry.services.controller.port);
	log.info('stopping MaintenanceServer on port:', maintenancePort);
	
	server.close((err) => {
		serverMaintenance.close(() => {
			if (callback) {
				callback(err);
			}
		});
	});
};

module.exports = Controller;