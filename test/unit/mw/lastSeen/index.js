"use strict";

const helper = require("../../../helper.js");
const mw = helper.requireModule('./mw/lastSeen/index');
const assert = require('assert');
const nock = require('nock')

describe("Unit test for: mw - lastSeen", () => {

    it("success - with network", (done) => {
        let res = {};
        let req = {
            getClientIP: () => {
                return "127.0.0.1"
            },
            soajs: {
                log: {
                    debug: (a) => {
                        console.log(a);
                    },
                    error: (a) => {
                        console.log(a);
                    }
                },
                uracDriver: {
                    getProfile: (name, version, cb) => {
                        return { _id: "1111111111" };
                    }
                },
                awareness: {
                    getHost: (name, version, cb) => {
                        return cb("urac.fake");
                    }
                },
                registry: {
                    services: {
                        urac: {
                            port: 4001
                        }
                    },
                    custom: {
                        gateway: {
                            value: {
                                lastSeen: {
                                    active: true,
                                    network: "YAYA"
                                }
                            }
                        }
                    }
                }
            }
        };
        const scope = nock('http://urac.fake:4001')
            .post('/user/last/seen', "{\"network\":\"YAYA\"}")
            .reply(200, {
                result: true,
                data: true
            });
        let functionMw = mw({});
        functionMw(req, res, (error) => {
            assert.ifError(error);
            // nock.cleanAll()
            done();
        });
    });

});