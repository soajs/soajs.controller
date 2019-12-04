'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

module.exports = () => {
	return (req, res, next) => {
		let soajsroaming = req.get("soajsroaming");
		if (soajsroaming) {
			if (req.soajs.registry &&
				req.soajs.registry.custom &&
				req.soajs.registry.custom.oauth &&
				req.soajs.registry.custom.oauth.value &&
				req.soajs.registry.custom.oauth.value.roaming) {
				let roamingConfig = req.soajs.registry.custom.oauth.value.roaming;
				if (roamingConfig.services && roamingConfig.services[req.soajs.controller.serviceParams.name]) {
					let serviceRoamingConfig = roamingConfig.services[req.soajs.controller.serviceParams.name];
					let clientIp = req.getClientIP();
					let whitelistips = serviceRoamingConfig.whitelistips;
					if (whitelistips && Array.isArray(whitelistips) && whitelistips.includes(clientIp)) {
						let response = {
							"headObj": {"soajsinjectobj": req.headers.soajsinjectobj},
							result: true,
							data: true
						};
						return req.soajs.controllerResponse(response);
					} else {
						req.soajs.log.debug("Detected soajsroaming but ip[" + clientIp + "] not whitelistips for service[" + req.soajs.controller.serviceParams.name + "] under custom registry oauth.roaming.services ...");
					}
				} else {
					req.soajs.log.debug("Detected soajsroaming but unable to find service[" + req.soajs.controller.serviceParams.name + "] under custom registry oauth.roaming.services ...");
				}
			} else {
				req.soajs.log.debug("Detected soajsroaming but unable to find oauth.roaming under custom registry ...");
			}
			return next(165);
		}
		return next();
	};
};