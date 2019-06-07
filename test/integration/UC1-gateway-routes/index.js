"use strict";

const assert = require('assert');
const helper = require("../../helper.js");
let Controller = helper.requireModule('./server/controller');

let uracServers = null;
let uracserver = require('../urac-service-mock.js');

describe("Integration for Usecase 1", function () {
    let extKey = "3d90163cf9d6b3076ad26aa5ed58556348069258e5c6c941ee0f18448b570ad1c5c790e2d2a1989680c55f4904e2005ff5f8e71606e4aa641e67882f4210ebbc5460ff305dcb36e6ec2a2299cf0448ef60b9e38f41950ec251c1cf41f05f3ce9";
    let c = new Controller();
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
                    done();
                });
            });
        });
    });

    it("Get permissions - no logged in user", function (done) {
        let options = {
            uri: 'http://127.0.0.1:4000/key/permission/get',
            headers: {
                'Content-Type': 'application/json',
                key: extKey
            }
        };
        helper.requester('get', options, (error, body) => {
            assert.ok(body);
            assert.strictEqual(body.result, false);
            assert.deepStrictEqual(body.errors.codes, [158]);
            done();
        });
    });
    it("Get permissions - with logged in user", function (done) {
        let options = {
            uri: 'http://127.0.0.1:4000/key/permission/get',
            headers: {
                'Content-Type': 'application/json',
                key: extKey
            },
            qs: {
                access_token: "cfb209a91b23896820f510aadbf1f4284b512123"
            }
        };
        helper.requester('get', options, (error, body) => {
            assert.ok(body.acl);
            done();
        });
    });

    it("fail - Access Forbidden to requested environment (invalid), error 137", function (done) {
        let options = {
            uri: 'http://127.0.0.1:4000/proxy/redirect',
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
        helper.requester('get', options, (error, body) => {
            assert.ifError(error);
            assert.ok(body);
            assert.strictEqual(body.result, false);
            assert.ok(body.errors);
            done();
        });
    });

    it("fail - Access Forbidden to requested environment (invalid), error 137", function (done) {
        let options = {
            uri: 'http://127.0.0.1:4000/proxy/redirect',
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
        helper.requester('get', options, (error, body) => {
            assert.ok(body);
            assert.strictEqual(body.result, false);
            assert.deepStrictEqual(body.errors.codes, [135]);
            done();
        });
    });

    it("Urac - user", function (done) {
        let options = {
            uri: 'http://127.0.0.1:4000/urac/user',
            headers: {
                'Content-Type': 'application/json',
                key: extKey
            }
        };
        helper.requester('get', options, (error, body) => {
            assert.deepStrictEqual(body, {
                result: true,
                data: {firstname: 'antoine', lastname: 'hage'}
            });
            done();
        });
    });

    it("Urac - luser", function (done) {
        let options = {
            uri: 'http://127.0.0.1:4000/urac/luser',
            headers: {
                'Content-Type': 'application/json',
                key: extKey
            }
        };
        helper.requester('get', options, (error, body) => {
            assert.deepStrictEqual(body, {
                result: true,
                data: {firstname: 'antoine', lastname: 'hage'}
            });
            done();
        });
    });

    after((done) => {
        c.stop(registry, log, service, server, serverMaintenance, () => {
            uracserver.killServer(uracServers);
            done();
        });
    });
});