'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const registryModule = require("./../modules/registry");

const httpProxy = require('http-proxy');
const http = require('http');
const url = require('url');
const soajsLib = require("soajs.core.libs");
const soajsUtils = soajsLib.utils;

const packageInfo = require("../package.json");

let maintenanceResponse = (parsedUrl, param, route) => {
	return {
		'result': false,
		'ts': Date.now(),
		'service': {
			'service': packageInfo.name, //param.serviceName.toUpperCase(),
			'version': packageInfo.version,
			'type': 'rest',
			'route': route || parsedUrl.pathname
		}
	};
};

let cloneAndFilterRegistry = (reg, reqServiceName, reqServiceType) => {
	let filteredRegistry = {};
	if (reg) {
		if (reg.timeLoaded) {
			filteredRegistry.timeLoaded = reg.timeLoaded;
		}
		if (reg.name) {
			filteredRegistry.name = reg.name;
		}
		if (reg.environment) {
			filteredRegistry.environment = reg.environment;
		}
		if (reg.coreDB) {
			filteredRegistry.coreDB = reg.coreDB;
		}
		if (reg.tenantMetaDB) {
			filteredRegistry.tenantMetaDB = reg.tenantMetaDB;
		}
		if (reg.serviceConfig) {
			filteredRegistry.serviceConfig = soajsUtils.cloneObj(reg.serviceConfig);
			delete filteredRegistry.serviceConfig.cors;
			if (reqServiceName !== "oauth") {
				delete filteredRegistry.serviceConfig.oauth;
			}
		}
		if (reg.deployer) {
			filteredRegistry.deployer = soajsUtils.cloneObj(reg.deployer);
			if (filteredRegistry.deployer.container) {
				if (filteredRegistry.deployer.container.kubernetes && filteredRegistry.deployer.container.kubernetes.configuration) {
					delete filteredRegistry.deployer.container.kubernetes.configuration.token;
				}
			}
		}
		if (reg.custom) {
			filteredRegistry.custom = reg.custom;
		}
		if (reg.resources) {
			filteredRegistry.resources = reg.resources;
		}
		
		filteredRegistry.services = {};
		if (reg.services.controller) {
			filteredRegistry.services.controller = reg.services.controller;
		}
		if (reg.services && reqServiceType === "service") {
			if (reqServiceName && reg.services[reqServiceName]) {
				filteredRegistry.services[reqServiceName] = {
					"group": reg.services[reqServiceName].group,
					"port": reg.services[reqServiceName].port
				};
			}
		} else if (reg.daemons && reqServiceType === "mdaemon") {
			if (reqServiceName && reg.daemons[reqServiceName]) {
				filteredRegistry.daemons[reqServiceName] = {
					"group": reg.daemons[reqServiceName].group,
					"port": reg.daemons[reqServiceName].port
				};
			}
		} else {
			if (reg.services) {
				filteredRegistry.services = reg.services;
			}
			if (reg.daemons) {
				filteredRegistry.daemons = reg.daemons;
			}
		}
	}
	return filteredRegistry;
};
let reloadRegistry = (parsedUrl, core, log, param, serviceIp, cb) => {
	registryModule.reload({
		"name": param.serviceName,
		"group": param.serviceGroup,
		"version": param.serviceVersion,
		"ip": serviceIp
	}, function (err, reg) {
		let response = maintenanceResponse(parsedUrl, param);
		if (err) {
			log.warn("Failed to load registry. reusing from previous load. Reason: " + err.message);
		} else {
			response.result = true;
			response.data = cloneAndFilterRegistry(reg);
		}
		return cb(response);
	});
};

