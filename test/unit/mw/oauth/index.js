"use strict";

const helper = require("../../../helper.js");
const mw = helper.requireModule('./mw/oauth/index');
const assert = require('assert');
const coreModules = require("soajs.core.modules");
let provision = coreModules.provision;

describe("Unit test for: mw - oauth", () => {
    let configuration = {
        "soajs": {
            "param": {}
        },
        "serviceConfig": {
            "oauth": {
                grants: [
                    "password",
                    "refresh_token"
                ],
                debug: false,
                accessTokenLifetime: 7200,
                refreshTokenLifetime: 1209600
            }
        },
        "model": provision.oauthModel
    };
    let req = {
        "soajs": {
            "tenantOauth": {
                "type": 0,
                "secret": "shhh this is a secret"
            },
            "servicesConfig": {},
            "registry": {
                "serviceConfig": {
                    "oauth": {
                        "secret": "your-256-bit-secret",
                        "type": 0,
                        "algorithms": [
                            "HS256"
                        ]
                    }
                }
            }
        },
        "get": (what) => {
            return null;
        }
    };
    let res = {};

    it("initialize", (done) => {
        let oauth_mw = mw(configuration);
        assert.ok(configuration.soajs.oauthService);
        done();
    });
    it("test oauth MW - without Authorization", (done) => {
        let functionMw = mw(configuration);
        functionMw(req, res, (error) => {
            assert.deepStrictEqual(error, 143);
            done();
        });
    });

    it("test  oauth MW - with wrong Authorization syntax", (done) => {
        req.get = (what) => {
            if ('Authorization' === what)
                return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmb28iOiJiYXIiLCJpYXQiOjE1NDQxMzg5NjV9.gOCtYwG2QdamGbFe-33ffBz9dkoRn_nEiGf0BAuRAz8";
        };
        let functionMw = mw(configuration);
        functionMw(req, res, (error) => {
            assert.deepStrictEqual(error, 143);
            done();
        });
    });

    it("test  oauth MW - with wrong Authorization", (done) => {
        req.get = (what) => {
            if ('Authorization' === what)
                return "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmb28iOiJiYXIiLCJpYXQiOjE1NDQxMzg5NjV9.gOCtYwG2QdamGbFe-33ffBz9dkoRn_nEiGf0BAuRAz0";
        };
        let functionMw = mw(configuration);
        functionMw(req, res, (error) => {
            assert.ok(error);
            done();
        });
    });

    it("test  oauth MW - good Authorization", (done) => {
        req.get = (what) => {
            if ('Authorization' === what)
                return "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmb28iOiJiYXIiLCJpYXQiOjE1NDQxMzg5NjV9.gOCtYwG2QdamGbFe-33ffBz9dkoRn_nEiGf0BAuRAz8";
        };
        let functionMw = mw(configuration);
        functionMw(req, res, (error) => {
            assert.ok(req.oauth);
            assert.ok(req.oauth.bearerToken);
            done();
        });
    });
});
