'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */


const infraModule = require("../../modules/driver/index.js");

module.exports = {
	getMw: function (param) {
		let driver;
		if (param.awareness) {
			if (!process.env.SOAJS_DEPLOY_HA) {
				driver = require("./custom.js");
				driver.init(param);
			}
			else {
				driver = require("./ha.js");
				infraModule.init();
				param.infraModule = infraModule;
				if (!param.doNotRebuildCache) {
					driver.init(param);
				}
			}
		}
		return function (req, res, next) {
			if (param.awareness) {
				req.soajs.awareness = {
					"getHost": driver.getServiceHost,
					"getLatestVersion": driver.getLatestVersion
				};
				if (process.env.SOAJS_DEPLOY_HA) {
					req.soajs.awareness.getLatestVersionFromCluster = driver.getLatestVersionFromCluster;
				}
			}
			next();
		};
	}
};
