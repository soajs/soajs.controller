'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

let param = null;
const coreModules = require("soajs.core.modules");
let core = coreModules.core;

let regEnvironment = (process.env.SOAJS_ENV || "dev");
regEnvironment = regEnvironment.toLowerCase();

let ha = {
	"init": function (_param) {
		param = _param;
	},
	"getControllerEnvHost": function () {
		let serviceName, version, env, cb;
		cb = arguments[arguments.length - 1];
		
		switch (arguments.length) {
			//dash, cb
			case 2:
				env = arguments[0];
				break;
			case 3:
				//1, dash, cb
				version = arguments[0];
				env = arguments[1];
				break;
			case 4:
				//controller, 1, dash, cb
				version = arguments[1];
				env = arguments[2];
				break;
		}
		
		env = env || regEnvironment;
		serviceName = param.serviceName;
		if (process.env.SOAJS_DEPLOY_HA === 'kubernetes') {
			serviceName += "-v1-service";
		}
		
		let info = core.registry.get().deployer.selected.split('.');
		let deployerConfig = core.registry.get().deployer.container[info[1]][info[2]];
		let namespace = '';
		if (deployerConfig && deployerConfig.namespace && deployerConfig.namespace.default) {
			namespace = '.' + deployerConfig.namespace.default;
			if (deployerConfig.namespace.perService) {
				namespace += '-' + env + '-controller-v1';
			}
		}
		
		return cb(env + "-" + serviceName + namespace);
	}
};

module.exports = ha;
