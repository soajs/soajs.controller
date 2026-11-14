'use strict';

//NOTE: answers with the soajsinjectobj it receives
let service = {
	_id: "6b1e0000000000000000e001",
	"type": "service",
	name: "echo",
	configuration: {
		group: "SOAJS test",
		port: 4016,
		requestTimeout: 30,
		requestTimeoutRenewal: 5
	},
	versions: [
		{
			"version": "1",
			maintenance: {
				"port": {
					"type": "maintenance"
				},
				"readiness": "/heartbeat"
			},
			oauth: false,
			extKeyRequired: false,
			urac: false,
			urac_Profile: false,
			urac_ACL: false,
			provision_ACL: false,
			apis: [
				{
					l: "Echo the inject header",
					v: "/headers",
					m: "get",
					group: "Echo"
				}
			]
		}
	]
};
module.exports = service;
