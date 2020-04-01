"use strict";

const assert = require('assert');
const helper = require("../../helper.js");
const requester = require('../requester');
let Controller = helper.requireModule('./server/controller');
let localConfig = helper.requireModule('./config.js');

let uracServers = null;
let oauthServers = null;
let ptServers = null;
let pt2Servers = null;
let uracserver = require('./urac-service-mock.js');
let oauthserver = require('./oauth-service-mock.js');
let ptserver = require('./passthrough-service-mock.js');

describe("Integration for Usecase 1", function () {
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
				uracserver.startServer({s: {port: 4001}, m: {port: 5001}, name: "URAC"}, function (servers) {
					uracServers = servers;
				});
				oauthserver.startServer({s: {port: 4004}, m: {port: 5004}, name: "OAUTH"}, function (servers) {
					oauthServers = servers;
				});
				ptserver.startServer({s: {port: 4002}, m: {port: 5002}, name: "PT"}, function (servers) {
					ptServers = servers;
				});
				ptserver.startServer({s: {port: 4003}, m: {port: 5003}, name: "PT2"}, function (servers) {
					pt2Servers = servers;
				});
				setTimeout(function () {
					done();
				}, 5000);
			});
		});
	});
	
	it("Get permissions - no logged in user", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/soajs/acl',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			}
		};
		requester('get', options, (error, body) => {
			assert.ok(body);
			assert.strictEqual(body.result, false);
			assert.deepStrictEqual(body.errors.codes, [158]);
			done();
		});
	});
	it("Get permissions - with logged in user", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/soajs/acl',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			},
			qs: {
				access_token: "cfb209a91b23896820f510aadbf1f4284b512123"
			}
		};
		requester('get', options, (error, body) => {
			assert.ok(body.acl);
			done();
		});
	});
	
	it("fail - Access Forbidden to requested environment (invalid), error 137", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/soajs/proxy',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			},
			"qs": {
				"proxyRoute": encodeURIComponent("/urac/getUser"),
				"__env": "invalid",
				access_token: "cfb209a91b23896820f510aadbf1f4284b512123"
			}
		};
		requester('get', options, (error, body) => {
			assert.ifError(error);
			assert.ok(body);
			assert.strictEqual(body.result, false);
			assert.ok(body.errors);
			done();
		});
	});
	it("fail - missing registry configuration, error 208 ", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/soajs/proxy',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			},
			"qs": {
				"proxyRoute": encodeURIComponent("/urac/getUser"),
				"__env": "stg",
				access_token: "cfb209a91b23896820f510aadbf1f4284b512123"
			}
		};
		requester('get', options, (error, body) => {
			assert.ok(body);
			assert.strictEqual(body.result, false);
			assert.deepStrictEqual(body.errors.codes, [208]);
			done();
		});
	});
	
	it("fail - Access Forbidden to requested environment (invalid), error 137", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/soajs/proxy',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			},
			"qs": {
				"proxyRoute": encodeURIComponent("/urac/getUser"),
				"__env": "dev",
				access_token: "cfb209a91b23896820f510aadbf1f4284b512123"
			}
		};
		requester('get', options, (error, body) => {
			assert.ok(body);
			assert.strictEqual(body.result, false);
			assert.deepStrictEqual(body.errors.codes, [135]);
			done();
		});
	});
	it("Proxy - valid full URI", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/soajs/proxy',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			},
			"qs": {
				"proxyRoute": encodeURIComponent("http://127.0.0.1:4002/CheckPhoneNumber"),
				access_token: "cfb209a91b23896820f510aadbf1f4284b512123"
			}
		};
		requester('get', options, (error, body) => {
			assert.ok(body);
			assert.equal(body.data.type, "endpoint");
			done();
		});
	});
	it("Proxy - invalid URI", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/soajs/proxy',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			},
			"qs": {
				"proxyRoute": encodeURIComponent("null://api.:null/CheckPhoneNumber"),
				access_token: "cfb209a91b23896820f510aadbf1f4284b512123"
			}
		};
		requester('get', options, (error, body) => {
			assert.ok(body);
			assert.strictEqual(body.result, false);
			assert.deepStrictEqual(body.errors.codes, [135]);
			done();
		});
	});
	
	it("Urac - user", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/urac/user',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			}
		};
		requester('get', options, (error, body) => {
			assert.deepStrictEqual(body, {
				result: true,
				data: {firstname: 'antoine', lastname: 'hage'}
			});
			done();
		});
	});
	it("oAuth - passport", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/oauth/passport/login',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			},
			"qs": {
				access_token: "cfb209a91b23896820f510aadbf1f4284b512123"
			}
		};
		requester('get', options, (error, body) => {
			assert.deepStrictEqual(body, {
				result: true,
				data: {firstname: 'antoine', lastname: 'hage'}
			});
			done();
		});
	});
	it("Urac - muser without access_token", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/urac/muser:12',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			}
		};
		requester('get', options, (error, body) => {
			assert.ok(body);
			assert.strictEqual(body.result, false);
			assert.deepStrictEqual(body.errors.codes, [400]);
			done();
		});
	});
	it("Urac - muser with access_token", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/urac/muser/:12',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			},
			"qs": {
				access_token: "cfb209a91b23896820f510aadbf1f4284b512123"
			}
		};
		requester('get', options, (error, body) => {
			assert.equal(body.data.id, '/muser/:12?access_token=cfb209a91b23896820f510aadbf1f4284b512123');
			done();
		});
	});
	it("Urac - luser", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/urac/luser',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			}
		};
		requester('get', options, (error, body) => {
			assert.deepStrictEqual(body, {
				result: true,
				data: {firstname: 'antoine', lastname: 'hage'}
			});
			done();
		});
	});
	it("Urac - private", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/urac/private',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			},
			"qs": {
				access_token: "cfb209a91b23896820f510aadbf1f4284b512123"
			}
		};
		requester('get', options, (error, body) => {
			assert.ok(body);
			assert.strictEqual(body.result, false);
			assert.deepStrictEqual(body.errors.codes, [159]);
			done();
		});
	});
	
	it("PT - enpoint", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/pt/CheckPhoneNumber',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			},
			"qs": {
				access_token: "cfb209a91b23896820f510aadbf1f4284b512123"
			}
		};
		requester('get', options, (error, body) => {
			assert.ok(body);
			assert.equal(body.data.type, "endpoint");
			done();
		});
	});
	
	it("PT2 - endpoint service not in acl", function (done) {
		let options = {
			uri: 'http://127.0.0.1:' + localConfig.servicePort + '/pt2/CheckPhoneNumber',
			headers: {
				'Content-Type': 'application/json',
				key: extKey
			},
			"qs": {
				access_token: "cfb209a91b23896820f510aadbf1f4284b512123"
			}
		};
		requester('get', options, (error, body) => {
			assert.ok(body);
			assert.strictEqual(body.result, false);
			assert.deepStrictEqual(body.errors.codes, [154]);
			done();
		});
	});
	
	after((done) => {
		c.stop(registry, log, service, server, serverMaintenance, () => {
			uracserver.killServer(uracServers);
			oauthserver.killServer(oauthServers);
			ptserver.killServer(ptServers);
			ptserver.killServer(pt2Servers);
			done();
		});
	});
});