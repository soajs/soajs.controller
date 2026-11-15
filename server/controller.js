'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const registryModule = require("./../modules/registry");

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
const maintenanceMode_mw = require('../mw/maintenanceMode/index');
const enhancer_mw = require('../mw/enhancer/index');
const awareness_mw = require('../mw/awareness/index');
const awarenessEnv_mw = require("../mw/awarenessEnv/index");
const url_mw = require("../mw/url/index");
const key_mw = require("../mw/key/index");
const events_mw = require("../mw/events/index");
const shutdown = require("../lib/shutdown.js");
const mcpAuth_mw = require("../mw/soajsRoutes/mcp/auth");
const keyACL_mw = require("../mw/keyACL/index");
const gotoService_mw = require("../mw/gotoService/index");
const mt_mw = require("../mw/mt/index");
const traffic_mw = require("../mw/traffic/index");
const idempotency_mw = require("../mw/idempotency/index");
const cache_mw = require("../mw/cache/index");
const lastSeen_mw = require("../mw/lastSeen/index");
const ip2ban_mw = require("../mw/ip2ban/index");

const utils = require("../utilities/utils");

let autoRegHost = process.env.SOAJS_SRV_AUTOREGISTERHOST || true;
if (autoRegHost && typeof (autoRegHost) !== 'boolean') {
	autoRegHost = (autoRegHost === 'true');
}
let regEnvironment = (process.env.SOAJS_ENV || "dev");
regEnvironment = regEnvironment.toLowerCase();

function Controller(config) {
	let _self = this;

	config = config || {};
	let param = lib.param(config);
	_self.soajs = { "param": param };
}

