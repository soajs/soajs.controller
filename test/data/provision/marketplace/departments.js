'use strict';

let service = {
	_id: "5da078c92357684b57effcf0",
	"type": "service",
	name: "departments",
	configuration: {
		group: "SOAJS test",
		port: 4013,
		requestTimeout: 30,
		requestTimeoutRenewal: 5
	},
	versions: [{
		"version": "1",
		maintenance: {
			"port": {
				"type": "maintenance"
			},
			"readiness": "/heartbeat"
		},
		oauth: true,
		extKeyRequired: true,
		urac: false,
		urac_Profile: false,
		urac_ACL: false,
		provision_ACL: false,
		apis: [
			{
				l: "Tenant access resolver",
				v: "/tenant/access",
				m: "post",
				group: "Integration test"
			}
		]
	}
	]
};
module.exports = service;
