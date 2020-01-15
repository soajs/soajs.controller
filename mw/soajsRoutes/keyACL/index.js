'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

module.exports = (configuration) => {
	let core = configuration.core;
	
	let return_SOAJS_keyACL = (req) => {
		let tenant = req.soajs.tenant;
		
		let ACL = null;
		if (req.soajs.uracDriver) {
			ACL = req.soajs.uracDriver.getAcl();
		}
		if (!ACL) {
			ACL = tenant.application.acl;
		}
		let response = {
			"acl": ACL
		};
		return req.soajs.controllerResponse(response);
	};
	
	return (req, res, next) => {
		
		//doesn't work without a key in the headers
		if (!req.headers || !req.headers.key) {
			return req.soajs.controllerResponse(core.error.getError(132));
		}
		
		//mimic a service named controller with route /key/permission/get
		let serviceName = "controller";
		req.soajs.controller.serviceParams.registry = req.soajs.registry.services[serviceName];
		req.soajs.controller.serviceParams.name = serviceName;
		req.soajs.controller.serviceParams.url = "/soajs/acl";
		req.soajs.controller.serviceParams.version = "1";
		req.soajs.controller.serviceParams.extKeyRequired = true;
		req.soajs.controller.serviceParams.registry.versions = {
			"1": {
				"extKeyRequired": true,
				"oauth": true,
				"urac": true,
				"urac_ACL": true,
				"provision_ACL": true,
				"apis": [
					{
						"l": "Get ACL",
						"v": "/soajs/acl/",
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
