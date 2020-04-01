"use strict";

const helper = require("../../helper.js");
let localConfig = helper.requireModule('./config.js');
let Controller = helper.requireModule('./server/controller');

describe("Unit test for: server - controller", function () {
	
	it("Create controller server", function (done) {
		let c = new Controller({
			"serviceName": localConfig.serviceName,
			"serviceVersion": localConfig.serviceVersion,
			"serviceGroup": localConfig.serviceGroup
		});
		c.init((registry, log, service, server, serverMaintenance) => {
			c.start(registry, log, service, server, serverMaintenance, () => {
				c.stop(registry, log, service, server, serverMaintenance, () => {
					done();
				});
			});
		});
	});
});