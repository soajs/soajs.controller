'use strict';

let service = {
	_id: "5da078c92357684b57effcf4",
	"type": "service",
	name: "spaces",
	configuration: {
		group: "SOAJS test",
		port: 4015,
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
		urac: true,
		urac_Profile: false,
		urac_ACL: false,
		provision_ACL: false,
		apis: [
			{ l: "Spaces of the user", v: "/spaces", m: "get", group: "Integration test" },
			{ l: "One space", v: "/space/:id", m: "get", group: "Integration test" },
			{ l: "Spaces after a delay", v: "/slow", m: "get", group: "Integration test" },
			{ l: "Same for the whole tenant", v: "/catalog", m: "get", group: "Integration test" }
		]
	}
	]
};
module.exports = service;
