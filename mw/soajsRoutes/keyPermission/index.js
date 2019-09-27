'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

/**
 *
 * @param configuration
 * @returns {Function}
 */
module.exports = (configuration) => {
	let core = configuration.core;
	
	/**
	 * Function that retrieves the dashboard access key and its ACL permissions from the public extkey provided for logged in users
	 * @param req
	 * @param res
	 */
	let returnKeyAndPermissions = (req) => {
		let tenant = req.soajs.tenant;
		
		if (req.soajs.uracDriver && req.soajs.uracDriver.getProfile() && req.soajs.uracDriver.getProfile().tenant) {
			tenant = req.soajs.uracDriver.getProfile().tenant;
		}
		
		if (req.soajs.tenant.locked) {
			tenant.locked = req.soajs.tenant.locked;
		}
		
		//if saas mode and inputs contain project value, append it to tenant object
		if (process.env.SOAJS_SAAS && req.query && req.query.soajs_project && req.query.soajs_project !== '') {
			req.soajs.log.debug("detected saas project", req.query.soajs_project);
			tenant.soajs_project = req.query.soajs_project;
		}
		
		findExtKey(tenant, function (error, data) {
			if (error) {
				req.soajs.log.error(error);
				return req.soajs.controllerResponse(core.error.getError(135));
			}
			req.soajs.log.debug("Switching tenant to:", data);
			findKeyPermissions(function (error, info) {
				if (error) {
					req.soajs.log.error(error);
					return req.soajs.controllerResponse(core.error.getError(135));
				}
				
				for (let i in info) {
					if (Object.hasOwnProperty.call(info, i)) {
						data[i] = info[i];
					}
				}
				req.soajs.log.debug("Tenant Permitted to:", data);
				return req.soajs.controllerResponse(data);
			});
		});
		
		function findExtKey(tenant, cb) {
			core.provision.getEnvironmentExtKeyWithDashboardAccess(tenant, cb);
		}
		
		function findKeyPermissions(cb) {
			//let ACL = null;
			let ACL = req.soajs.uracDriver.getAclAllEnv();
			
			let resume = () => {
				let tenant = req.soajs.tenant;
				if (!ACL) {
					ACL = (tenant.application.acl_all_env) ? tenant.application.acl_all_env : tenant.application.package_acl_all_env;
					
					//old system acl schema
					if (!ACL) {
						ACL = (tenant.application.acl) ? tenant.application.acl : tenant.application.package_acl;
					}
				}
				
				core.registry.getAllRegistriesInfo(function (error, environments) {
					if (error) {
						return cb(error);
					}
					
					let envInfo = core.provision.getEnvironmentsFromACL(ACL, environments);
					return cb(null, {"acl": ACL, "environments": envInfo});
				});
			};
			resume();
		}
	};
	
	return (req, res, next) => {
		let serviceInfo = req.soajs.controller.serviceParams.serviceInfo;
		
		//check if route is key/permission/get then you also need to bypass the exctract Build Param BL
		let keyPermissionGet = (serviceInfo[1] === 'key' && serviceInfo[2] === 'permission' && serviceInfo[3] === 'get');
		if (keyPermissionGet) {
			//doesn't work without a key in the headers
			if (!req.headers || !req.headers.key) {
				return req.soajs.controllerResponse(core.error.getError(132));
			}
			
			//mimic a service named controller with route /key/permission/get
			let serviceName = "controller";
			req.soajs.controller.serviceParams.registry = req.soajs.registry.services[serviceName];
			req.soajs.controller.serviceParams.name = serviceName;
			req.soajs.controller.serviceParams.url = "/key/permission/get";
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
							"l": "Get Key Permissions",
							"v": "/key/permission/get",
							"m": "get"
						}
					]
				}
			};
			
			//assign the correct method to gotoservice in controller
			req.soajs.controller.gotoservice = returnKeyAndPermissions;
			return next();
		}
	};
};
