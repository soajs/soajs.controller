"use strict";

const assert = require('assert');
const helper = require("../../helper.js");
const requester = require('../requester');
let Controller = helper.requireModule('./server/controller');
let localConfig = helper.requireModule('./config.js');

let mockServers = null;
let mock = require('./service-mock/index.js');

describe("Integration for Usecase 2", function () {
	let extKey = "3d90163cf9d6b3076ad26aa5ed58556348069258e5c6c941ee0f18448b570ad1c5c790e2d2a1989680c55f4904e2005ff5f8e71606e4aa641e67882f4210ebbc5460ff305dcb36e6ec2a2299cf0448ef60b9e38f41950ec251c1cf41f05f3ce9";
	
	let c = new Controller({
		"serviceName": localConfig.serviceName,
		"serviceVersion": localConfig.serviceVersion,
		"serviceGroup": localConfig.serviceGroup
	});
	let registry = null;
	let log = null;
	let service = null;
	let server = null;
	let serverMaintenance = null;
	
	before((done) => {
		c.init((_registry, _log, _service, _server, _serverMaintenance) => {
			registry = _registry;
			log = _log;
			service = _service;
			server = _server;
			serverMaintenance = _serverMaintenance;
			c.start(registry, log, service, server, serverMaintenance, () => {
				
				mock.startServer(null, function (servers) {
					mockServers = servers;
				});
				setTimeout(function () {
					done();
				}, 5000);
			});
		});
	});
	
	it("Test get method", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/httpmethods/myroute',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			},
			"qs": {
				access_token: "cfb209a91b23896820f510aadbf1f4284b512123"
			}
		};
		requester('get', options, (error, body) => {
			assert.ifError(error);
			assert.ok(body);
			assert.deepEqual(body.data.method, 'GET');
			assert.deepEqual(body.data.url, '/myroute?access_token=cfb209a91b23896820f510aadbf1f4284b512123');
			done();
		});
	});
	it("Test post method", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/httpmethods/myroute',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			},
			"qs": {
				access_token: "cfb209a91b23896820f510aadbf1f4284b512123"
			}
		};
		requester('post', options, (error, body) => {
			assert.ifError(error);
			assert.ok(body);
			assert.deepEqual(body.data.method, 'POST');
			assert.deepEqual(body.data.url, '/myroute?access_token=cfb209a91b23896820f510aadbf1f4284b512123');
			done();
		});
	});
	it("Test put method", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/httpmethods/myroute',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			},
			"qs": {
				access_token: "cfb209a91b23896820f510aadbf1f4284b512123"
			}
		};
		requester('put', options, (error, body) => {
			assert.ifError(error);
			assert.ok(body);
			assert.deepEqual(body.data.method, 'PUT');
			assert.deepEqual(body.data.url, '/myroute?access_token=cfb209a91b23896820f510aadbf1f4284b512123');
			done();
		});
	});
	it("Test delete method", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/httpmethods/myroute',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			},
			"qs": {
				access_token: "cfb209a91b23896820f510aadbf1f4284b512123"
			}
		};
		requester('delete', options, (error, body) => {
			assert.ifError(error);
			assert.ok(body);
			assert.deepEqual(body.data.method, 'DELETE');
			assert.deepEqual(body.data.url, '/myroute?access_token=cfb209a91b23896820f510aadbf1f4284b512123');
			done();
		});
	});
	it("Test patch method", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/httpmethods/myroute',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			},
			"qs": {
				access_token: "cfb209a91b23896820f510aadbf1f4284b512123"
			}
		};
		requester('patch', options, (error, body) => {
			assert.ifError(error);
			assert.ok(body);
			assert.deepEqual(body.data.method, 'PATCH');
			assert.deepEqual(body.data.url, '/myroute?access_token=cfb209a91b23896820f510aadbf1f4284b512123');
			done();
		});
	});
	it("Test head method", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/httpmethods/myroute',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			},
			"qs": {
				access_token: "cfb209a91b23896820f510aadbf1f4284b512123"
			}
		};
		requester('head', options, (error, headers) => {
			assert.ifError(error);
			assert.ok(headers);
			assert.ok(headers["content-length"]);
			assert.deepEqual(headers['content-type'], 'application/json; charset=utf-8');
			done();
		});
	});
	it("Test other method", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/httpmethods/myroute',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			},
			"qs": {
				access_token: "cfb209a91b23896820f510aadbf1f4284b512123"
			}
		};
		requester('options', options, (error, headers) => {
			assert.ifError(error);
			assert.ok(headers);
			assert.ok(headers['access-control-allow-methods']);
			assert.deepEqual(headers['access-control-allow-methods'], 'GET,HEAD,PUT,PATCH,POST,DELETE');
			assert.ok(headers['access-control-allow-headers']);
			done();
		});
	});
	
	after((done) => {
		c.stop(registry, log, service, server, serverMaintenance, () => {
			mock.killServer(mockServers);
			done();
		});
	});
});