Controller.prototype.init = function (callback) {
	let _self = this;
	lib.ip(autoRegHost, (service) => {
		registryModule.load({
			"name": _self.soajs.param.init.serviceName,
			"group": _self.soajs.param.init.serviceGroup,
			"version": _self.soajs.param.init.serviceVersion,
			"oPort": _self.soajs.param.init.servicePort,
			"ip": service.ip,
			"maintenance": _self.soajs.param.init.maintenance
		}, (reg) => {
			let registry = reg;
			let log = core.getLogger(_self.soajs.param.init.serviceName, registry.serviceConfig.logger);
			if (service.fetched) {
				if (!service.fetched.result) {
					log.error("Unable to find the service host ip. The service will NOT be registered for awareness.");
					log.info("IPs found: ", service.fetched.extra.ips);
					log.warn("The default service IP has been used [" + service.ip + "]");
				} else {
					log.info("The IP registered for service [" + _self.soajs.param.init.serviceName + "] awareness : ", service.fetched.ip);
				}
			}

			let app = connect();
			app.use(soajs_mw({
				"log": log,
				"core": core
			}));
			app.use(cors_mw());
			app.use(favicon_mw());
			app.use(response_mw({ "controllerResponse": true }));

			app.use(enhancer_mw());
			
			app.use(ip2ban_mw());
			app.use(maintenanceMode_mw()); //NOTE: this is for global maintenance mode

			//NOTE: before the url mw, which knows no service named .well-known
			app.use(mcpAuth_mw.wellKnown({ "provision": provision }));

			app.use(url_mw({ "core": core }));
			
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
						"serviceVersion": _self.soajs.param.init.serviceVersion,
						"core": core,
						"log": log,
						"serviceIp": service.ip
					}));
					log.info("Awareness middleware initialization done.");

					//added mw awarenessEnv so that proxy can use req.soajs.awarenessEnv.getHost('dev', cb)
					app.use(awarenessEnv_mw.getMw({
						"awarenessEnv": true,
						"serviceName": _self.soajs.param.init.serviceName,
						"serviceVersion": _self.soajs.param.init.serviceVersion,
						"core": core,
						"log": log
					}));
					log.info("AwarenessEnv middleware initialization done.");

					// app.use(enhancer_mw());

					// app.use(url_mw({ "core": core }));

					//NOTE: before the key mw, a token restricted to one key brings the key of /soajs/mcp
					app.use(mcpAuth_mw.authorize({ "provision": provision }));

					// one call event per request from the key step on, written off the request path
					app.use(events_mw({
						"log": log,
						"registry": () => registryModule.get(),
						"regEnvironment": regEnvironment,
						"serviceName": _self.soajs.param.init.serviceName,
						"serviceVersion": _self.soajs.param.init.serviceVersion
					}));

					app.use(key_mw({ "provision": provision, "regEnvironment": regEnvironment }));

					//TODO: add maintenance by tenant here req.soajs.controller.serviceParams.keyObj.config

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

					app.use(idempotency_mw({
						"log": log,
						"gatewayDB": registry.coreDB.gateway || registry.coreDB.provision
					}));
					log.info("Idempotency middleware initialization done.");

					app.use(traffic_mw({
						"log": log,
						"gatewayDB": registry.coreDB.gateway || registry.coreDB.provision
					}));

					app.use(cache_mw({
						"log": log,
						"gatewayDB": registry.coreDB.gateway || registry.coreDB.provision
					}));
					log.info("Cache middleware initialization done.");

					app.use(lastSeen_mw());

					app.use((req, res, next) => {

						req.on("error", (error) => {
							req.soajs.log.error("Error @ controller:", error);
							if (req.soajs.controller.redirectedRequest) {
								req.soajs.controller.redirectedRequest.destroy();
								req.soajs.controller.redirectedRequest = null;
							}
						});

						req.on("close", () => {
							if (req.soajs.controller.redirectedRequest) {
								req.soajs.log.info("Request closed:", req.url);
							}
						});
						
						setImmediate(() => {
							req.soajs.controller.gotoservice(req, res, next);
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
				log.error(err.message);
			}
		});

		let getAwarenessInfo = (terminate, cb) => {
			let doc = Controller.controllersDoc(registryModule.get(), registry.services.controller.name, service.ip, terminate);
			if (!doc) {
				return cb();
			}
			doc.env = regEnvironment;
			registryModule.addUpdateEnvControllers(doc, cb);
		};

		//NOTE: one graceful stop for SIGTERM and SIGINT (lib/shutdown.js)
		shutdown.install(log);
		shutdown.addServer(server);
		shutdown.addServer(serverMaintenance);

		server.listen(registry.services.controller.port, (err) => {
			if (err) {
				log.error(err.message);
			} else {
				log.info(_self.soajs.param.init.serviceName + " service started on port: " + registry.services.controller.port);
				if (!process.env.SOAJS_DEPLOY_HA) {
					registryModule.registerHost({
						"name": _self.soajs.param.init.serviceName,
						"version": _self.soajs.param.init.serviceVersion,
						"port": registry.services.controller.port,
						"ip": service.ip,
						"serviceHATask": service.HATask
					}, registry, (registered) => {
						if (registered) {
							log.info("Host IP [" + service.ip + "] for service [" + _self.soajs.param.init.serviceName + "@" + _self.soajs.param.init.serviceVersion + "] successfully registered.");

							//update the database with the awareness Response generated.
							setTimeout(() => {
								getAwarenessInfo(false, (error) => {
									if (error) {
										log.error(error.message);
									}
								});
							}, registry.serviceConfig.awareness.healthCheckInterval);

							//NOTE: stopped by an interrupt, the controllers document marks the gateway down
							//		(the graceful stop runs it after the servers stopped)
							shutdown.register("controllers document", (signal, done) => {
								if (signal !== "SIGINT") {
									return done();
								}
								getAwarenessInfo(true, (error) => {
									if (error) {
										log.error(error.message);
									}
									log.warn("Service Terminated via interrupt signal.");
									return done();
								});
							});
						} else {
							log.error("Unable to register host IP [" + service.ip + "] for service [" + _self.soajs.param.init.serviceName + "@" + _self.soajs.param.init.serviceVersion + "]");
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
				log.error(err.message);
			}
		});
		serverMaintenance.listen(maintenancePort, (err) => {
			if (err) {
				log.error(err.message);
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

	shutdown.removeServer(server);
	shutdown.removeServer(serverMaintenance);
	server.close((err) => {
		serverMaintenance.close(() => {
			if (callback) {
				callback(err);
			}
		});
	});
};

/**
 * The gateway's controllers document: its IP, the time, and the awareness of the services and
 * daemons. When the gateway stops, only its own entry is kept, with its host marked unhealthy.
 *
 * @param reg the registry
 * @param controllerName the gateway's service name
 * @param serviceIp the IP the gateway registered under
 * @param terminate the gateway is stopping
 * @returns {{ip, ts, data}|null} null without services or daemons
 */
Controller.controllersDoc = (reg, controllerName, serviceIp, terminate) => {
	if (!reg || (!reg.services && !reg.daemons)) {
		return null;
	}
	let doc = {
		"ip": serviceIp,
		"ts": Date.now(),
		"data": soajsUtils.cloneObj({"services": reg.services, "daemons": reg.daemons})
	};
	if (terminate) {
		for (let serviceName in doc.data.services) {
			if (Object.hasOwnProperty.call(doc.data.services, serviceName)) {
				if (serviceName === controllerName) {
					let stats = doc.data.services[serviceName].awarenessStats || {};
					if (stats[serviceIp]) {
						stats[serviceIp].healthy = false;
						stats[serviceIp].lastCheck = Date.now();
					}
				} else {
					delete doc.data.services[serviceName];
				}
			}
		}
		delete doc.data.daemons;
	}
	return doc;
};

module.exports = Controller;
