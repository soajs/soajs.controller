"use strict";

const helper = require("../../../helper.js");
const mw = helper.requireModule('./mw/mt/index');
const assert = require('assert');
const coreModules = require("soajs.core.modules");

const sinon = require('sinon');


describe("Unit test for: mw - mt", () => {
    let configuration = {
        "soajs": {
            oauth: (req, res, next) => {
                return next();
            },
            oauthService: {
                name: "oauth",
                tokenApi: "/token",
                authorizationApi: "/authorization"
            }
        },
        "app": {},
        "regEnvironment": "dev",
        "core": coreModules.core,
        "provision": {
            "getTenantOauth": (id, cb) => {
                return cb(null)
            },
            "getTenantData": (coed, cb)=>{
                return cb(null, {});
            }
        }
    };
    let req = {
        oauth: {
            bearerToken: {
                clientId: 222,
                env: "dev"
            }
        },
        headers : {},
        getClientUserAgent: () =>{
          return "mozilla";
        },
        getClientIP: () => {
            return "127.0.0.1";
        },
        soajs: {
            controllerResponse: () => {

            },
            log: {
                error: (code, stack) => {
                    console.log(code);
                    console.log(stack);
                },
                debug: (code, stack) => {
                    console.log(code);
                    console.log(stack);
                }
            },
            controller: {
                serviceParams: {
                    finalAcl: {
                        "access": false
                    },
                    version: "1",
                    serviceInfo: ['', 'urac', 'swagger'],
                    registry: {
                        versions: {
                            "2": {
                                oauth: {},
                                dev: {
                                    extKeyRequired: false,
                                    oauth: false,
                                }
                            }
                        }
                    }
                }
            },
            awareness: {
                getHost: (name, cb) => {
                    return cb(null);
                }
            }
        }
    };
    let res = {};
    let serviceStub;
    afterEach(function (done) {
        if (serviceStub) {
            serviceStub.restore();
        }
        done();
    });

    it("Fail test - service version - 133", (done) => {
        let functionMw = mw(configuration);
        functionMw(req, res, (error) => {
            assert.deepStrictEqual(error, 133);
            done();
        });
    });
    it("test swagger route", (done) => {
        req.soajs.controller.serviceParams.version = "2";
        let functionMw = mw(configuration);
        functionMw(req, res, () => {
            done();
        });
    });
    it("test proxy route", (done) => {
        req.soajs.controller.serviceParams.serviceInfo = ['', 'proxy', 'redirect'];
        let functionMw = mw(configuration);
        functionMw(req, res, () => {
            done();
        });
    });
    it("test keyPermission route", (done) => {
        req.soajs.controller.serviceParams.serviceInfo = ['', 'key', 'permission', 'get'];
        let functionMw = mw(configuration);
        functionMw(req, res, () => {
            done();
        });
    });
    it("test route with no oauth and no extKey", (done) => {
        req.soajs.controller.serviceParams.serviceInfo = ['', 'urac', 'getUser'];
        let functionMw = mw(configuration);
        functionMw(req, res, () => {
            done();
        });
    });
    it("test route with oauth and no extKey", (done) => {
        req.soajs.controller.serviceParams.serviceInfo = ['', 'urac', 'getUser'];
        req.soajs.controller.serviceParams.registry.versions["2"].dev.oauth = true;
        let functionMw = mw(configuration);
        functionMw(req, res, () => {
            done();
        });
    });
    it("test route with oauth and no extKey with service equal to oauth", (done) => {
        req.soajs.controller.serviceParams.serviceInfo = ['', 'urac', 'getUser'];
        req.soajs.controller.serviceParams.path = "/authorization";
        req.soajs.controller.serviceParams.name = "oauth";
        req.soajs.controller.serviceParams.registry.versions["2"].dev.oauth = true;
        let functionMw = mw(configuration);
        functionMw(req, res, () => {
            done();
        });
    });
    it("test route with oauth and extKey but keyObj empty", (done) => {
        req.soajs.controller.serviceParams.serviceInfo = ['', 'urac', 'getUser'];
        req.soajs.controller.serviceParams.registry.versions["2"].dev.oauth = true;
        req.soajs.controller.serviceParams.registry.versions["2"].dev.extKeyRequired = true;
        req.soajs.controller.serviceParams.keyObj = {};
        let functionMw = mw(configuration);
        functionMw(req, res, (error) => {
            assert.deepStrictEqual(error, 153);
            done();
        });
    });
    it("test route with oauth and extKey but packObj empty", (done) => {
        req.soajs.controller.serviceParams.serviceInfo = ['', 'urac', 'getUser'];
        req.soajs.controller.serviceParams.registry.versions["2"].dev.oauth = true;
        req.soajs.controller.serviceParams.registry.versions["2"].dev.extKeyRequired = true;
        req.soajs.controller.serviceParams.keyObj = {tenant: {}, application: {package: {}}};
        let functionMw = mw(configuration);
        functionMw(req, res, (error) => {
            assert.deepStrictEqual(error, 152);
            done();
        });
    });

    it("test route with oauth and extKey where keyObj and packObj are ok", (done) => {
        req.soajs.controller.serviceParams.serviceInfo = ['', 'urac', 'getUser'];
        req.soajs.controller.serviceParams.registry.versions["2"].dev.oauth = true;
        req.soajs.controller.serviceParams.registry.versions["2"].dev.extKeyRequired = true;
        req.soajs.controller.serviceParams.keyObj = require('../../../data/sample/keyObj.json');
        req.soajs.controller.serviceParams.packObj = require('../../../data/sample/packObj.json');
        let functionMw = mw(configuration);
        functionMw(req, res, (error) => {
            done();
        });
    });

});


