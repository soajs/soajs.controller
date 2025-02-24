'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

// const url = require('url');
// let http = require('http');
const { proxyRequest } = require("../../lib/request.js");

module.exports = (configuration) => {

	let core = configuration.core;
	let isRequestAuthorized = require("./lib/isRequestAuthorized.js");
	let preRedirect = require("./lib/preRedirect.js");

	/**
	 *
	 * @param req
	 * @param res
	 * @returns {*}
	 */
	return (req, res) => {
		preRedirect(req, res, core, function (obj) {
			let requestConfig = {};
			try {
				const urlObj = new URL(obj.uri);
				requestConfig = {
					"hostname": urlObj.hostname,
					"port": urlObj.port,
					"path": urlObj.pathname + urlObj.search,
					"method": req.method.toUpperCase(),
					'headers': req.headers
				};
				requestConfig.headers.host = urlObj.hostname;
				if (obj.config.authorization) {
					isRequestAuthorized(req, core, requestConfig);
				}
			} catch (e) {
				req.soajs.log.error(e.message + " @catch");
				if (req.soajs.controller.redirectedRequest) {
					req.soajs.controller.redirectedRequest.destroy();
					req.soajs.controller.redirectedRequest = null;
				}
				if (!req.soajs.controller.monitorEndingReq) {
					return req.soajs.controllerResponse(core.error.getError(135));
				}
			}
			const extraOptions = {
				"resHEaders": {
					"access-control-allow-origin": "*"
				}
			};

			proxyRequest(req, res, requestConfig, extraOptions)
				.then(() => {
				})
				.catch((err) => {
					req.soajs.log.error(err.code, err.message);
					if (req.soajs.controller.redirectedRequest) {
						req.soajs.controller.redirectedRequest.destroy();
						req.soajs.controller.redirectedRequest = null;
					}
					if (!req.soajs.controller.monitorEndingReq) {
						return req.soajs.controllerResponse(core.error.getError(135));
					}
				});
		});

		// preRedirect(req, res, core, function (obj) {
		// 	// req.pause();

		// 	let requestOptions = url.parse(obj.uri);
		// 	requestOptions.headers = req.headers;
		// 	requestOptions.method = req.method;
		// 	requestOptions.agent = false;
		// 	requestOptions.headers.host = requestOptions.host;

		// 	if (obj.config.authorization) {
		// 		isRequestAuthorized(req, core, requestOptions);
		// 	}
		// 	try {
		// 		req.soajs.controller.redirectedRequest = http.request(requestOptions, function (serverResponse) {
		// 			serverResponse.pause();
		// 			serverResponse.headers['access-control-allow-origin'] = '*';

		// 			res.writeHeader(serverResponse.statusCode, serverResponse.headers);
		// 			serverResponse.pipe(res, {end: true});
		// 			serverResponse.resume();
		// 		});
		// 		req.soajs.controller.redirectedRequest.on('error', function (err) {
		// 			req.soajs.log.error(err.code, err.message);
		// 			if (req.soajs.controller.redirectedRequest) {
		// 				req.soajs.controller.redirectedRequest.destroy();
		// 				req.soajs.controller.redirectedRequest = null;
		// 			}
		// 			if (!req.soajs.controller.monitorEndingReq) {
		// 				return req.soajs.controllerResponse(core.error.getError(135));
		// 			}
		// 		});
		// 		req.pipe(req.soajs.controller.redirectedRequest, {end: true});
		// 		// req.resume();
		// 	} catch (e) {
		// 		req.soajs.log.error(e.message + " @catch");
		// 		if (req.soajs.controller.redirectedRequest) {
		// 			req.soajs.controller.redirectedRequest.destroy();
		// 			req.soajs.controller.redirectedRequest = null;
		// 		}
		// 		if (!req.soajs.controller.monitorEndingReq) {
		// 			return req.soajs.controllerResponse(core.error.getError(135));
		// 		}
		// 	}
		// });
	};
};
