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
module.exports = () => {
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
		
		let key = req.headers.key || parsedUrl.query.key;
		if (!req.headers.key) {
			req.headers.key = key;
		}
		if (!req.query.access_token && req.headers.access_token) {
			req.query.access_token = req.headers.access_token;
		}
		return next();
	};
};