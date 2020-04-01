'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const coreLibs = require("soajs.core.libs");

module.exports = (configuration) => {
	let core = configuration.core;
	
	let return_SOAJS_keyACL = (req) => {
		let ACL = null;
		let ALLOWED_PACKAGES = null;
		if (req.soajs.uracDriver) {
			req.soajs.log.debug("soajsRoute keyACL: uracDriver detected.");
			ACL = req.soajs.uracDriver.getAcl();
			ALLOWED_PACKAGES = req.soajs.uracDriver.getAllowedPackages();
		}
		if (!ALLOWED_PACKAGES && req.soajs.controller.serviceParams.keyObj.application.package) {
			req.soajs.log.debug("soajsRoute keyACL: Found PACKAGE ACL at Tenant Application level, overriding default PACKAGE ACL configuration.");
			ALLOWED_PACKAGES = [req.soajs.controller.serviceParams.keyObj.application.package];
		}
		if (!ACL && req.soajs.controller.serviceParams.keyObj.application.acl) {
			req.soajs.log.debug("soajsRoute keyACL: Found ACL at Tenant Application level, overriding default ACL configuration.");
			ACL = req.soajs.controller.serviceParams.keyObj.application.acl;
		}
		if (!ACL && req.soajs.controller.serviceParams.packObj.acl) {
			req.soajs.log.debug("soajsRoute keyACL: Found Default ACL at Package level, setting default ACL configuration.");
			ACL = req.soajs.controller.serviceParams.packObj.acl;
		}
		let finalACL = null;
		if (ACL) {
			finalACL = {};
			for (let s in ACL) {
				if (ACL.hasOwnProperty(s)) {
					for (let v in ACL[s]) {
						if (ACL[s].hasOwnProperty(v)) {
							let sv = ACL[s][v];
							if (finalACL[s] && finalACL[s].version) {
								let version = coreLibs.version.getLatest(finalACL[s].version, v);
								if (version !== v) {
									break;
								}
							}
							finalACL[s] = {
								"version": v
							};
							if (sv.apisPermission && sv.apisPermission === "restricted") {
								for (let m in sv) {
									if (sv.hasOwnProperty(m)) {
										if (m !== "access" || m !== "apisPermission") {
											if (sv[m].apis) {
												for (let a in sv[m].apis) {
													if (sv[m].apis.hasOwnProperty(a)) {
														if (!finalACL[s][m]) {
															finalACL[s][m] = [];
														}
														finalACL[s][m].push(a);
													}
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
		}
		let response = {
			"acl": ACL,
			"finalACL": finalACL,
			"packages": ALLOWED_PACKAGES
		};
		return req.soajs.controllerResponse(response);
	};
	
	return (req, res, next) => {
		
		//doesn't work without a key in the headers
		if (!req.headers || !req.headers.key) {
			return req.soajs.controllerResponse(core.error.getError(132));
		}
		
		//mimic a service named controller with route /key/permission/get
		let serviceName = configuration.serviceName;
		req.soajs.controller.serviceParams.registry = req.soajs.registry.services[serviceName];
		req.soajs.controller.serviceParams.name = serviceName;
		req.soajs.controller.serviceParams.url = "/soajs/acl";
		req.soajs.controller.serviceParams.path = "/soajs/acl";
		req.soajs.controller.serviceParams.version = configuration.serviceVersion;
		req.soajs.controller.serviceParams.extKeyRequired = true;
		req.soajs.controller.serviceParams.registry.versions = {
			[configuration.serviceVersion]: {
				"extKeyRequired": true,
				"oauth": true,
				"urac": true,
				"urac_ACL": true,
				"provision_ACL": true,
				"apis": [
					{
						"l": "Get ACL",
						"v": "/soajs/acl",
						"m": "get"
					}
				]
			}
		};
		
		//assign the correct method to gotoservice in controller
		req.soajs.controller.gotoservice = return_SOAJS_keyACL;
		return next();
		
	};
};
