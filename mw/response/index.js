'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const SoajsRes = require("./response.js");

/**
 *
 * @param configuration
 * @returns {Function}
 */
module.exports = (configuration) => {
	return (req, res, next) => {
		let ended = false;
		if (!req.soajs) {
			req.soajs = {};
		}
		req.soajs.buildResponse = function (error, data) {
			let response = null;
			if (error) {
				response = new SoajsRes(false);
				if (Array.isArray(error)) {
					let len = error.length;
					for (let i = 0; i < len; i++) {
						response.addErrorCode(error[i].code, error[i].msg);
					}
				} else {
					response.addErrorCode(error.code, error.msg);
				}
			} else {
				response = new SoajsRes(true, data);
			}

			return response;
		};
		if (configuration && configuration.controllerResponse) {
			req.soajs.controllerResponse = function (jsonObj) {
				let jsonRes = jsonObj;
				if (req.soajs.buildResponse && jsonObj && jsonObj.code && jsonObj.msg) {
					if (!jsonObj.status) {
						jsonObj.status = 500;
					}
					jsonRes = req.soajs.buildResponse(jsonObj);
				}

				let headObj = {};
				if (jsonObj && jsonObj.headObj) {
					headObj = jsonObj.headObj;
					if (jsonRes.headObj) {
						delete jsonRes.headObj;
					}
				}
				headObj['Content-Type'] = 'application/json';
				if (!res.headersSent) {
					if (jsonObj && jsonObj.status) {
						res.writeHead(jsonObj.status, headObj);
					} else {
						res.writeHead(200, headObj);
					}
				}
				if (!ended) {
					ended = true;
					res.end(JSON.stringify(jsonRes));
				}
			};
		}
		return next();
	};
};

