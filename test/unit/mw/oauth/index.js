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

describe("Unit test for: mw - oauth deviceId check", () => {

    // builds a configuration whose model returns an access token carrying the given deviceId
    let buildConfiguration = (deviceId) => {
        let user = {"id": "1"};
        if (deviceId !== undefined) {
            user.deviceId = deviceId;
        }
        return {
            "soajs": {
                "param": {}
            },
            "serviceConfig": {
                "oauth": {
                    grants: ["password", "refresh_token"],
                    debug: false,
                    accessTokenLifetime: 7200,
                    refreshTokenLifetime: 1209600
                }
            },
            "model": {
                "getAccessToken": (bearerToken, cb) => {
                    return cb(null, {
                        "token": bearerToken,
                        "expires": new Date(new Date().getTime() + 3600000),
                        "user": user
                    });
                }
            }
        };
    };

    // oauthType 2 so that the access token is fetched from the model
    let buildReq = (headerDeviceId) => {
        return {
            "soajs": {
                "log": {
                    "debug": () => {
                    }
                },
                "tenantOauth": {
                    "type": 2
                },
                "servicesConfig": {},
                "registry": {
                    "serviceConfig": {
                        "oauth": {
                            "type": 2
                        }
                    }
                }
            },
            "query": {},
            "body": {},
            "get": (what) => {
                if ('Authorization' === what) {
                    return "Bearer anAccessToken";
                }
                if ('device-id' === what) {
                    return headerDeviceId;
                }
                return undefined;
            }
        };
    };
    let res = {};

    it("test oauth MW - deviceId matches", (done) => {
        let functionMw = mw(buildConfiguration("2222222222"));
        let req = buildReq("2222222222");
        functionMw(req, res, (error) => {
            assert.ifError(error);
            assert.ok(req.oauth.bearerToken);
            done();
        });
    });

    it("test oauth MW - deviceId does not match", (done) => {
        let functionMw = mw(buildConfiguration("3333333333"));
        let req = buildReq("4444444444");
        functionMw(req, res, (error) => {
            assert.deepStrictEqual(error, 156);
            done();
        });
    });

    it("test oauth MW - deviceId on the token but no header", (done) => {
        let functionMw = mw(buildConfiguration("3333333333"));
        let req = buildReq(undefined);
        functionMw(req, res, (error) => {
            assert.deepStrictEqual(error, 156);
            done();
        });
    });

    it("test oauth MW - no deviceId on the token, check is skipped", (done) => {
        let functionMw = mw(buildConfiguration(undefined));
        let req = buildReq("5555555555");
        functionMw(req, res, (error) => {
            assert.ifError(error);
            assert.ok(req.oauth.bearerToken);
            done();
        });
    });

    it("test oauth MW - null deviceId on the token, check is skipped", (done) => {
        let functionMw = mw(buildConfiguration(null));
        let req = buildReq("5555555555");
        functionMw(req, res, (error) => {
            assert.ifError(error);
            assert.ok(req.oauth.bearerToken);
            done();
        });
    });
});
