'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const Controller = require("./server/controller");
const localConfig = require("./config.js");

let c = new Controller({
	"serviceName": localConfig.serviceName,
	"serviceVersion": localConfig.serviceVersion,
	"serviceGroup": localConfig.serviceGroup,
	"maintenance": localConfig.maintenance
});

function run(serviceStartCb) {
	c.init((registry, log, service, server, serverMaintenance) => {
		c.start(registry, log, service, server, serverMaintenance, serviceStartCb);
	});
}

function stop(serviceStopCb) {
	c.stop(serviceStopCb);
}

module.exports = {
	"runService": (serviceStartCb) => {
		if (serviceStartCb && typeof serviceStartCb === "function") {
			run(serviceStartCb);
		} else {
			run(null);
		}
	},
	"stopService": (serviceStopCb) => {
		if (serviceStopCb && typeof serviceStopCb === "function") {
			stop(serviceStopCb);
		} else {
			stop(null);
		}
	}
};