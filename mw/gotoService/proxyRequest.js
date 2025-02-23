'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const registryModule = require("./../../modules/registry");
// const request = require('request');
const http = require('http');
const querystring = require('querystring');

module.exports = (configuration) => {
	let core = configuration.core;

	let regEnvironment = (process.env.SOAJS_ENV || "dev");
	regEnvironment = regEnvironment.toLowerCase();

	/**
	 * load controller information for remote requested environment and proxy the request to its controller.
	 *
	 * @param {Object} req
	 * @param {Object} res
	 * @param {String} remoteENV
	 * @param {String} remoteExtKey
	 * @param {String} requestedRoute
	 */
	let proxyRequestToRemoteEnv = (req, res, next, remoteENV, remoteExtKey, requestedRoute) => {
		let triggerProxy = (myUri, requestTO) => {
			const urlObj = new URL(myUri);
			let queryParams = {};
			//add query params
			if (req.query && Object.keys(req.query).length > 0) {
				queryParams = req.query;
				delete queryParams.proxyRoute;
				delete queryParams.__env;
			}
			const queryString = querystring.stringify(queryParams);
			const fullPath = urlObj.pathname + (queryString ? `?${queryString}` : '');

			let requestConfig = {
				"hostname": urlObj.hostname,
				"port": urlObj.port,
				"path": fullPath, // Use the full path with query parameters
				"method": req.method.toUpperCase(),
				'timeout': requestTO * 1000,
				'headers': req.headers
			};

			requestConfig.headers.soajs_roaming = regEnvironment;

			if (remoteExtKey) {
				//add remote ext key in headers
				requestConfig.headers.key = remoteExtKey;
			} else {
				delete requestConfig.headers.key;
			}

			delete requestConfig.headers.host;

			req.soajs.log.debug(requestConfig);

			try {
				//proxy request
				req.soajs.controller.redirectedRequest = http.request(requestConfig);
				req.soajs.controller.redirectedRequest.on('error', function (error) {
					req.soajs.log.error(error.message);
					if (req.soajs.controller.redirectedRequest) {
						req.soajs.controller.redirectedRequest.destroy();
						req.soajs.controller.redirectedRequest = null;
					}
					return req.soajs.controllerResponse(core.error.getError(135));
				});

				if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
					req.pipe(req.soajs.controller.redirectedRequest).pipe(res);
				} else {
					req.soajs.controller.redirectedRequest.pipe(res);
				}

			} catch (e) {
				req.soajs.log.error(e.message);
				if (req.soajs.controller.redirectedRequest) {
					req.soajs.controller.redirectedRequest.destroy();
					req.soajs.controller.redirectedRequest = null;
				}
				return req.soajs.controllerResponse(core.error.getError(135));
			}
		};

		// let triggerProxy = (myUri, requestTO) => {
		// 	let requestConfig = {
		// 		'uri': myUri,
		// 		'method': req.method,
		// 		'timeout': requestTO * 1000,
		// 		'jar': false,
		// 		'headers': req.headers
		// 	};

		// 	requestConfig.headers.soajs_roaming = regEnvironment;

		// 	if (remoteExtKey) {
		// 		//add remote ext key in headers
		// 		requestConfig.headers.key = remoteExtKey;
		// 	} else {
		// 		delete requestConfig.headers.key;
		// 	}

		// 	//add remaining query params
		// 	if (req.query && Object.keys(req.query).length > 0) {
		// 		requestConfig.qs = req.query;
		// 		delete requestConfig.qs.proxyRoute;
		// 		delete requestConfig.qs.__env;
		// 	}

		// 	delete requestConfig.headers.host;

		// 	req.soajs.log.debug(requestConfig);

		// 	try {
		// 		//proxy request
		// 		req.soajs.controller.redirectedRequest = request(requestConfig);
		// 		req.soajs.controller.redirectedRequest.on('error', function (error) {
		// 			req.soajs.log.error(error.message);
		// 			if (req.soajs.controller.redirectedRequest) {
		// 				req.soajs.controller.redirectedRequest.destroy();
		// 				req.soajs.controller.redirectedRequest = null;
		// 			}
		// 			return req.soajs.controllerResponse(core.error.getError(135));
		// 		});

		// 		if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
		// 			req.pipe(req.soajs.controller.redirectedRequest).pipe(res);
		// 		} else {
		// 			req.soajs.controller.redirectedRequest.pipe(res);
		// 		}

		// 	} catch (e) {
		// 		req.soajs.log.error(e.message);
		// 		if (req.soajs.controller.redirectedRequest) {
		// 			req.soajs.controller.redirectedRequest.destroy();
		// 			req.soajs.controller.redirectedRequest = null;
		// 		}
		// 		return req.soajs.controllerResponse(core.error.getError(135));
		// 	}
		// };
		if (!remoteENV) {
			triggerProxy(requestedRoute, 30);
		}
		else {
			//get remote env registry
			registryModule.loadByEnv({ "envCode": remoteENV }, function (err, reg) {
				if (err) {
					req.soajs.log.error(err.message);
					return req.soajs.controllerResponse(core.error.getError(207));
				} else {
					let config = req.soajs.registry.services.controller;
					if (!config) {
						return req.soajs.controllerResponse(core.error.getError(131));
					}
					let requestTO = config.requestTimeout;
					if (!reg.protocol || !reg.domain || !reg.port) {
						return req.soajs.controllerResponse(core.error.getError(208));
					}
					//formulate request and pipe
					let myUri = reg.protocol + '://' + (reg.apiPrefix ? reg.apiPrefix + "." : "") + reg.domain + ':' + reg.port + requestedRoute;

					triggerProxy(myUri, requestTO);
				}
			});
		}
	};

	/**
	 * function that finds if this tenant has a dashboard access extkey for requested env code
	 * @param {Object} tenant
	 * @param {String} env
	 * @returns {null|String}
	 */
	let findExtKeyForEnvironment = (tenant, env) => {
		let key = null;
		tenant.applications.forEach(function (oneApplication) {

			//loop in tenant keys
			oneApplication.keys.forEach(function (oneKey) {

				//loop in tenant ext keys
				oneKey.extKeys.forEach(function (oneExtKey) {
					//get the ext key for the request environment who also has dashboardAccess true
					//note: only one extkey per env has dashboardAccess true, simply find it and break
					if (oneExtKey.env && oneExtKey.env === env) {
						key = oneExtKey.extKey; // key or ext key/.???? no key
					}
				});
			});
		});
		return key;
	};

	/**
	 * function that fetches a tenant record from core.provision
	 * @param {string} tCode
	 * @param {function} cb
	 */
	let getOriginalTenantRecord = (tCode, cb) => {
		core.provision.getTenantByCode(tCode, cb);
	};

	return (req, res, next) => {
		/*
		 get ext key for remote env requested
		 */
		let tenant = req.soajs.tenant;
		let parsedUrl = req.soajs.controller.serviceParams.parsedUrl;

		let remoteENV = req.headers.__env;
		if (parsedUrl.query && parsedUrl.query.__env) {
			remoteENV = parsedUrl.query.__env;
		}
		if (remoteENV) {
			remoteENV = remoteENV.toUpperCase();
		}
		let requestedRoute;
		//check if requested route is provided as query param
		if (parsedUrl.query && parsedUrl.query.proxyRoute) {
			requestedRoute = decodeURIComponent(parsedUrl.query.proxyRoute);
		}

		//stop if no requested path was found
		if (!requestedRoute) {
			return req.soajs.controllerResponse(core.error.getError(139));
		}

		if (remoteENV) {
			req.soajs.log.debug("attempting to redirect to: " + requestedRoute + " in " + remoteENV + " Environment.");
		} else {
			req.soajs.log.debug("attempting to redirect to: " + requestedRoute);
		}
		let tCode = null;
		let tExtKey = null;

		if (parsedUrl.query) {
			if (parsedUrl.query.tCode) {
				tCode = parsedUrl.query.tCode;
			} else if (tenant) {
				tCode = tenant.code;
			}
			if (parsedUrl.query.extKey) {
				tExtKey = parsedUrl.query.extKey;
			}
		}
		if (tExtKey) {
			//proceed with proxying the request
			proxyRequestToRemoteEnv(req, res, next, remoteENV, tExtKey, requestedRoute);
		} else if (tCode && remoteENV) {
			getOriginalTenantRecord(tCode, function (error, originalTenant) {
				if (error) {
					return req.soajs.controllerResponse(core.error.getError(139)); //todo: make sure we have set the correct error code number
				}

				//get extKey for remote environment for this tenant
				let remoteExtKey = findExtKeyForEnvironment(originalTenant, remoteENV);

				//no key found
				if (!remoteExtKey) {
					req.soajs.log.fatal("No remote key found for tenant: " + tCode + " in environment: " + remoteENV);
					return req.soajs.controllerResponse(core.error.getError(137));
				} else {
					//proceed with proxying the request
					proxyRequestToRemoteEnv(req, res, next, remoteENV, remoteExtKey, requestedRoute);
				}

			});
		}
		else {
			proxyRequestToRemoteEnv(req, res, next, remoteENV, null, requestedRoute);
		}
	};
};
