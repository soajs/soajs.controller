'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const domain = require('domain');
const gtw_keyPermission = require("./../soajsRoutes/keyPermission/index");

/**
 *
 * @param configuration
 * @returns {Function}
 */
module.exports = (configuration) => {
	let provision = configuration.provision;
	let core = configuration.core;
	
	let keyPermission = gtw_keyPermission({"provision": provision, "core": core});
	
	let extractBuildParameters = require("./lib/extractBuildParameters.js");
	
	let simpleRTS = require("./simpleRTS.js")(configuration);
	let redirectToService = require("./redirectToService.js")(configuration);
	let proxyRequest = require("./proxyRequest.js")(configuration);
	
	
	return (req, res, next) => {
		let serviceInfo = req.soajs.controller.serviceParams.serviceInfo;
		let parsedUrl = req.soajs.controller.serviceParams.parsedUrl;
		let service_nv = req.soajs.controller.serviceParams.service_nv;
		let service_n = req.soajs.controller.serviceParams.service_n;
		let service_v = req.soajs.controller.serviceParams.service_v;
		
		//check if route is key/permission/get then you also need to bypass the exctract Build Param BL
		let keyPermissionGet = (serviceInfo[1] === 'key' && serviceInfo[2] === 'permission' && serviceInfo[3] === 'get');
		if (keyPermissionGet) {
			return keyPermission(req, res, next);
		} else {
			//check if proxy/redirect
			//create proxy info object before calling extractbuildparams
			let proxy = (serviceInfo[1] === 'proxy' && serviceInfo[2] === 'redirect');
			let proxyInfo;
			if (proxy) {
				proxyInfo = {
					query: parsedUrl.query,
					pathname: parsedUrl.pathname
				};
			}
			
			extractBuildParameters(req, service_n, service_nv, service_v, proxyInfo, parsedUrl.path, core, function (error, parameters) {
				if (error) {
					req.soajs.log.fatal(error);
					req.soajs.log.debug(req.headers);
					return req.soajs.controllerResponse(core.error.getError(130));
				}
				
				if (!parameters) {
					req.soajs.log.fatal("Service [" + service_n + "] URL [" + req.url + "] couldn't be matched to a service or the service entry in registry is missing [port || hosts]");
					if (req && req.soajs &&
						req.soajs.registry &&
						req.soajs.registry.services) {
						req.soajs.log.debug(req.soajs.registry.services[service_n]);
						req.soajs.log.debug(req.soajs.registry.services);
					}
					req.soajs.log.debug(req.headers);
					return req.soajs.controllerResponse(core.error.getError(130));
				}
				
				for (let param in parameters) {
					if (Object.hasOwnProperty.call(parameters, param)) {
						req.soajs.controller.serviceParams[param] = parameters[param];
					}
				}
				
				let d = domain.create();
				d.add(req);
				d.add(res);
				d.on('error', function (err) {
					req.soajs.log.error('Error', err, req.url);
					try {
						req.soajs.log.error('Controller domain error, trying to dispose ...');
						res.on('close', function () {
							d.dispose();
						});
					} catch (err) {
						req.soajs.log.error('Controller domain error, unable to dispose: ', err, req.url);
						d.dispose();
					}
				});
				let passportLogin = false;
				if (serviceInfo[1] === "urac") {
					if (serviceInfo[2] === "passport" && serviceInfo[3] === "login") {
						passportLogin = true;
					}
				}
				
				if ((serviceInfo[2] !== "swagger" || (serviceInfo[2] === "swagger" && serviceInfo[serviceInfo.length - 1] === 2)) && parameters.extKeyRequired) {
					let key = req.headers.key || parsedUrl.query.key;
					if (!key) {
						return req.soajs.controllerResponse(core.error.getError(132));
					}
					
					core.key.getInfo(key, req.soajs.registry.serviceConfig.key, function (err) {
						if (err) {
							req.soajs.log.warn(err.message);
							return req.soajs.controllerResponse(core.error.getError(132));
						}
						if (passportLogin) {
							req.soajs.controller.gotoservice = simpleRTS;
						} else if (proxy) {
							req.soajs.controller.gotoservice = proxyRequest;
						} else {
							req.soajs.controller.gotoservice = redirectToService;
						}
						return next();
					});
				}
				else {
					if (passportLogin) {
						req.soajs.controller.gotoservice = simpleRTS;
					} else if (proxy) {
						req.soajs.controller.gotoservice = proxyRequest;
					} else {
						req.soajs.controller.gotoservice = redirectToService;
					}
					
					return next();
				}
			});
		}
	};
};