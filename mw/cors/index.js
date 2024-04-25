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
 * @returns {Function}
 */
module.exports = () => {
	return (req, res, next) => {
		if (req.soajs && req.soajs.registry && req.soajs.registry.serviceConfig && req.soajs.registry.serviceConfig.cors && req.soajs.registry.serviceConfig.cors.enabled) {
			let method = req.method && req.method.toUpperCase && req.method.toUpperCase();
			let origin = req.soajs.registry.serviceConfig.cors.origin || '*';
			let credentials = req.soajs.registry.serviceConfig.cors.credentials || 'true';
			let methods = req.soajs.registry.serviceConfig.cors.methods || 'GET,HEAD,PUT,PATCH,POST,DELETE';
			let headers = req.soajs.registry.serviceConfig.cors.headers || '__env,key,soajsauth,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type';
			let maxage = req.soajs.registry.serviceConfig.cors.maxage || 1728000;
			
			if (method === 'OPTIONS') {
				res.setHeader('Access-Control-Allow-Origin', origin);
				res.setHeader('Access-Control-Allow-Credentials', credentials);
				res.setHeader('Access-Control-Allow-Methods', methods);
				res.setHeader('Access-Control-Allow-Headers', headers);
				res.setHeader('Access-Control-Max-Age', maxage);
				res.setHeader('Access-Control-Expose-Headers', headers);
				
				res.statusCode = 204;
				res.end();
			} else {
				res.setHeader('Access-Control-Allow-Origin', origin);
				res.setHeader('Access-Control-Allow-Credentials', credentials);
				res.setHeader('Access-Control-Expose-Headers', headers);
				return next();
			}
		} else {
			return next();
		}
	};
};
