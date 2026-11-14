'use strict';

//NOTE: answers with the soajsinjectobj it receives
let service = {
	_id: "6b1e0000000000000000e002",
	"type": "service",
	name: "echokey",
	configuration: {
		group: "SOAJS test",
		port: 4017,
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
			extKeyRequired: true,
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
