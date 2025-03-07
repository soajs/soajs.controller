"use strict";

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const fs = require('fs');
let regFile = (process.env.SOAJS_PROFILE || __dirname + "/../../profiles/solo.js");

module.exports = {
	"init": function () {
	},
	"loadData": function (dbConfiguration, envCode, param, callback) {
		let error = null;
		if (fs.existsSync(regFile)) {
			delete require.cache[require.resolve(regFile)];
			let regFileObj = require(regFile);
			if (regFileObj && typeof regFileObj === 'object' && !(Object.keys(regFileObj).length === 0 && regFileObj.constructor === Object)) {
				let obj = {};
				obj.ENV_schema = regFileObj;
				return callback(null, obj);
			} else {
				error = new Error('Invalid profile file: ' + regFile);
			}
		}
		else {
			error = new Error('Invalid profile path: ' + regFile);
		}
		return callback(error, null);
	},
	"registerNewService": function (dbConfiguration, serviceObj, collection, cb) {
		return cb(null);
	},
	"addUpdateServiceIP": function (dbConfiguration, hostObj, cb) {
		return cb(null, true);
	},
	"loadOtherEnvHosts": function (param, cb) {
		let obj = {};
		return cb(null, obj);
	},
	"loadProfile": function (envFrom, cb) {
		let regFileObj = {};
		let registry = {
			"timeLoaded": new Date().getTime(),
			"name": envFrom,
			"environment": envFrom,
			"profileOnly": true,
			"coreDB": {
				"provision": regFileObj
			}
		};
		return cb(null, registry);
	},
	"getAllEnvironments": function (cb) {
		let obj = {};
		return cb(null, obj);
	},
	"addUpdateEnvControllers": function (param, cb) {
		return cb(null);
	}
};