'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

let lib = {
	"getDriverConfiguration": (soajs, configuration, cb) => {
		if (!configuration) {
			return cb(new Error("Problem with the provided kubernetes configuration"));
		}
		if (configuration.namespace && configuration.token && configuration.url) {
			let config = {
				"namespace": configuration.namespace,
				"token": configuration.token,
				"url": configuration.url
			};
			return cb(null, config);
		} else {
			return cb(new Error("Configuration requires namespace, token, and url"));
		}
	},
	"cleanLabel": (label) => {
		if (!label) {
			return '';
		}
		return label.replace(/\//g, "__slash__");
	},
	"clearLabel": (label) => {
		if (!label) {
			return '';
		}
		return label.replace(/__slash__/g, "/");
	}
};

module.exports = lib;