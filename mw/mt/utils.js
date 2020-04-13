"use strict";

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const lib = require("./../../lib");

const coreLibs = require("soajs.core.libs");

const async = require("async");
const Netmask = require('netmask').Netmask;
const useragent = require('useragent');
const merge = require('merge');

const UracDriver = require("./urac.js");


const {pathToRegexp} = require("path-to-regexp");

function constructRegExp(route) {
	let keys = [];
	let out = pathToRegexp(route, keys, {sensitive: true});
	if (out && out.keys && out.keys.length > 0) {
		out = new RegExp(out.toString());
	}
	return out;
}

/**
 * Contains functions to calculate and retrieve the ACL based on SOAJS layers
 *
 */
let _system = {
	"getAcl": function (obj) {
		return obj.finalAcl;
	}
};

/**
 * Contains functions to load the profile and group information of the logged in user
 *
 */
let _urac = {
	"getUser": function (req) {
		let urac = null;
		if (req.soajs.uracDriver) {
			urac = req.soajs.uracDriver.getProfile(false);
		}
		return urac;
	},
	"getGroups": function (req) {
		let groups = null;
		if (req.soajs.uracDriver) {
			groups = req.soajs.uracDriver.getGroups();
		}
		return groups;
	}
};

/**
 * Contains functions to check the permissions and the access to the requested API
 *
 */
let _api = {
	"checkPermission": function (system, req, api) {
		if ('restricted' === system.apisPermission) {
			if (!api) {
				return {"result": false, "error": 159};
			}
			return _api.checkAccess(api.access, req);
		}
		if (!api) {
			return {"result": true};
		}
		return _api.checkAccess(api.access, req);
	},
	"checkAccess": function (apiAccess, req) {
		if (!apiAccess) {
			return {"result": true};
		}
		if (!_urac.getUser(req)) {
			return {"result": false, "error": 161};
		}
		if (apiAccess instanceof Array) {
			let userGroups = _urac.getGroups(req);
			if (!userGroups) {
				return {"result": false, "error": 160};
			}
			for (let ii = 0; ii < userGroups.length; ii++) {
				if (apiAccess.indexOf(userGroups[ii]) !== -1) {
					return {"result": true};
				}
			}
			return {"result": false, "error": 160};
		} else {
			return {"result": true};
		}
	}
};

