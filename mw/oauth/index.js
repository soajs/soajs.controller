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
//NOTE: the token env is stamped the same way at soajs.core/provision/mongo.js, so the
//		restrictedTo env constraint is compared against the identical expression.
let regEnvironment = (process.env.SOAJS_ENV || "dev").toLowerCase();

module.exports = (configuration) => {
	
	configuration.soajs.oauthService = configuration.soajs.param.oauthService || {};
	configuration.soajs.oauthService.name = configuration.soajs.oauthService.name || "oauth";
	configuration.soajs.oauthService.tokenApi = configuration.soajs.oauthService.tokenApi || "/token";
	configuration.soajs.oauthService.authorizationApi = configuration.soajs.oauthService.authorizationApi || "/authorization";
	configuration.soajs.oauthService.pinApi = configuration.soajs.oauthService.pinApi || "/pin";
	
	
	let oauthserver = require('oauth2-server');
	let oauthObj = oauthserver({
		model: configuration.model,
		grants: configuration.serviceConfig.oauth.grants,
		debug: configuration.serviceConfig.oauth.debug,
		accessTokenLifetime: configuration.serviceConfig.oauth.accessTokenLifetime,
		refreshTokenLifetime: configuration.serviceConfig.oauth.refreshTokenLifetime
	});
	
	let jwt = require('jsonwebtoken');

	/**
	 * The deviceId check is on unless it is explicitly turned off at the custom registry.
	 * Anything other than false leaves it on.
	 *
	 * req.soajs.registry.custom.gateway.value.oauth
	 * {
		  "oauth": {
			"deviceIdCheck": false
		  }
		}
	 *
	 * @param req
	 * @returns {boolean} true when the check is turned on
	 */
	let deviceIdCheckOn = (req) => {
		if (req.soajs.registry &&
			req.soajs.registry.custom &&
			req.soajs.registry.custom.gateway &&
			req.soajs.registry.custom.gateway.value &&
			req.soajs.registry.custom.gateway.value.oauth &&
			req.soajs.registry.custom.gateway.value.oauth.deviceIdCheck === false) {
			return false;
		}
		return true;
	};

	/**
	 * Matches the deviceId on the access token record against the device-id header.
	 *
	 * NOTE: we cannot check for agent, mobile is sending the build number
	 *       (ie: "democav/142 CFNetwork/3826.400.120 Darwin/24.3.0") which changes on every build.
	 *       we check deviceId instead. tokens with no deviceId (created before deviceId was
	 *       introduced, or by a client that does not send the header) are not checked, they get
	 *       checked once the client logs in again.
	 *
	 * @param req
	 * @returns {boolean} true when the request is allowed to proceed
	 */
	let deviceIdMatch = (req) => {
		if (!deviceIdCheckOn(req)) {
			return true;
		}
		if (!req.oauth || !req.oauth.bearerToken || !req.oauth.bearerToken.user || !req.oauth.bearerToken.user.deviceId) {
			return true;
		}
		return req.oauth.bearerToken.user.deviceId === req.get('device-id');
	};

	/**
	 * Matches one constraint, a string or an array of strings, against the request value.
	 *
	 * @param allowed {String|Array} what the token allows
	 * @param actual {String} what the request carries
	 * @param ignoreCase {Boolean} used for env, where the registry casing is not guaranteed
	 * @returns {boolean} true when the request value is allowed
	 */
	let valueMatch = (allowed, actual, ignoreCase) => {
		if (!actual) {
			return false;
		}
		if (ignoreCase) {
			let lower = actual.toLowerCase();
			if (Array.isArray(allowed)) {
				return allowed.some((one) => {
					return one && one.toLowerCase() === lower;
				});
			}
			return !!allowed && allowed.toLowerCase() === lower;
		}
		if (Array.isArray(allowed)) {
			return allowed.includes(actual);
		}
		return allowed === actual;
	};

	/**
	 * Enforces the restrictedTo object carried on the access token record.
	 *
	 * NOTE: only the keys present on restrictedTo are checked, a token with no restrictedTo is
	 *		not checked at all. that is the opt in, there is no registry switch, a restriction
	 *		written on a token is always enforced.
	 *
	 * NOTE: it fails closed. a restricted token reaching a service with extKeyRequired off has
	 *		no key to be compared against, it must not gain access that way.
	 *
	 * @param req
	 * @returns {boolean} true when the request is allowed to proceed
	 */
	let restrictedToMatch = (req) => {
		if (!req.oauth || !req.oauth.bearerToken || !req.oauth.bearerToken.user || !req.oauth.bearerToken.user.restrictedTo) {
			return true;
		}
		let restrictedTo = req.oauth.bearerToken.user.restrictedTo;

		if (!req.soajs.tenant || !req.soajs.tenant.application) {
			req.soajs.log.debug("Access denied, restricted token on a request with no key");
			return false;
		}

		let actual = {
			"tenant": req.soajs.tenant.id,
			"product": req.soajs.tenant.application.product,
			"package": req.soajs.tenant.application.package,
			"key": req.soajs.tenant.key ? req.soajs.tenant.key.eKey : null,
			"env": regEnvironment,
			"agent": req.get('user-agent')
		};

		for (let field in actual) {
			if (Object.hasOwnProperty.call(actual, field) && restrictedTo[field]) {
				if (!valueMatch(restrictedTo[field], actual[field], "env" === field)) {
					req.soajs.log.debug("Access denied, token restriction mismatch on [" + field + "]");
					return false;
				}
			}
		}
		return true;
	};

	return (req, res, next) => {

		let oauthType = 2;
		let tenantOauth = req.soajs.tenantOauth;
		if (tenantOauth && Object.hasOwnProperty.call(tenantOauth, 'type')) {
			oauthType = tenantOauth.type;
		} else if (Object.hasOwnProperty.call(req.soajs.registry.serviceConfig.oauth, 'type')) {
			oauthType = req.soajs.registry.serviceConfig.oauth.type;
		}
		
		//0=oauth0, 2=oauth2
		if (2 === oauthType) {
			//NOTE: authorise() sets req.oauth.bearerToken to the token record it fetched from the
			//		model, the deviceId check is done on it here to avoid fetching the token again.
			oauthObj.authorise()(req, res, (error) => {
				if (error) {
					return next(error);
				}
				if (!deviceIdMatch(req)) {
					req.soajs.log.debug("Access denied, deviceId mismatch [deviceId: " + req.get('device-id') + "]");
					return next(156);
				}
				if (!restrictedToMatch(req)) {
					return next(147);
				}
				return next();
			});
		} else {
			let algorithms = req.soajs.registry.serviceConfig.oauth.algorithms || ["HS256"];
			let audience = req.soajs.registry.serviceConfig.oauth.audience || "";
			let secret = tenantOauth.secret || req.soajs.registry.serviceConfig.oauth.secret;
			let headerToken = req.get('Authorization');
			if (headerToken) {
				let matches = headerToken.match(/Bearer\s(\S+)/);
				
				if (!matches) {
					return next(143);
				}
				headerToken = matches[1];
				jwt.verify(headerToken, secret, {
					algorithms: algorithms,
					audience: audience
				}, (error, decoded) => {
					if (error) {
						next(143);
					} else {
						req.oauth = {
							bearerToken: decoded,
							type: oauthType
						};
						next();
					}
				});
			} else {
				next(143);
			}
		}
	};
};
