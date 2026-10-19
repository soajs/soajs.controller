'use strict';

let service = {
	_id: "5da078c92357684b57effcf2",
	"type": "service",
	name: "idempotent",
	configuration: {
		group: "SOAJS test",
		port: 4014,
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
			{ l: "Answers 200", v: "/ok", m: "post", group: "Integration test" },
			{ l: "Answers 503 the first time", v: "/fail", m: "post", group: "Integration test" },
			{ l: "Answers 400", v: "/bad", m: "post", group: "Integration test" },
			{ l: "Answers 200 after a delay", v: "/slow", m: "post", group: "Integration test" },
			{ l: "Answers 200, throttled", v: "/throttled", m: "post", group: "Integration test" }
		]
	}
	]
};
module.exports = service;
