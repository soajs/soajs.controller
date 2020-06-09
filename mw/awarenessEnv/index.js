'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */


module.exports = {
	getMw: function (param) {
		let driver = null;
		if (param.awarenessEnv) {
			if (!process.env.SOAJS_DEPLOY_HA) {
				driver = require("./custom.js");
				driver.init(param);
			} else {
				driver = require("./ha.js");
				driver.init(param);
			}
		}
		return (req, res, next) => {
			if (param.awarenessEnv) {
				req.soajs.awarenessEnv = {
					"getHost": driver.getControllerEnvHost
				};
			}
			next();
		};
	}
};