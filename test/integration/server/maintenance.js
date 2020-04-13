"use strict";

const request = require('request');
const helper = require("../../helper.js");
let Controller = helper.requireModule('./server/controller');
let localConfig = helper.requireModule('./config.js');
const assert = require('assert');

describe("Unit test for: server - controller maintenance", function () {
	
	let c = new Controller({
		"serviceName": localConfig.serviceName,
		"serviceGroup": localConfig.serviceGroup,
		"serviceVersion": localConfig.serviceVersion
	});
	let registry = null;
	let log = null;
	let service = null;
	let server = null;
	let serverMaintenance = null;
	let port = 5000;
	
	before((done) => {
		c.init((_registry, _log, _service, _server, _serverMaintenance) => {
			c.start(_registry, _log, _service, _server, _serverMaintenance, () => {
				registry = _registry;
				log = _log;
				service = _service;
				server = _server;
				serverMaintenance = _serverMaintenance;
				done();
			});
		});
	});
	
	it("Maintenance - favicon.ico", (done) => {
		let route = "/favicon.ico";
		let requestOptions = {
			'method': "get",
			'uri': "http://127.0.0.1:" + port + route,
			'timeout': 1000 * 3600,
			'jar': false
		};
		request(requestOptions, (error, response) => {
			done();
		});
	});
	it("Maintenance - reloadRegistry", (done) => {
		let route = "/reloadRegistry";
		let requestOptions = {
			'method': "get",
			'uri': "http://127.0.0.1:" + port + route,
			'timeout': 1000 * 3600,
			'jar': false
		};
		request(requestOptions, (error, response) => {
			assert.ok(response.body);
			done();
		});
	});
	it("Maintenance - awarenessStat", (done) => {
		let route = "/awarenessStat";
		let requestOptions = {
			'method': "get",
			'uri': "http://127.0.0.1:" + port + route,
			'timeout': 1000 * 3600,
			'jar': false
		};
		request(requestOptions, (error, response) => {
			assert.ok(response.body);
			done();
		});
	});
	it("Maintenance - register", (done) => {
		let route = "/register";
		let requestOptions = {
			'method': "post",
			'uri': "http://127.0.0.1:" + port + route,
			'timeout': 1000 * 3600,
			"json": true
		};
		let req_qs = {};
		let req_body = {
			"name": "golangpub",
			"type": "service",
			"group": "Custom Services",
			"version": "1.2",
			"port": 4800,
			"requestTimeout": 30,
			"requestTimeoutRenewal": 5,
			"mw": true,
			"swagger": true,
			"extKeyRequired": true,
			"urac": true,
			"urac_Profile": false,
			"urac_ACL": false,
			"provision_ACL": false,
			"oauth": false,
			"ip": "127.0.0.1",
			"maintenance": {"port": {"type": "inherit"}, "readiness": "/heartbeat", "commands": null}
		};
		requestOptions.qs = req_qs;
		requestOptions.body = req_body;
		
		request(requestOptions, (error, response) => {
			assert.ok(response.body);
			assert.ok(response.body);
			
			requestOptions.qs = req_qs;
			requestOptions.body = req_body;
			requestOptions.body.version = "e.e";
			
			request(requestOptions, (error, response) => {
				assert.ok(response.body);
				
				requestOptions = {
					'method': "post",
					'uri': "http://127.0.0.1:" + port + route + "?serviceHATask=true",
					'timeout': 1000 * 3600,
					"json": true
				};
				requestOptions.qs = req_qs;
				requestOptions.body = req_body;
				
				request(requestOptions, (error, response) => {
					done();
				});
			});
		});
	});
	it("Maintenance - proxySocket", (done) => {
		let route = "/proxySocket";
		let requestOptions = {
			'method': "get",
			'uri': "http://127.0.0.1:" + port + route,
			'timeout': 1000 * 3600,
			'jar': false
		};
		request(requestOptions, (error, response) => {
			assert.ok(response.body);
			done();
		});
	});
	it("Maintenance - loadProvision", (done) => {
		let route = "/loadProvision";
		let requestOptions = {
			'method': "get",
			'uri': "http://127.0.0.1:" + port + route,
			'timeout': 1000 * 3600,
			'jar': false
		};
		request(requestOptions, (error, response) => {
			assert.ok(response.body);
			done();
		});
	});
	it("Maintenance - getRegistry", (done) => {
		let route = "/getRegistry";
		let requestOptions = {
			'method': "get",
			'uri': "http://127.0.0.1:" + port + route,
			'timeout': 1000 * 3600,
			'jar': false
		};
		request(requestOptions, (error, response) => {
			assert.ok(response.body);
			done();
		});
	});
	it("Maintenance - heartbeat", (done) => {
		let route = "/heartbeat";
		let requestOptions = {
			'method': "get",
			'uri': "http://127.0.0.1:" + port + route,
			'timeout': 1000 * 3600,
			'jar': false
		};
		request(requestOptions, (error, response) => {
			assert.ok(response.body);
			done();
		});
	});
	
	after((done) => {
		c.stop(registry, log, service, server, serverMaintenance, () => {
			done();
		});
	});
});