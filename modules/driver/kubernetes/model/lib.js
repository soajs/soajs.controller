'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const registryModule = require("./../../../registry/index.js");
const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);

let lib = {
	"getDriverConfiguration": (soajs, configuration, cb) => {
		if (!configuration) {
			return cb(new Error("Problem with the provided kubernetes configuration"));
		}
		if (configuration.env) {
			//get env registry, this must loadByEnv
			registryModule.loadByEnv({envCode: configuration.env}, (err, envRecord) => {
				if (err) {
					soajs.log.error(err.message);
					return cb(new Error("loadByEnv error. Unable to find healthy configuration in registry"));
				}
				if (!envRecord) {
					return cb(new Error("loadByEnv empty. Unable to find healthy configuration in registry"));
				}
				let registry = envRecord;
				let depType = get(["deployer", "type"], registry);
				let regConf = null;
				if (depType === "container") {
					let depSeleted = get(["deployer", "selected"], registry);
					if (depSeleted && depSeleted.includes("kubernetes")) {
						regConf = get(["deployer"].concat(depSeleted.split(".")), registry);
					}
				}
				if (regConf) {
					let protocol = regConf.configuration.protocol || "https";
					let port = regConf.configuration.port ? ":" + regConf.configuration.port : "";
					let config = {
						"namespace": regConf.namespace,
						"token": regConf.configuration.token,
						"url": protocol + "://" + regConf.configuration.url + port
					};
					return cb(null, config);
				} else {
					return cb(new Error("Unable to find healthy configuration in registry"));
				}
			});
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