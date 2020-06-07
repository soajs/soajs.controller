'use strict';

let service = {
	_id: "5ca77e1795590ea347d88e77",
	type: "endpoint",
	name: "pt",
	src: {
		provider: "apibuilder",
		urls: [
			{
				version: "1",
				url: "http://localhost:4002"
			}
		]
	},
	configuration: {
		epId: "5ca707ed5f868378d5f7f5f5",
		group: "tony",
		port: 4002,
		requestTimeout: 30,
		requestTimeoutRenewal: 5
	},
	versions: [{
		version: "1",
		maintenance: {
			port: {
				type: "custom",
				value: 5002
			},
			readiness: "/heartbeat"
		},
		oauth: false,
		extKeyRequired: false,
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