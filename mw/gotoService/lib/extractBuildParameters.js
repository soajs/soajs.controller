'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const coreLibs = require("soajs.core.libs");

module.exports = (req, service, service_nv, version, proxyInfo, url, core, callback) => {
	
	if (proxyInfo) {
		let requestedRoute = "";
		//check if requested route is provided as query param
		if (proxyInfo.query && proxyInfo.query.proxyRoute) {
			requestedRoute = decodeURIComponent(proxyInfo.query.proxyRoute);
		}
		proxyInfo = {
			"url": requestedRoute,
			"extKeyRequired": false
		};
		let serviceName = requestedRoute.split("/")[1] || null;
		if (!serviceName) {
			return callback(new Error("Unable to fetch serviceName from proxy call. proxyRoute param might be missing or wrong"));
		}
		if (req.soajs.registry.services[serviceName]) {
			proxyInfo = {
				"registry": req.soajs.registry.services[serviceName],
				"name": serviceName,
				"url": requestedRoute,
				"version": req.soajs.registry.services[serviceName].version || 1,
				"extKeyRequired": false
			};
		}
		if (req.headers.key) {
			proxyInfo.extKeyRequired = true;
		}
		return callback(null, proxyInfo);
	} else {
		if (service && req && req.soajs &&
			req.soajs.registry &&
			req.soajs.registry.services &&
			req.soajs.registry.services[service] &&
			req.soajs.registry.services[service].port &&
			(process.env.SOAJS_DEPLOY_HA || req.soajs.registry.services[service].hosts || req.soajs.registry.services[service].type === "endpoint")
		) {
			let nextStep = (version) => {
				let extKeyRequired = false;
				if (req.soajs.registry.services[service].versions && req.soajs.registry.services[service].versions[version]) {
					extKeyRequired = req.soajs.registry.services[service].versions[version].extKeyRequired || false;
				}
				let serviceInfo = {
					"registry": req.soajs.registry.services[service],
					"name": service,
					"url": url.substring(service_nv.length + 1),
					"version": version,
					"extKeyRequired": extKeyRequired
				};
				let path = serviceInfo.url;
				let pathIndex = path.indexOf("?");
				if (pathIndex !== -1) {
					path = path.substring(0, pathIndex);
					pathIndex = path.lastIndexOf("/");
					if (pathIndex > 0 && pathIndex === (path.length - 1)) {
						path = path.substring(0, pathIndex);
					}
				}
				serviceInfo.path = path;
				return callback(null, serviceInfo);
			};
			//NOTE: since keyACL is getting the version from ACL, we do not need to get version at this point anymore
			if (!version) {
				if (req.soajs.registry.services[service].type === "endpoint") {
					//TODO: we should support what version is available aka deployed
					if (req.soajs.registry.endpoints && req.soajs.registry.endpoints.deployed && req.soajs.registry.endpoints.deployed[service]) {
						if (Array.isArray(req.soajs.registry.endpoints.deployed[service])) {
							let ver = req.soajs.registry.endpoints.deployed[service][0];
							for (let i = 1; i < req.soajs.registry.endpoints.deployed[service].length; i++) {
								ver = coreLibs.version.getLatest(ver, req.soajs.registry.endpoints.deployed[service][i]);
							}
							return nextStep(ver);
						}
					}
					if (req.soajs.registry.services[service].version) {
						return nextStep(req.soajs.registry.services[service].version);
					} else {
						return callback(null, null);
					}
				} else {
					req.soajs.awareness.getLatestVersion(service, (latest) => {
						if (latest) {
							return nextStep(latest);
						} else {
							if (req.soajs.awareness.getLatestVersionFromCluster) {
								req.soajs.awareness.getLatestVersionFromCluster(service, (latest) => {
									if (latest) {
										return nextStep(latest);
									} else {
										return callback(null, null);
									}
								});
							} else {
								return callback(null, null);
							}
						}
					});
				}
			} else {
				return nextStep(version);
			}
		} else {
			return callback(null, null);
		}
	}
};
