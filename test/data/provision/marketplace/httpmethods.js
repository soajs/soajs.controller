'use strict';

let service = {
	_id: "5da078c92357684b57effced",
	"type": "service",
	name: "httpmethods",
	configuration: {
		group: "SOAJS test",
		port: 4010,
		requestTimeout: 30,
		requestTimeoutRenewal: 5
	},
	versions: [{
		"version": "1",
		maintenance: {
			"port": {
				"type": "maintenance"
			},
			"readiness": "/heartbeat",
			"commands": [
				{
					"label": "My Command",
					"path": "/wrench",
					"icon": "wrench"
				}
			]
		},
		oauth: true,
		extKeyRequired: true,
		urac: true,
		urac_Profile: false,
		urac_ACL: false,
		provision_ACL: false,
		apis: [
			{
				l: "Route to test get",
				v: "/myroute",
				m: "get",
				group: "Integration test"
			},
			{
				l: "Route to test post",
				v: "/myroute",
				m: "post",
				group: "Integration test"
			},
			{
				l: "Route to test put",
				v: "/myroute",
				m: "put",
				group: "Integration test"
			},
			{
				l: "Route to test delete",
				v: "/myroute",
				m: "delete",
				group: "Integration test"
			},
			{
				l: "Route to test patch",
				v: "/myroute",
				m: "patch",
				group: "Integration test"
			},
			{
				l: "Route to test head",
				v: "/myroute",
				m: "head",
				group: "Integration test"
			},
			{
				l: "Route to test other",
				v: "/myroute",
				m: "options",
				group: "Integration test"
			}
		]
	}
	]
};
module.exports = service;