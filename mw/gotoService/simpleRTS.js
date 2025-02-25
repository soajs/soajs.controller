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
				if (!req.soajs.controller.monitorEndingReq) {
					return req.soajs.controllerResponse(core.error.getError(135));
				}
			}
			const extraOptions = {
				"resHEaders": {
					"access-control-allow-origin": "*"
				},
				"fetchProxReq": (proxyReq) => {
					req.soajs.controller.redirectedRequest = proxyReq;
				}
			};

			proxyRequest(req, res, requestConfig, extraOptions)
				.then(() => {
				})
				.catch((err) => {
					req.soajs.log.error(err.code, err.message);
					// if (req.soajs.controller.redirectedRequest) {
					// 	req.soajs.controller.redirectedRequest.destroy();
					// 	req.soajs.controller.redirectedRequest = null;
					// }
					if (!req.soajs.controller.monitorEndingReq) {
						return req.soajs.controllerResponse(core.error.getError(135));
					}
				});
		});
	};
};
