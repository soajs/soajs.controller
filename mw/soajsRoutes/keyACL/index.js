'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const aclLib = require("../lib/acl.js");

module.exports = (configuration) => {
	let core = configuration.core;

	let return_SOAJS_keyACL = (req) => {
		let computed = aclLib.computeACL(req);

		let urac = null;
		if (req.soajs.uracDriver) {
			let uracObj = req.soajs.uracDriver.getProfile();
			if (uracObj) {
				urac = {
					"_id": uracObj._id
				};
			}
		}

		let tenant = null;
		let keyObj = req.soajs.controller.serviceParams.keyObj;
		if (keyObj && keyObj.application && keyObj.application.package) {
			tenant = {
				"id": keyObj.tenant.id,
				"name": keyObj.tenant.name,
				"code": keyObj.tenant.code,
				// "locked": keyObj.tenant.locked,
				// "roaming": data.req.soajs.tenant.roaming,
				"type": keyObj.tenant.type
			};
		}

		let response = {
			"acl": computed.acl,
			"finalACL": computed.finalACL,
			"packages": computed.packages,
			"urac": urac,
			"tenant": tenant
		};
		return req.soajs.controllerResponse(response);
	};

	return (req, res, next) => {

		//doesn't work without a key in the headers
		if (!req.headers || !req.headers.key) {
			return req.soajs.controllerResponse(core.error.getError(132));
		}

		//mimic an api of the gateway, so mt runs the key, oauth and urac checks
		aclLib.mimicGatewayApi(req, configuration, {
			"l": "Get ACL",
			"v": "/soajs/acl",
			"m": "get"
		});

		//assign the correct method to gotoservice in controller
		req.soajs.controller.gotoservice = return_SOAJS_keyACL;
		return next();

	};
};
