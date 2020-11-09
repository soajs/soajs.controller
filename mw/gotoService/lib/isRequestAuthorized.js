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
 * @param req
 * @param requestOptions
 * @returns {boolean}
 */
module.exports = (req, core, requestOptions) => {
	requestOptions.headers.cookie = requestOptions.headers.cookie || '';
	let cookies = requestOptions.headers.cookie.split(';');
	cookies.some(function (cookie) {
		if (cookie.indexOf(req.soajs.registry.serviceConfig.session.name) !== -1) {
			return true;
		}
	});
	
	let soajsauth = (req.headers && req.headers.soajsauth);
	if (!soajsauth) {
		//try {
			let parsedUrl = req.soajs.controller.serviceParams.parsedUrl;
			soajsauth = parsedUrl && parsedUrl.query && parsedUrl.query.soajsauth;
		// } catch (e) {
		// 	return false;
		// }
	}
	if (soajsauth) {
		let ccc = core.security.authorization.setCookie(soajsauth, req.soajs.registry.serviceConfig.session.secret, req.soajs.registry.serviceConfig.session.name);
		if (ccc) {
			cookies.push(ccc);
			requestOptions.headers.cookie = cookies.join(';');
			return true;
		}
	}
	return false;
};
