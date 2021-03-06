'use strict';
let service = {
	_id: "5e1f3e71c5a59210a8152626",
	type: "service",
	name: "payment",
	configuration: {
		subType: "market",
		port: 4006,
		requestTimeout: 30,
		requestTimeoutRenewal: 5,
		group: "SOAJS Core Services"
	},
	versions: [{
		"version": "1",
		maintenance: {
			port: {
				type: "maintenance"
			},
			readiness: "/heartbeat",
			commands: [
				{
					label: "Releoad Registry",
					path: "/reloadRegistry",
					icon: "registry"
				},
				{
					label: "Resource Info",
					path: "/resourceInfo",
					icon: "info"
				}
			]
		},
		apis: [
			{
				l: "Login Through Passport",
				v: "/passport/login/:strategy",
				m: "get",
				group: "Guest"
			},
			{
				l: "Login Through Passport Validate",
				v: "/passport/validate/:strategy",
				m: "get",
				group: "Guest"
			}
		],
		extKeyRequired: true,
		oauth: true,
		provision_ACL: false,
		urac: false,
		urac_ACL: false,
		urac_Profile: false
	}
	]
};
module.exports = service;