let utils = {
	
	"ipWhitelist": (obj, cb) => {
		
		obj.skipACL = false;
		obj.skipOAUTH = false;
		/**
		 * obj.req.soajs.registry.custom.gateway.value.mt
		 * {
			  "mt": {
			    "whitelist": {
			        "ips": ["10.0.0.0/8"],
			        "acl": true,
			        "oauth": true
			    }
			  }
			}
		 *
		 */
		if (obj.req.soajs.registry &&
			obj.req.soajs.registry.custom &&
			obj.req.soajs.registry.custom.gateway &&
			obj.req.soajs.registry.custom.gateway.value &&
			obj.req.soajs.registry.custom.gateway.value.mt &&
			obj.req.soajs.registry.custom.gateway.value.mt.whitelist &&
			obj.req.soajs.registry.custom.gateway.value.mt.whitelist.ips) {
			let clientIp = obj.req.getClientIP();
			let geoAccess = obj.req.soajs.registry.custom.gateway.value.mt.whitelist.ips; //["127.0.0.0/8"];
			let checkAccess = (geoAccessArr, ip) => {
				return (geoAccessArr.some(function (addr) {
					try {
						let block = new Netmask(addr);
						return block.contains(ip);
					} catch (err) {
						obj.req.soajs.log.error('IP whitelist security configuration failed: ', addr);
						obj.req.soajs.log.error(err);
					}
					return false;
				}));
			};
			if (clientIp && geoAccess && geoAccess && Array.isArray(geoAccess)) {
				let matched = checkAccess(geoAccess, clientIp);
				if (matched) {
					obj.req.soajs.log.debug("ACL skip detected for ip: " + clientIp);
					if (obj.req.soajs.registry.custom.gateway.value.mt.whitelist.acl) {
						obj.skipACL = true;
					}
					if (obj.req.soajs.registry.custom.gateway.value.mt.whitelist.oauth) {
						obj.skipOAUTH = true;
					}
				}
			}
			
			return cb(null, obj);
		} else {
			return cb(null, obj);
		}
	},
	
	"aclUrackCheck": (obj, cb) => {
		if (obj.skipOAUTH) {
			return cb(null, obj);
		}
		if (!obj.req.soajs.uracDriver) {
			return cb(null, obj);
		}
		let uracACL = obj.req.soajs.uracDriver.getAcl();
		if (!uracACL) {
			return cb(null, obj);
		}
		obj.req.soajs.log.debug("Found ACL at URAC level, overriding default ACL configuration.");
		if (uracACL) {
			obj.finalAcl = uracACL[obj.req.soajs.controller.serviceParams.name];
			if (obj.finalAcl) {
				let san_v = coreLibs.version.sanitize(obj.req.soajs.controller.serviceParams.version);
				obj.finalAcl = obj.finalAcl[san_v] || obj.finalAcl;
				
				let method = obj.req.method.toLocaleLowerCase();
				if (obj.finalAcl && obj.finalAcl[method] && typeof obj.finalAcl[method] === "object") {
					let newAclObj = {};
					if (obj.finalAcl.hasOwnProperty('access')) {
						newAclObj.access = obj.finalAcl.access;
					}
					if (obj.finalAcl[method].hasOwnProperty('apis')) {
						newAclObj.apis = obj.finalAcl[method].apis;
					}
					if (obj.finalAcl[method].hasOwnProperty('apisRegExp')) {
						newAclObj.apisRegExp = obj.finalAcl[method].apisRegExp;
					}
					if (obj.finalAcl[method].hasOwnProperty('apisPermission')) {
						newAclObj.apisPermission = obj.finalAcl[method].apisPermission;
					} else if (obj.finalAcl.hasOwnProperty('apisPermission')) {
						newAclObj.apisPermission = obj.finalAcl.apisPermission;
					}
					obj.finalAcl = newAclObj;
				}
				obj.finalAcl = lib.apiPathParam2apiRegExp(obj.finalAcl);
			}
		}
		return cb(null, obj);
	},
	
	"aclCheck": (obj, cb) => {
		obj.finalAcl = null;
		if (obj.req.soajs.controller.serviceParams.finalAcl) {
			obj.finalAcl = obj.req.soajs.controller.serviceParams.finalAcl;
		}
		return cb(null, obj);
	},
	
	/**
	 * Checks if the requested service is accessible based on the ACL configuration
	 *
	 * @param {Object} obj
	 * @param {Function} cb
	 * @returns {function}
	 */
	"serviceCheck": (obj, cb) => {
		if (obj.skipACL) {
			return cb(null, obj);
		}
		let system = _system.getAcl(obj);
		if (system) {
			return cb(null, obj);
		} else {
			return cb(154);
		}
	},
	
	/**
	 * checks the geo location of the ariving request against the key configuration
	 * if there is a conflict, the request is not allowed to proceed
	 *
	 * @param {Object} obj
	 * @param {Function} cb
	 * @returns {function}
	 */
	"securityGeoCheck": (obj, cb) => {
		if (obj.skipACL) {
			return cb(null, obj);
		}
		let clientIp = obj.req.getClientIP();
		let geoAccess = obj.keyObj.geo; //{"allow": ["127.0.0.1"], "deny": []};
		obj.geo = {"ip": clientIp};
		
		let checkAccess = (geoAccessArr, ip) => {
			return (geoAccessArr.some(function (addr) {
				try {
					let block = new Netmask(addr);
					return block.contains(ip);
				} catch (err) {
					obj.req.soajs.log.error('Geographic security configuration failed: ', addr);
					obj.req.soajs.log.error(err);
				}
				return false;
			}));
		};
		
		if (clientIp && geoAccess && geoAccess.deny && Array.isArray(geoAccess.deny)) {
			let denied = checkAccess(geoAccess.deny, clientIp);
			if (denied) {
				return cb(155);
			}
		}
		
		if (clientIp && geoAccess && geoAccess.allow && Array.isArray(geoAccess.allow)) {
			let allowed = checkAccess(geoAccess.allow, clientIp);
			if (!allowed) {
				return cb(155);
			}
		}
		
		return cb(null, obj);
	},
	
	/**
	 * checks the device from whicht the ariving request was sent against the key configuration
	 * if there is a conflict, the request is not allowed to proceed
	 *
	 * @param {Object} obj
	 * @param {Function} cb
	 * @returns {function}
	 */
	"securityDeviceCheck": (obj, cb) => {
		if (obj.skipACL) {
			return cb(null, obj);
		}
		let clientUA = obj.req.getClientUserAgent();
		let deviceAccess = obj.keyObj.device; //{"allow": [{"family": "chrome"}], "deny": []};
		obj.device = clientUA;
		
		let validateField = (fieldName, uaObj, da) => {
			if (da[fieldName] && da[fieldName] !== '*' && uaObj[fieldName]) {
				if (typeof (da[fieldName]) === 'string') {
					if (da[fieldName].trim().toUpperCase() !== uaObj[fieldName].trim().toUpperCase()) {
						return false;
					}
				} else { // object
					if (da[fieldName].min) {
						if (da[fieldName].min.trim() > uaObj[fieldName].trim()) {
							return false;
						}
					}
					if (da[fieldName].max) {
						if (da[fieldName].max.trim() < uaObj[fieldName].trim()) {
							return false;
						}
					}
				}
			}
			return true;
		};
		
		let checkAccess = (deviceAccessArr, ua) => {
			let uaObj = useragent.lookup(ua);
			//if (uaObj && uaObj.family && uaObj.os && uaObj.os.family) {
			if (uaObj && uaObj.family) {
				return (deviceAccessArr.some(function (da) {
					if (!da) {
						return false;
					}
					if (da.family && da.family !== '*') {
						if (da.family.trim().toUpperCase() !== uaObj.family.trim().toUpperCase()) {
							return false;
						}
					}
					if (da.os && da.os !== '*') {
						if (uaObj.os && uaObj.os.family) {
							if (uaObj.os.family.trim().toUpperCase().indexOf(da.os.family.trim().toUpperCase()) === -1) {
								return false;
							}
							if (!validateField('major', uaObj.os, da.os)) {
								return false;
							}
							if (!validateField('minor', uaObj.os, da.os)) {
								return false;
							}
							if (!validateField('patch', uaObj.os, da.os)) {
								return false;
							}
						}
						else {
							return false;
						}
					}
					if (!validateField('major', uaObj, da)) {
						return false;
					}
					if (!validateField('minor', uaObj, da)) {
						return false;
					}
					if (!validateField('patch', uaObj, da)) {
						return false;
					}
					return true;
				}));
			}
		};
		
		if (clientUA && deviceAccess && deviceAccess.deny && Array.isArray(deviceAccess.deny)) {
			let denied = checkAccess(deviceAccess.deny, clientUA);
			if (denied) {
				return cb(156);
			}
		}
		
		if (clientUA && deviceAccess && deviceAccess.allow && Array.isArray(deviceAccess.allow)) {
			let allowed = checkAccess(deviceAccess.allow, clientUA);
			if (!allowed) {
				return cb(156);
			}
		}
		
		return cb(null, obj);
	},
	
	/**
	 * Checks if oauth is turned on and the ACL strategy of the API.
	 * If the API is public, the request moves forward
	 * If the API is private, the oauth is then used along with system to determine if the API is accessible or not
	 *
	 * oAuth Conf exists in 2 locations:
	 *  - registry under: obj.req.soajs.registry.serviceConfig.oauth
	 *       type, secret, grants, algorithms, audience, accessTokenLifetime, refreshTokenLifetime, debug
	 *  - tenant under: provision.getTenantOauth(obj.req.soajs.tenant.id, (err, tenantOauth))
	 *       type, secret, loginMode, disabled
	 *
	 * @param {Object} obj
	 * @param {Function} cb
	 * @returns {function}
	 */
	"oauthCheck": (obj, cb) => {
		if (obj.skipOAUTH) {
			return cb(null, obj);
		}
		let oAuthTurnedOn = false;
		if (obj.soajs.oauth) {
			oAuthTurnedOn = true;
		}
		if (oAuthTurnedOn) {
			let oauthExec = function () {
				if (obj.req.soajs.tenantOauth && obj.req.soajs.tenantOauth.disabled) {
					obj.req.soajs.log.debug("oAuth for tenant " + obj.req.soajs.tenant.id + " is disabled, skipping logging in user ...");
					return cb(null, obj);
				}
				return obj.soajs.oauth(obj.req, obj.res, function (error) {
					if (error) {
						return cb(error, obj);
					} else {
						
						let pin_allowedAPI_check = () => {
							// Skip is this is pin login route on oauth
							// Skip if route on controller
							// Skip if pinWrapper route aka custom pin login
							// Skip if in pinWhitelist
							if (obj.soajs.oauthService && (obj.req.soajs.controller.serviceParams.name === obj.soajs.oauthService.name) && (obj.req.soajs.controller.serviceParams.path === obj.soajs.oauthService.pinApi)) {
								return cb(null, obj);
							} else if (obj.req.soajs.controller.serviceParams.name === obj.gatewayServiceName) {
								return cb(null, obj);
							} else if (obj.req.soajs.registry &&
								obj.req.soajs.registry.custom &&
								obj.req.soajs.registry.custom.oauth &&
								obj.req.soajs.registry.custom.oauth.value &&
								obj.req.soajs.registry.custom.oauth.value.pinWrapper &&
								(obj.req.soajs.registry.custom.oauth.value.pinWrapper.servicename === obj.req.soajs.controller.serviceParams.name) &&
								(obj.req.soajs.registry.custom.oauth.value.pinWrapper.apiname === obj.req.soajs.controller.serviceParams.path)
							) {
								return cb(null, obj);
							} else {
								//TODO add pin whitelist to be fetch from the registry
								//obj.req.soajs.registry.custom.oauth.value.whitelist "servicename": {"method": ["api1, api2", ...], ...}, version ???
								if (obj.req.soajs.registry &&
									obj.req.soajs.registry.custom &&
									obj.req.soajs.registry.custom.oauth &&
									obj.req.soajs.registry.custom.oauth.value &&
									obj.req.soajs.registry.custom.oauth.value.pinWhitelist &&
									obj.req.soajs.registry.custom.oauth.value.pinWhitelist[obj.req.soajs.controller.serviceParams.name]) {
									
									let method = obj.req.method.toLocaleLowerCase();
									let whitelist = obj.req.soajs.registry.custom.oauth.value.pinWhitelist[obj.req.soajs.controller.serviceParams.name];
									
									obj.req.soajs.log.debug("pinWhitelist detected for service [" + obj.req.soajs.controller.serviceParams.name + "]");
									if (whitelist[method]) {
										if (whitelist[method].apis && Array.isArray(whitelist[method].apis)) {
											if (whitelist[method].apis.includes(obj.req.soajs.controller.serviceParams.path)) {
												return cb(null, obj);
											}
										}
										if (whitelist[method].regex && Array.isArray(whitelist[method].regex)) {
											for (let i = 0; i < whitelist[method].regex.length; i++) {
												let regexp_out = constructRegExp(whitelist[method].regex[i]);
												if (obj.req.soajs.controller.serviceParams.path.match(regexp_out)) {
													return cb(null, obj);
												}
											}
										}
									}
									obj.req.soajs.log.debug("pinWhitelist not found for method [" + method + "] and path [" + obj.req.soajs.controller.serviceParams.path + "]");
									
								}
								return cb(145, obj);
							}
						};
						
						if (obj.req.oauth && obj.req.oauth.bearerToken && obj.req.oauth.bearerToken.user && (obj.req.oauth.bearerToken.user.loginMode === 'urac') && obj.req.oauth.bearerToken.user.pinLocked) {
							return pin_allowedAPI_check();
						} else {
							let product = null;
							if (obj.req.soajs.tenant && obj.req.soajs.tenant.application) {
								product = obj.req.soajs.tenant.application.product;
							}
							if (product && obj.req.oauth.bearerToken.user.loginMode === 'urac' && obj.req.soajs.tenantOauth.pin && obj.req.soajs.tenantOauth.pin[product] && obj.req.soajs.tenantOauth.pin[product].enabled) {
								if (obj.req.oauth.bearerToken.user.pinLogin) {
									return cb(null, obj);
								}
								return pin_allowedAPI_check();
							}
							return cb(null, obj);
						}
					}
				});
			};
			
			let system = _system.getAcl(obj);
			let api = (system && system.apis ? system.apis[obj.req.soajs.controller.serviceParams.path] : null);
			if (!api && system && system.apisRegExp && Object.keys(system.apisRegExp).length > 0) {
				for (let jj = 0; jj < system.apisRegExp.length; jj++) {
					if (system.apisRegExp[jj].regExp && obj.req.soajs.controller.serviceParams.path.match(system.apisRegExp[jj].regExp)) {
						api = system.apisRegExp[jj];
					}
				}
			}
			
			//public means:
			//-------------
			//case 0:
			//acl.systemName.access = false
			//no apiName
			//case 1:
			//acl.systemName.access = false
			//acl.systemName.apis.apiName.access = false
			//case 2:
			//acl.systemName.access = true
			//acl.systemName.apisRegExp.access = false
			//case 3:
			//acl.systemName.access = false
			//acl.systemName.apisRegExp.access = false
			//case 4:
			//acl.systemName.access = true
			//acl.systemName.apis.apiName.access = false
			//case 5:
			//acl.systemName.apisPermission = "restricted"
			//acl.systemName.apis.apiName.access = false
			let serviceApiPublic = false;
			if (system) {
				if (system.access) {
					if (api && !api.access) {
						serviceApiPublic = true; //case 4 & case 2
					}
				} else {
					if (!api || (api && !api.access)) {
						serviceApiPublic = true; //case 1 & case 3 & case 0
					}
				}
				if ('restricted' === system.apisPermission) {
					if (api && !api.access) {
						serviceApiPublic = true; //case 5
					}
				}
			}
			if (serviceApiPublic) {
				if (obj.req && obj.req.query && obj.req.query.access_token) {
					serviceApiPublic = false;
				}
			}
			if (serviceApiPublic) {
				return cb(null, obj);
			} else {
				return oauthExec();
			}
		}
		else {
			return cb(null, obj);
		}
	},
	
	/**
	 * Check if the request contains oauth tokens, and calls the urac Driver to retrieve the corresponding user record
	 * @param {Object} obj
	 * @param {Function} cb
	 * @returns {*}
	 */
	"uracCheck": (obj, cb) => {
		if (obj.skipOAUTH) {
			return cb(null, obj);
		}
		let callURACDriver = function () {
			obj.req.soajs.uracDriver = new UracDriver({"soajs": obj.req.soajs, "oauth": obj.req.oauth});
			obj.req.soajs.uracDriver.init((error) => {
				if (error) {
					obj.req.soajs.log.error(error);
				}
				let userServiceConf = obj.req.soajs.uracDriver.getConfig();
				userServiceConf = userServiceConf || {};
				
				let tenantServiceConf = obj.keyObj.config;
				obj.servicesConfig = merge.recursive(true, tenantServiceConf, userServiceConf);
				return cb(null, obj);
			});
		};
		
		/**
		 * returns code for the requested tenant.
		 * if tenant is the same in the request, returns tenant from request
		 * @param {Function} cb
		 * @returns {*}
		 */
		let getTenantInfo = (cb) => {
			//if tenant id === client id, don't get tenant data
			if (obj.req.soajs.tenant.id === obj.req.oauth.bearerToken.clientId) {
				obj.req.soajs.log.debug("loading tenant data from req.soajs.tenant.id");
				return cb(null, obj.req.soajs.tenant);
			}
			
			obj.req.soajs.log.debug("loading tenant data from req.oauth.bearerToken.clientId");
			obj.provision.getTenantData(obj.req.oauth.bearerToken.clientId, function (error, tenant) {
				if (error || !tenant) {
					if (!tenant) {
						error = new Error("Tenant not found for:" + obj.req.oauth.bearerToken.clientId);
					}
					obj.req.soajs.log.error(error);
					return cb(error);
				}
				
				return cb(null, tenant);
			});
		};
		
		/**
		 * load the registry of the requested environment.
		 * if environment is the same in the request, return registry from request
		 * @param {Function} cb
		 * @returns {*}
		 */
		let getEnvRegistry = (cb) => {
			//if environment is the same as regEnvironment, use it
			if (obj.req.oauth.bearerToken.env === obj.regEnvironment) {
				obj.req.soajs.log.debug("loading env registry from req.soajs.registry");
				return cb(null, obj.req.soajs.registry);
			}
			
			obj.req.soajs.log.debug("loading env registry from req.oauth.bearerToken.env");
			obj.core.registry.loadByEnv({"envCode": obj.req.oauth.bearerToken.env}, function (error, registry) {
				if (error || !registry) {
					if (!registry) {
						error = new Error("Registry not found for:" + obj.req.oauth.bearerToken.env);
					}
					obj.req.soajs.log.error(error);
					return cb(error);
				}
				return cb(null, registry);
			});
		};
		
		//NOTE: we go here only if the possibility of roaming is true
		if (obj.req && obj.req.oauth && obj.req.oauth.bearerToken) {
			if (obj.req.oauth.bearerToken.env === "dashboard" && obj.req.oauth.bearerToken.env !== obj.regEnvironment) {
				async.parallel({"tenant": getTenantInfo, "registry": getEnvRegistry}, function (error, response) {
					if (error) {
						return cb(170);
					}
					//NOTE we need tId and id because in urac.driver we reference them both, we must fix urac.driver to use only 1 of them
					obj.req.soajs.tenant.roaming = {
						"tId": obj.req.oauth.bearerToken.clientId,
						"id": obj.req.oauth.bearerToken.clientId,
						"user": obj.req.oauth.bearerToken.user,
						"code": response.tenant.code
					};
					
					if (response.registry && response.registry.tenantMetaDB) {
						obj.req.soajs.tenant.roaming.tenantMetaDB = response.registry.tenantMetaDB;
					}
					
					return callURACDriver();
				});
			} else {
				return callURACDriver();
			}
		} else {
			return cb(null, obj);
		}
	},
	
	/**
	 * Checks if the acl permissions allow access to the requested api or not
	 * @param {Object} obj
	 * @param {Function} cb
	 * @returns {function}
	 */
	"apiCheck": (obj, cb) => {
		if (obj.skipACL) {
			return cb(null, obj);
		}
		let system = _system.getAcl(obj);
		let api = (system && system.apis ? system.apis[obj.req.soajs.controller.serviceParams.path] : null);
		if (!api && system && system.apisRegExp && Object.keys(system.apisRegExp).length) {
			for (let jj = 0; jj < system.apisRegExp.length; jj++) {
				if (system.apisRegExp[jj].regExp && obj.req.soajs.controller.serviceParams.path.match(system.apisRegExp[jj].regExp)) {
					api = system.apisRegExp[jj];
				}
			}
		}
		let apiRes = null;
		if (system && system.access) {
			if (api && !api.access) {
				obj.req.soajs.controller.serviceParams.isAPIPublic = true;
			}
			if (_urac.getUser(obj.req)) {
				if (system.access instanceof Array) {
					let checkAPI = false;
					let userGroups = _urac.getGroups(obj.req);
					if (userGroups) {
						for (let ii = 0; ii < userGroups.length; ii++) {
							if (system.access.indexOf(userGroups[ii]) !== -1) {
								checkAPI = true;
							}
						}
					}
					if (!checkAPI) {
						return cb(157);
					}
				}
			} else {
				if (!api || api.access) {
					return cb(158);
				}
			}
			apiRes = _api.checkPermission(system, obj.req, api);
			if (apiRes.result) {
				return cb(null, obj);
			} else {
				return cb(apiRes.error);
			}
		} else {
			if (!api || (api && !api.access)) {
				obj.req.soajs.controller.serviceParams.isAPIPublic = true;
			}
		}
		if (api || (system && ('restricted' === system.apisPermission))) {
			if (api && !api.access) {
				obj.req.soajs.controller.serviceParams.isAPIPublic = true;
			}
			apiRes = _api.checkPermission(system, obj.req, api);
			if (apiRes.result) {
				return cb(null, obj);
			} else {
				return cb(apiRes.error);
			}
		}
		else {
			return cb(null, obj);
		}
	}
};

module.exports = utils;