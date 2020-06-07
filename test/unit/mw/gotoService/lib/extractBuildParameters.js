"use strict";

const helper = require("../../../../helper.js");
const mwLib = helper.requireModule('./mw/gotoService/lib/extractBuildParameters');
const assert = require('assert');

let req = {
    soajs: {
        registry: {
            endpoints: {
                deployed: {
                    urac: ["2", "1"]
                }
            },
            services: {
                urac: {
                    port: 4004,
                    versions: {
                        "2": {
                            extKeyRequired: true
                        }
                    },
                    hosts: {
                        latest: 2
                    }
                }
            }
        }
    }
};

describe("Unit test for: mw - gotoService lib extractBuildParameters", () => {
    it("Install & Use the MW Lib - vanilla", (done) => {
        mwLib(null, null, null, null, null, null, null, () => {
            done();
        });
    });

    it("Install & Use the MW Lib - with service and version", (done) => {
        mwLib(req, "urac", "urac/v2", "2", null, "/urac/v2/addUser?name=tony", null, (error, parameters) => {
            assert.ok(parameters.registry);
            done();
        });
    });
    it("Install & Use the MW Lib - with service and no version", (done) => {
        mwLib(req, "urac", "urac/", null, null, "/urac/v2/addUser?name=tony", null, (error, parameters) => {
            assert.ok(parameters.registry);
            done();
        });
    });
    it("Install & Use the MW Lib - with endpoint", (done) => {
        req.soajs.registry.services.urac.type = "endpoint";
        req.soajs.registry.services.urac.hosts = null;
        mwLib(req, "urac", "urac/", null, null, "/urac/addUser?name=tony", null, (error, parameters) => {
            assert.ok(parameters.registry);
            done();
        });
    });
    it("Install & Use the MW Lib - with endpoint and no registry", (done) => {
        req.soajs.registry.services.urac.type = "endpoint";
        req.soajs.registry.endpoints = null;
        req.soajs.registry.services.urac.hosts = null;
        mwLib(req, "urac", "urac/", null, null, "/urac/addUser?name=tony", null, (error, parameters) => {
            done();
        });
    });
    it("Install & Use the MW Lib - with anything and no registry", (done) => {
        req.soajs.registry.services.urac.type = "anything";
        req.soajs.registry.services.urac.hosts = null;
        mwLib(req, "urac", "urac/", null, null, "/urac/addUser?name=tony", null, (error, parameters) => {
            done();
        });
    });

});
