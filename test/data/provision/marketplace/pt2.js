'use strict';

let service = {
	_id: "5cfb06782ac09278709d0142",
	type: "endpoint",
	name: "pt2",
	configuration: {
		epId: "5ca707ed5f868378d5f7f5f5",
		group: "tony",
		port: 4003,
		requestTimeout: 30,
		requestTimeoutRenewal: 5
	},
	src: {
		provider: "endpoint",
		urls: [
			{
				version: "1",
				url: "http://localhost:4003"
			}
		]
	},
	versions: [{
		"version": "1",
		maintenance: {
			port: {
				type: "custom",
				value: 5003
			},
			readiness: "/heartbeat"
		},
		oauth: true,
		extKeyRequired: true,
		urac: false,
		urac_Profile: false,
		urac_ACL: false,
		provision_ACL: false,
		apis: [
			{
				l: "Check phone number",
				v: "/CheckPhoneNumber",
				m: "get",
				group: "product"
			}
		]
	}]
};
module.exports = service;