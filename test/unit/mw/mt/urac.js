"use strict";

const helper = require("../../../helper.js");
const UracDriver = helper.requireModule('./mw/mt/urac');
const assert = require('assert');


describe("Unit test for: mw - mt URAC", () => {

    let soajs = {
        tenant: {
            application: {
                product: {}
            },
            key: {
                iKey: "1111"
            }
        }
    };
    let oauth = {
        type: 0,
        bearerToken: {
            user: "me@antoine.com"
        }
    };

    describe("Vanilla test for: mw - mt URAC", () => {
        let uracDriver = new UracDriver({"soajs": soajs, "oauth": oauth});

        it("test init", (done) => {
            uracDriver.init((error, uracProfile) => {
                assert.deepStrictEqual(
                    uracProfile, {user: 'me@antoine.com'}
                );
                done();
            });
        });
        it("test getProfile", (done) => {
            let p = uracDriver.getProfile();
            assert.deepStrictEqual(p, {
                _id: 'me@antoine.com',
                username: 'me@antoine.com',
                tenant: {},
                profile: {user: 'me@antoine.com'}
            });
            done();
        });
        it("test getAcl", (done) => {
            let a = uracDriver.getAcl();
            assert.deepStrictEqual(a, null);
            done();
        });
        it("test getAclAllEnv", (done) => {
            let a = uracDriver.getAclAllEnv();
            assert.deepStrictEqual(a, null);
            done();
        });
        it("test getConfig", (done) => {
            let a = uracDriver.getConfig();
            assert.deepStrictEqual(a, null);
            done();
        });
        it("test getGroups", (done) => {
            let a = uracDriver.getGroups();
            assert.deepStrictEqual(a, null);
            done();
        });
    });

    describe("bearerToken test for: mw - mt URAC", () => {
        oauth.type = 2;
        oauth.bearerToken = require('../../../data/sample/bearerToken.json');
        soajs.tenant.application.product = "DSBRD_OWNER";
        let uracDriver = new UracDriver({"soajs": soajs, "oauth": oauth});

        it("test init - full user", (done) => {
            uracDriver.init((error, uracProfile) => {
                assert.deepStrictEqual(uracProfile.username, 'owner');
                done();
            });
        });
        it("test getProfile - full user", (done) => {
            let p = uracDriver.getProfile(true);
            assert.deepStrictEqual(p, {
                "_id": '5c8d0c505653de3985aa0ffd',
                "username": 'owner',
                "firstName": 'owner',
                "lastName": 'owner',
                "email": 'me@localhost.com',
                "groups": ['owner'],
                "groupsConfig": {
                    "allowedPackages": {
                        "DSBRD": [
                            "DSBRD_OWNER"
                        ]
                    }
                },
                "profile": {},
                "config": {
                    "packages": {},
                    "keys": {}
                },
                "tenant": {"id": '5c0e74ba9acc3c5a84a51259', "code": 'DBTN'}
            });
            done();
        });
        it("test getAcl", (done) => {
            let a = uracDriver.getAcl();
            assert.deepStrictEqual(a, null);
            done();
        });
        it("test getAclAllEnv", (done) => {
            let a = uracDriver.getAclAllEnv();
            assert.deepStrictEqual(a, null);
            done();
        });
        it("test getConfig", (done) => {
            let a = uracDriver.getConfig();
            assert.deepStrictEqual(a, null);
            done();
        });
        it("test getGroups", (done) => {
            let a = uracDriver.getGroups();
            assert.deepStrictEqual(a, ['owner']);
            done();
        });
    });
});