'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const gtw_keyACL = require("./../soajsRoutes/keyACL/index.js");

/**
 *
 * @param configuration
 * @returns {Function}
 */
module.exports = (configuration) => {
	let provision = configuration.provision;
	let core = configuration.core;
	
	let soajs_keyACL = gtw_keyACL({
		"provision": provision,
		"serviceName": configuration.serviceName,
		"serviceVersion": configuration.serviceVersion,
		"core": core
	});
	
	let extractBuildParameters = require("./lib/extractBuildParameters.js");
	
	let simpleRTS = require("./simpleRTS.js")(configuration);
	let redirectToService = require("./redirectToService.js")(configuration);
	let proxyRequest = require("./proxyRequest.js")(configuration);
	let roaming = require("./roaming.js")(configuration);
	
	
	return (req, res, next) => {
		let serviceInfo = req.soajs.controller.serviceParams.serviceInfo;
		let parsedUrl = req.soajs.controller.serviceParams.parsedUrl;
		let service_nv = req.soajs.controller.serviceParams.service_nv;
		let service_n = req.soajs.controller.serviceParams.service_n;
		let service_v = req.soajs.controller.serviceParams.service_v;
		
		//check if route is soajs/acl then you also need to bypass the exctract Build Param BL
		let url_keyACL = (serviceInfo[1] === 'soajs' && serviceInfo[2] === 'acl');
		if (url_keyACL) {
			return soajs_keyACL(req, res, next);
		} else {
			//check if proxy/redirect
			//create proxy info object before calling extractbuildparams
			let proxy = false;
			if (serviceInfo[1] === 'proxy' && serviceInfo[2] === 'redirect') {
				req.soajs.log.error(new Error("Route: [/proxy/redirect] is deprecated. You should use [/soajs/proxy]."));
				proxy = true;
			} else if (serviceInfo[1] === 'soajs' && serviceInfo[2] === 'proxy') {
				proxy = true;
			}
			let proxyInfo = null;
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
					}
					req.soajs.log.debug(req.headers);
					return req.soajs.controllerResponse(core.error.getError(130));
				}
				
				for (let param in parameters) {
					if (Object.hasOwnProperty.call(parameters, param)) {
						req.soajs.controller.serviceParams[param] = parameters[param];
					}
				}
				
				let set_gotoservice = () => {
					
					let passportLogin = false;
					if (serviceInfo[1] === "oauth") {
						if (serviceInfo[2] === "passport" && serviceInfo[3] === "login") {
							passportLogin = true;
						}
					}
					
					let soajsroaming = req.get("soajsroaming");
					
					if (passportLogin) {
						req.soajs.controller.gotoservice = simpleRTS;
					} else if (soajsroaming) {
						req.soajs.controller.gotoservice = roaming;
					} else if (proxy) {
						req.soajs.controller.gotoservice = proxyRequest;
					} else {
						req.soajs.controller.gotoservice = redirectToService;
					}
				};
				
				if (parameters.extKeyRequired) {
					let key = req.headers.key || parsedUrl.query.key;
					if (!key) {
						return req.soajs.controllerResponse(core.error.getError(132));
					}
					
					core.key.getInfo(key, req.soajs.registry.serviceConfig.key, function (err) {
						if (err) {
							req.soajs.log.warn(err.message);
							return req.soajs.controllerResponse(core.error.getError(132));
						}
						set_gotoservice();
						return next();
					});
				} else {
					set_gotoservice();
					return next();
				}
			});
		}
	};
};