let Maintenance = (core, log, param, serviceIp, regEnvironment, awareness_mw, soajsLib, provision) => {
	
	let proxy = httpProxy.createProxyServer({});
	proxy.on('error', function (error, req, res) {
		log.error('Failed to proxy ' + req.url);
		log.error('Internal proxy error: ' + error);
		
		res.writeHead(200, {'Content-Type': 'application/json'});
		let parsedUrl = url.parse(req.url, true);
		let response = maintenanceResponse(parsedUrl, param, '/proxySocket');
		return res.end(JSON.stringify(response));
	});
	
	return http.createServer(function (req, res) {
		req.soajs = {};
		if (req.url === '/favicon.ico') {
			res.writeHead(200, {'Content-Type': 'image/x-icon'});
			return res.end();
		}
		let parsedUrl = url.parse(req.url, true);
		
		if (parsedUrl.pathname === '/reloadRegistry') {
			reloadRegistry(parsedUrl, core, log, param, serviceIp, (response) => {
				res.writeHead(200, {'Content-Type': 'application/json'});
				return res.end(JSON.stringify(response));
			});
		} else if (parsedUrl.pathname === '/awarenessStat') {
			res.writeHead(200, {'Content-Type': 'application/json'});
			let tmp = registryModule.get();
			let response = maintenanceResponse(parsedUrl, param);
			if (tmp && (tmp.services || tmp.daemons)) {
				response.result = true;
				response.data = {"services": tmp.services, "daemons": tmp.daemons};
			}
			
			if (process.env.SOAJS_DEPLOY_HA) {
				//TODO: check if this is needed
				awareness_mw.getMw({
					"awareness": param.awareness,
					"serviceName": param.serviceName,
					"serviceVersion": param.serviceVersion,
					"log": log,
					"serviceIp": serviceIp
				});
			} else if (parsedUrl.query && parsedUrl.query.update) {
				registryModule.addUpdateEnvControllers({
					"ip": serviceIp,
					"ts": response.ts,
					"data": soajsUtils.cloneObj(response.data),
					"env": regEnvironment
				}, function (error) {
					if (error) {
						log.error(error.message);
					}
				});
			}
			
			return res.end(JSON.stringify(response));
		} else if (parsedUrl.pathname === '/register') {
			if (!process.env.SOAJS_DEPLOY_HA) {
				let body = "";
				req.on('data', function (chunk) {
					body += chunk;
				});
				req.on('end', function () {
					if (body) {
						body = JSON.parse(body);
					}
					if (parsedUrl.query.serviceHATask) {
						reloadRegistry(parsedUrl, core, log, param, serviceIp, (response) => {
							res.writeHead(200, {'Content-Type': 'application/json'});
							return res.end(JSON.stringify(response));
						});
					} else {
						res.writeHead(200, {'Content-Type': 'application/json'});
						let response = maintenanceResponse(parsedUrl, param);
						
						let infoObj = parsedUrl.query;
						if ('POST' === req.method && body) {
							infoObj = body;
						}
						if (!soajsLib.version.validate(infoObj.version)) {
							log.warn("Failed to register service for [" + infoObj.name + "@" + infoObj.version + "] version should be of format [1.1]");
							res.writeHead(200, {'Content-Type': 'application/json'});
							return res.end(JSON.stringify(response));
						}
						
						let regOptions = {
							"name": infoObj.name,
							"group": infoObj.group,
							"port": parseInt(infoObj.port),
							"ip": infoObj.ip,
							"type": infoObj.type,
							"version": "" + infoObj.version,
							'subType': infoObj.subType || null,
							'description': infoObj.description || null
						};
						if (infoObj.portHost) {
							regOptions.portHost = parseInt(infoObj.portHost);
						}
						
						if (regOptions.type === "service") {
							//regOptions.swagger = infoObj.swagger;
							regOptions.oauth = infoObj.oauth;
							regOptions.urac = infoObj.urac;
							regOptions.urac_Profile = infoObj.urac_Profile;
							regOptions.urac_ACL = infoObj.urac_ACL;
							regOptions.urac_Config = infoObj.urac_Config;
							regOptions.urac_GroupConfig = infoObj.urac_GroupConfig;
							regOptions.tenant_Profile = infoObj.tenant_Profile;
							regOptions.provision_ACL = infoObj.provision_ACL;
							regOptions.extKeyRequired = infoObj.extKeyRequired;
							regOptions.requestTimeout = parseInt(infoObj.requestTimeout);
							regOptions.requestTimeoutRenewal = parseInt(infoObj.requestTimeoutRenewal);
							regOptions.interConnect = infoObj.interConnect;
							
							if (body && body.apiList) {
								regOptions.apiList = body.apiList;
							}
						}
						
						regOptions.mw = infoObj.mw;
						
						if (body && body.maintenance) {
							regOptions.maintenance = body.maintenance;
						}
						registryModule.register(
							regOptions,
							function (err, data) {
								if (!err) {
									response.result = true;
									response.data = data;
								} else {
									log.warn("Failed to register service for [" + infoObj.name + "] " + err.message);
								}
								return res.end(JSON.stringify(response));
							});
					}
				});
			} else {
				res.writeHead(200, {'Content-Type': 'application/json'});
				let response = maintenanceResponse(parsedUrl, param);
				return res.end(JSON.stringify(response));
			}
		}
		else if (parsedUrl.pathname.match('/proxySocket/.*')) {
			
			req.url = req.url.split('/proxySocket')[1];
			req.headers.host = '127.0.0.1';
			
			log.info('Incoming proxy request for ' + req.url);
			
			let haTarget = {
				socketPath: process.env.SOAJS_SWARM_UNIX_PORT || '/var/run/docker.sock'
			};
			proxy.web(req, res, {target: haTarget});
		}
		else if (parsedUrl.pathname === '/loadProvision') {
			provision.loadProvision(function (loaded) {
				let response = maintenanceResponse(parsedUrl, param);
				response.result = loaded;
				return res.end(JSON.stringify(response));
			});
		} else if (parsedUrl.pathname === '/getRegistry') {
			let reqEnv = parsedUrl.query.env;
			let reqServiceName = parsedUrl.query.serviceName;
			let reqServiceType = parsedUrl.query.type || "service";
			
			if (!reqEnv) {
				reqEnv = regEnvironment;
			}
			registryModule.loadByEnv({
				"envCode": reqEnv,
				"name": param.serviceName,
				"donotBbuildSpecificRegistry": false
			}, function (err, reg) {
				let response = maintenanceResponse(parsedUrl, param);
				if (err) {
					log.error(reqServiceName, err.message);
				} else {
					response.result = true;
					response.data = {}; //soajsUtils.cloneObj(reg);
				}
				if (reg) {
					response.data = cloneAndFilterRegistry(reg, reqServiceName, reqServiceType);
				}
				awareness_mw.getMw({
					"awareness": param.awareness,
					"serviceName": param.serviceName,
					"serviceVersion": param.serviceVersion,
					"log": log,
					"core": core,
					"serviceIp": serviceIp,
					"doNotRebuildCache": true
				})(req, res, () => {
					let gatewayName = param.serviceName;
					if (reg && reg.services && reg.services.controller && reg.services.controller.name) {
						gatewayName = reg.services.controller.name;
					}
					req.soajs.awareness.getHost(gatewayName, function (controllerHostInThisEnvironment) {
						if (reg && reg.serviceConfig && reg.serviceConfig.ports && reg.serviceConfig.ports.controller) {
							response.data.awareness = {
								"host": controllerHostInThisEnvironment,
								"port": reg.serviceConfig.ports.controller
							};
						}
						res.writeHead(200, {'Content-Type': 'application/json'});
						return res.end(JSON.stringify(response));
					});
				});
			});
		}
		else {
			let heartbeat = function (res) {
				res.writeHead(200, {'Content-Type': 'application/json'});
				let response = maintenanceResponse(parsedUrl, param);
				response.result = true;
				res.end(JSON.stringify(response));
			};
			if (req.url === '/heartbeat') {
				return heartbeat(res);
			}
			return heartbeat(res);
		}
	});
};
module.exports = Maintenance;
