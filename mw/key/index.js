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
 * @param {object} configuration {provision,regEnvironment}
 * @returns {Function}
 */
module.exports = (configuration) => {
	
	return (req, res, next) => {
		let key = req.get("key");
		if (key) {
			configuration.provision.getExternalKeyData(key, req.soajs.registry.serviceConfig.key, function (err, keyObj) {
				if (err) {
					req.soajs.log.error(err);
					return next();
				}
				if (!keyObj) {
					return next(148);
				}
				req.soajs.controller.serviceParams.keyObj = keyObj;
				if (keyObj && keyObj.application && keyObj.application.package) {
					if (keyObj.env) {
						let keyEnv = keyObj.env.toLowerCase();
						if (keyEnv !== configuration.regEnvironment) {
							return next(144);
						}
					}
					configuration.provision.getPackageData(keyObj.application.package, function (err, packObj) {
						if (err) {
							return next();
						}
						if (!packObj) {
							return next(149);
						}
						req.soajs.controller.serviceParams.packObj = packObj;
						
						return next();
					});
				}
				else {
					return next();
				}
			});
		}
		else {
			next();
		}
	};
};