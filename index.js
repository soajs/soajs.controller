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
let serviceStartCb = null;
let c = new Controller({
	"serviceName": localConfig.serviceName,
	"serviceVersion": localConfig.serviceVersion,
	"serviceGroup": localConfig.serviceGroup
});
c.init((registry, log, service, server, serverMaintenance) => {
	c.start(registry, log, service, server, serverMaintenance, () => {
		if (serviceStartCb) {
			serviceStartCb();
		}
	});
});

module.exports = function (cb) {
	serviceStartCb = cb;
};