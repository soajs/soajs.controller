'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const lib = require("./../../lib");
const coreLibs = require("soajs.core.libs");

/**
 *
 * @param configuration
 * @returns {Function}
 */
module.exports = () => {
	
	// obj {req, keyObj, packObj}
	let aclCheck = (obj, cb) => {
		let aclObj = null;
		let finalAcl = null;
		
		if (!aclObj && obj.keyObj.application.acl) {
			obj.req.soajs.log.debug("Found ACL at Tenant Application level, overriding default ACL configuration.");
			aclObj = obj.keyObj.application.acl[obj.req.soajs.controller.serviceParams.name];
		}
		if (!aclObj && obj.packObj.acl) {
			obj.req.soajs.log.debug("Found Default ACL at Package level, setting default ACL configuration.");
			aclObj = obj.packObj.acl[obj.req.soajs.controller.serviceParams.name];
		}
		
		if (aclObj && (aclObj.apis || aclObj.apisRegExp)) {
			obj.req.soajs.log.debug("Detected old schema ACL Configuration ...");
			finalAcl = lib.apiPathParam2apiRegExp(aclObj);
		} else {
			obj.req.soajs.log.debug("Detected new schema ACL Configuration using http methods ...");
			
			if (aclObj) {
				//check if acl has version schema
				if (!Object.hasOwnProperty.call(aclObj, 'access') &&
					!Object.hasOwnProperty.call(aclObj, 'apis') &&
					!Object.hasOwnProperty.call(aclObj, 'apisRegExp') &&
					!Object.hasOwnProperty.call(aclObj, 'apisPermission') &&
					Object.keys(aclObj).length) {
					if (obj.service_v) {
						let san_v = coreLibs.version.sanitize(obj.service_v);
						if (!aclObj[san_v]) {
							return cb(154, null);
						}
						aclObj = aclObj[san_v];
					} else {
						//try to get latest version from ACL
						if (aclObj) {
							let version = null;
							for (let v in aclObj) {
								if (Object.hasOwnProperty.call(aclObj, v)) {
									version = coreLibs.version.getLatest(version, v);
								}
							}
							if (version) {
								obj.req.soajs.controller.serviceParams.service_v = coreLibs.version.unsanitize(version);
								//if (!aclObj[version])
								//    return cb(154, null);
								aclObj = aclObj[version];
							}
						}
					}
				}
			}
			
			//ACL with method support restful
			let method = obj.req.method.toLocaleLowerCase();
			console.log("---------------------------")
			console.log(method)
			console.log(JSON.stringify(aclObj))
			console.log("---------------------------")
			console.log(aclObj[method])
			console.log("---------------------------")
			if (aclObj && aclObj[method] && typeof aclObj[method] === "object") {
				let newAclObj = {};
				if (aclObj.hasOwnProperty('access')) {
					newAclObj.access = aclObj.access;
				}
				if (aclObj[method].hasOwnProperty('apis')) {
					newAclObj.apis = aclObj[method].apis;
				}
				if (aclObj[method].hasOwnProperty('apisRegExp')) {
					newAclObj.apisRegExp = aclObj[method].apisRegExp;
				}
				if (aclObj[method].hasOwnProperty('apisPermission')) {
					newAclObj.apisPermission = aclObj[method].apisPermission;
				}
				else if (aclObj.hasOwnProperty('apisPermission')) {
					newAclObj.apisPermission = aclObj.apisPermission;
				}
				
				finalAcl = lib.apiPathParam2apiRegExp(newAclObj);
			} else {
				finalAcl = lib.apiPathParam2apiRegExp(aclObj);
			}
		}
		
		return cb(null, finalAcl);
	};
	
	return (req, res, next) => {
		if (req.soajs.controller.serviceParams.keyObj && req.soajs.controller.serviceParams.packObj) {
			aclCheck({
				"req": req,
				"keyObj": req.soajs.controller.serviceParams.keyObj,
				"packObj": req.soajs.controller.serviceParams.packObj,
				"service_v": req.soajs.controller.serviceParams.service_v
			}, (err, finalAcl) => {
				if (err) {
					return next(err);
				}
				//this is the finalACL without versions
				req.soajs.controller.serviceParams.finalAcl = finalAcl;
				
				return next();
			});
		} else {
			return next();
		}
	};
};