'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const coreLibs = require("soajs.core.libs");

/**
 * What the caller may use, the way the gateway decides it: the user's ACL and packages, else the
 * tenant application's, else the package's. Shared by /soajs/acl and /soajs/mcp.
 *
 * finalACL is, per service, the latest allowed version and, for a restricted service, the allowed
 * apis per method: {"urac": {"version": "3", "get": ["/user"]}}. A service that is not restricted
 * has only its version: all its apis are allowed.
 *
 * @param req
 * @returns {{acl: object|null, finalACL: object|null, packages: Array|null}}
 */
function computeACL(req) {
	let ACL = null;
	let ALLOWED_PACKAGES = null;
	if (req.soajs.uracDriver) {
		ACL = req.soajs.uracDriver.getAcl();
		ALLOWED_PACKAGES = req.soajs.uracDriver.getAllowedPackages();
		req.soajs.log.debug("soajsRoute ACL: uracDriver detected.", ALLOWED_PACKAGES);
	}
	if (!ALLOWED_PACKAGES && req.soajs.controller.serviceParams.keyObj.application.package) {
		ALLOWED_PACKAGES = [req.soajs.controller.serviceParams.keyObj.application.package];
		req.soajs.log.debug("soajsRoute ACL: Found PACKAGE ACL at Tenant Application level, overriding default PACKAGE ACL configuration.", ALLOWED_PACKAGES);
	}
	if (!ACL && req.soajs.controller.serviceParams.keyObj.application.acl) {
		ACL = req.soajs.controller.serviceParams.keyObj.application.acl;
		req.soajs.log.debug("soajsRoute ACL: Found ACL at Tenant Application level, overriding default ACL configuration.");
	}
	if (!ACL && req.soajs.controller.serviceParams.packObj.acl) {
		req.soajs.log.debug("soajsRoute ACL: Found Default ACL at Package level, setting default ACL configuration.");
		ACL = coreLibs.utils.cloneObj(req.soajs.controller.serviceParams.packObj.acl);
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
								continue;
							}
						}
						finalACL[s] = {
							"version": v
						};
						if (sv.apisPermission && sv.apisPermission === "restricted") {
							for (let m in sv) {
								if (sv.hasOwnProperty(m)) {
									if (m !== "access" && m !== "apisPermission") {
										// {apis: {...}} or, grouped, [{group, apis: {...}}]
										let groups = Array.isArray(sv[m]) ? sv[m] : [sv[m]];
										for (let g = 0; g < groups.length; g++) {
											let group = groups[g];
											if (group && group.apis) {
												for (let a in group.apis) {
													if (group.apis.hasOwnProperty(a)) {
														if (!finalACL[s][m]) {
															finalACL[s][m] = [];
														}
														if (finalACL[s][m].indexOf(a) === -1) {
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
		}
	}
	return {
		"acl": ACL,
		"finalACL": finalACL,
		"packages": ALLOWED_PACKAGES
	};
}

/**
 * Makes the request look like a call to an api of the gateway itself, so mt runs the key, oauth
 * and urac checks for it. The registry entry is a copy: the shared registry is not changed.
 *
 * @param req
 * @param configuration {serviceName, serviceVersion}
 * @param api {l, v, m}
 */
function mimicGatewayApi(req, configuration, api) {
	let serviceName = configuration.serviceName;
	let registry = Object.assign({}, req.soajs.registry.services[serviceName]);
	registry.versions = {
		[configuration.serviceVersion]: {
			"extKeyRequired": true,
			"oauth": true,
			"urac": true,
			"urac_ACL": true,
			"provision_ACL": true,
			"apis": [api]
		}
	};
	req.soajs.controller.serviceParams.registry = registry;
	req.soajs.controller.serviceParams.name = serviceName;
	req.soajs.controller.serviceParams.url = api.v;
	req.soajs.controller.serviceParams.path = api.v;
	req.soajs.controller.serviceParams.version = configuration.serviceVersion;
	req.soajs.controller.serviceParams.extKeyRequired = true;
}

module.exports = {
	computeACL,
	mimicGatewayApi
};
