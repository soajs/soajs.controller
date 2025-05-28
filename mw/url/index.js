'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const url = require('url');
let libParseURL = require('../../lib/parseURL');

/**
 * Assure req param (soajs & soajs.controller)
 * Parse url and fetch service info (soajs.controller.serviceParams)
 * Assure key as header param
 *
 * @returns {Function}
 */
module.exports = (configuration) => {
	let core = configuration.core;

	return (req, res, next) => {
		if (!req.soajs) {
			throw new TypeError('soajs mw is not started');
		}

		if (!req.soajs.controller) {
			req.soajs.controller = {};
		}

		let parsedUrl = url.parse(req.url, true);
		if (!req.query && parsedUrl.query) {
			req.query = parsedUrl.query;
		}

		if (!req.query) {
			req.query = {};
		}
		req.soajs.controller.serviceParams = libParseURL(req.url, parsedUrl);
		if (!req.soajs.controller.serviceParams.service_n || req.soajs.controller.serviceParams.service_n === '') {
			return req.soajs.controllerResponse(core.error.getError(136));
		}
		if (
			req.soajs.controller.serviceParams.service_n !== "soajs" &&
			(
				!req.soajs.registry ||
				!req.soajs.registry.services ||
				!req.soajs.registry.services[req.soajs.controller.serviceParams.service_n]
			)) {
			req.soajs.log.fatal("Service [" + req.soajs.controller.serviceParams.service_n + "] URL [" + req.url + "] couldn't be matched to a service or the service entry in registry is missing [port || hosts]");
			req.soajs.log.warn(JSON.stringify({ "url": req.url, "headers": req.headers }));
			return req.soajs.controllerResponse(core.error.getError(130));
		}

		let key = req.headers.key || req.query.key;
		if (!req.headers.key) {
			req.headers.key = key;
		}
		if (!req.query.access_token) {
			if (req.headers.access_token) {
				req.query.access_token = req.headers.access_token;
			} else if (req.headers.Authorization) {
				let token = req.headers.Authorization;
				let matches = token.match(/Bearer\s(\S+)/);
				if (matches && matches[1]) {
					req.query.access_token = matches[1];
					delete req.headers.Authorization;
				}
			}
		}
		return next();
	};
};
