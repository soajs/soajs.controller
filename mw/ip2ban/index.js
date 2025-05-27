'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */


const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);

/**
 *
 * @param configuration
 * @returns {Function}
 */

	// let customRegistry.gateway = {
	// 	"traffic": {
	// 		"ip2ban": [
	// 			"::1"
	// 		],
	// 		"model": "mongo",
	// 		"throttling": {
	// 			"oauth": {
	// 				"publicAPIStrategy": "test",
	// 				"apis": [
	// 					"/token"
	// 				]
	// 			}
	// 		}
	// 	},
	// };
module.exports = function () {

	return (req, res, next) => {

		let ip2ban = get(["soajs", "registry", "custom", "gateway", "value", "traffic", "ip2ban"], req);
		let clientIP = req.getClientIP();

		if (ip2ban && Array.isArray(ip2ban) && ip2ban.includes(clientIP)) {
			req.soajs.controllerResponse({
				'status': 403,
				'msg': 'banned'
			});
			return;
		}
		return next();
	};
};
