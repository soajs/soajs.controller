"use strict";

const helper = require("../../../helper.js");
const mw = helper.requireModule('./mw/lastSeen/index');
const assert = require('assert');
const nock = require('nock');

describe("Unit test for: mw - lastSeen", () => {

    it("success - with network", (done) => {
        let res = {};
        let req = {
            getClientIP: () => {
                return "127.0.0.1";
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

    describe("include filter tests", () => {

        it("no include filter - backward compatibility - should trigger", (done) => {
            let res = {};
            let req = {
                method: "GET",
                getClientIP: () => {
                    return "127.0.0.1";
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
                    controller: {
                        serviceParams: {
                            name: "dashboard",
                            parsedUrl: {
                                pathname: "/some/api"
                            }
                        }
                    },
                    uracDriver: {
                        getProfile: () => {
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
                                        // No include filter
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
                done();
            });
        });

        it("include filter with service true - should trigger for any API/method", (done) => {
            let res = {};
            let req = {
                method: "POST",
                getClientIP: () => {
                    return "127.0.0.1";
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
                    controller: {
                        serviceParams: {
                            name: "dashboard",
                            parsedUrl: {
                                pathname: "/any/api/path"
                            }
                        }
                    },
                    uracDriver: {
                        getProfile: () => {
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
                                        network: "YAYA",
                                        include: {
                                            "dashboard": true
                                        }
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
                done();
            });
        });

        it("include filter with service NOT in whitelist - should NOT trigger", (done) => {
            let lastSeenSkipped = false;
            let res = {};
            let req = {
                method: "GET",
                getClientIP: () => {
                    return "127.0.0.1";
                },
                soajs: {
                    log: {
                        debug: (a) => {
                            console.log(a);
                            if (a && a.includes && a.includes("lastSeen skipped")) {
                                lastSeenSkipped = true;
                            }
                        },
                        error: (a) => {
                            console.log(a);
                        }
                    },
                    controller: {
                        serviceParams: {
                            name: "other-service",
                            parsedUrl: {
                                pathname: "/some/api"
                            }
                        }
                    },
                    uracDriver: {
                        getProfile: () => {
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
                                        network: "YAYA",
                                        include: {
                                            "dashboard": true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };
            let functionMw = mw({});
            functionMw(req, res, (error) => {
                assert.ifError(error);
                setTimeout(() => {
                    assert.ok(lastSeenSkipped, "lastSeen should have been skipped");
                    done();
                }, 50);
            });
        });

        it("include filter with specific API and method match - should trigger", (done) => {
            let res = {};
            let req = {
                method: "POST",
                getClientIP: () => {
                    return "127.0.0.1";
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
                    controller: {
                        serviceParams: {
                            name: "urac",
                            parsedUrl: {
                                pathname: "/user/profile"
                            }
                        }
                    },
                    uracDriver: {
                        getProfile: () => {
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
                                        network: "YAYA",
                                        include: {
                                            "urac": {
                                                "apis": {
                                                    "/user/profile": ["get", "post"]
                                                }
                                            }
                                        }
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
                done();
            });
        });

        it("include filter with specific API but method NOT match - should NOT trigger", (done) => {
            let lastSeenSkipped = false;
            let res = {};
            let req = {
                method: "DELETE",
                getClientIP: () => {
                    return "127.0.0.1";
                },
                soajs: {
                    log: {
                        debug: (a) => {
                            console.log(a);
                            if (a && a.includes && a.includes("lastSeen skipped")) {
                                lastSeenSkipped = true;
                            }
                        },
                        error: (a) => {
                            console.log(a);
                        }
                    },
                    controller: {
                        serviceParams: {
                            name: "urac",
                            parsedUrl: {
                                pathname: "/user/profile"
                            }
                        }
                    },
                    uracDriver: {
                        getProfile: () => {
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
                                        network: "YAYA",
                                        include: {
                                            "urac": {
                                                "apis": {
                                                    "/user/profile": ["get", "post"]
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };
            let functionMw = mw({});
            functionMw(req, res, (error) => {
                assert.ifError(error);
                setTimeout(() => {
                    assert.ok(lastSeenSkipped, "lastSeen should have been skipped");
                    done();
                }, 50);
            });
        });

        it("include filter with API true - all methods - should trigger", (done) => {
            let res = {};
            let req = {
                method: "PUT",
                getClientIP: () => {
                    return "127.0.0.1";
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
                    controller: {
                        serviceParams: {
                            name: "urac",
                            parsedUrl: {
                                pathname: "/user/login"
                            }
                        }
                    },
                    uracDriver: {
                        getProfile: () => {
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
                                        network: "YAYA",
                                        include: {
                                            "urac": {
                                                "apis": {
                                                    "/user/login": true
                                                }
                                            }
                                        }
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
                done();
            });
        });

        it("include filter with wildcard '*': true - should trigger for all APIs", (done) => {
            let res = {};
            let req = {
                method: "GET",
                getClientIP: () => {
                    return "127.0.0.1";
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
                    controller: {
                        serviceParams: {
                            name: "multitenant",
                            parsedUrl: {
                                pathname: "/any/random/api"
                            }
                        }
                    },
                    uracDriver: {
                        getProfile: () => {
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
                                        network: "YAYA",
                                        include: {
                                            "multitenant": {
                                                "apis": {
                                                    "*": true
                                                }
                                            }
                                        }
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
                done();
            });
        });

        it("include filter with wildcard '*' and method array - should trigger for matching method", (done) => {
            let res = {};
            let req = {
                method: "POST",
                getClientIP: () => {
                    return "127.0.0.1";
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
                    controller: {
                        serviceParams: {
                            name: "multitenant",
                            parsedUrl: {
                                pathname: "/any/random/api"
                            }
                        }
                    },
                    uracDriver: {
                        getProfile: () => {
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
                                        network: "YAYA",
                                        include: {
                                            "multitenant": {
                                                "apis": {
                                                    "*": ["post", "put"]
                                                }
                                            }
                                        }
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
                done();
            });
        });

        it("include filter with wildcard '*' and method array - should NOT trigger for non-matching method", (done) => {
            let lastSeenSkipped = false;
            let res = {};
            let req = {
                method: "GET",
                getClientIP: () => {
                    return "127.0.0.1";
                },
                soajs: {
                    log: {
                        debug: (a) => {
                            console.log(a);
                            if (a && a.includes && a.includes("lastSeen skipped")) {
                                lastSeenSkipped = true;
                            }
                        },
                        error: (a) => {
                            console.log(a);
                        }
                    },
                    controller: {
                        serviceParams: {
                            name: "multitenant",
                            parsedUrl: {
                                pathname: "/any/random/api"
                            }
                        }
                    },
                    uracDriver: {
                        getProfile: () => {
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
                                        network: "YAYA",
                                        include: {
                                            "multitenant": {
                                                "apis": {
                                                    "*": ["post", "put"]
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };
            let functionMw = mw({});
            functionMw(req, res, (error) => {
                assert.ifError(error);
                setTimeout(() => {
                    assert.ok(lastSeenSkipped, "lastSeen should have been skipped");
                    done();
                }, 50);
            });
        });

        it("include filter with API not in whitelist - should NOT trigger", (done) => {
            let lastSeenSkipped = false;
            let res = {};
            let req = {
                method: "GET",
                getClientIP: () => {
                    return "127.0.0.1";
                },
                soajs: {
                    log: {
                        debug: (a) => {
                            console.log(a);
                            if (a && a.includes && a.includes("lastSeen skipped")) {
                                lastSeenSkipped = true;
                            }
                        },
                        error: (a) => {
                            console.log(a);
                        }
                    },
                    controller: {
                        serviceParams: {
                            name: "urac",
                            parsedUrl: {
                                pathname: "/user/other-api"
                            }
                        }
                    },
                    uracDriver: {
                        getProfile: () => {
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
                                        network: "YAYA",
                                        include: {
                                            "urac": {
                                                "apis": {
                                                    "/user/profile": ["get", "post"]
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };
            let functionMw = mw({});
            functionMw(req, res, (error) => {
                assert.ifError(error);
                setTimeout(() => {
                    assert.ok(lastSeenSkipped, "lastSeen should have been skipped");
                    done();
                }, 50);
            });
        });

        it("include filter with path params - should trigger for matching URL", (done) => {
            let res = {};
            let req = {
                method: "POST",
                getClientIP: () => {
                    return "127.0.0.1";
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
                    controller: {
                        serviceParams: {
                            name: "av",
                            parsedUrl: {
                                pathname: "/get/calls/room/abc123"
                            }
                        }
                    },
                    uracDriver: {
                        getProfile: () => {
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
                                        network: "YAYA",
                                        include: {
                                            "av": {
                                                "apis": {
                                                    "/get/calls/room/:roomId": ["post"]
                                                }
                                            }
                                        }
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
                done();
            });
        });

        it("include filter with path params - should NOT trigger for non-matching URL", (done) => {
            let lastSeenSkipped = false;
            let res = {};
            let req = {
                method: "POST",
                getClientIP: () => {
                    return "127.0.0.1";
                },
                soajs: {
                    log: {
                        debug: (a) => {
                            console.log(a);
                            if (a && a.includes && a.includes("lastSeen skipped")) {
                                lastSeenSkipped = true;
                            }
                        },
                        error: (a) => {
                            console.log(a);
                        }
                    },
                    controller: {
                        serviceParams: {
                            name: "av",
                            parsedUrl: {
                                pathname: "/get/calls/other/abc123"
                            }
                        }
                    },
                    uracDriver: {
                        getProfile: () => {
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
                                        network: "YAYA",
                                        include: {
                                            "av": {
                                                "apis": {
                                                    "/get/calls/room/:roomId": ["post"]
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };
            let functionMw = mw({});
            functionMw(req, res, (error) => {
                assert.ifError(error);
                setTimeout(() => {
                    assert.ok(lastSeenSkipped, "lastSeen should have been skipped");
                    done();
                }, 50);
            });
        });

        it("include filter with multiple path params - should trigger", (done) => {
            let res = {};
            let req = {
                method: "GET",
                getClientIP: () => {
                    return "127.0.0.1";
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
                    controller: {
                        serviceParams: {
                            name: "api",
                            parsedUrl: {
                                pathname: "/users/user123/posts/post456"
                            }
                        }
                    },
                    uracDriver: {
                        getProfile: () => {
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
                                        network: "YAYA",
                                        include: {
                                            "api": {
                                                "apis": {
                                                    "/users/:userId/posts/:postId": true
                                                }
                                            }
                                        }
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
                done();
            });
        });

    });

    describe("extra targets tests", () => {

        let buildReq = (lastSeen) => {
            return {
                method: "GET",
                getClientIP: () => {
                    return "127.0.0.1";
                },
                soajs: {
                    log: {
                        debug: () => {
                        },
                        error: () => {
                        }
                    },
                    uracDriver: {
                        getProfile: () => {
                            return { _id: "1111111111" };
                        }
                    },
                    awareness: {
                        getHost: (name, version, cb) => {
                            return cb(name + ".fake");
                        }
                    },
                    controller: {
                        serviceParams: {
                            name: "connectspaces",
                            path: "/active",
                            parsedUrl: { pathname: "/connectspaces/active" }
                        }
                    },
                    registry: {
                        services: {
                            urac: { port: 4001 },
                            authenticator: { port: 4002 }
                        },
                        custom: {
                            gateway: {
                                value: { lastSeen: lastSeen }
                            }
                        }
                    }
                }
            };
        };

        it("notifies the extra target alongside urac, honouring its method", (done) => {
            let req = buildReq({
                active: true,
                network: "YAYA",
                targets: [{
                    serviceName: "authenticator",
                    serviceVersion: "1",
                    api: "/my/device/network",
                    method: "put"
                }]
            });
            const uracScope = nock('http://urac.fake:4001')
                .post('/user/last/seen', "{\"network\":\"YAYA\"}")
                .reply(200, { result: true });
            const authScope = nock('http://authenticator.fake:4002')
                .put('/my/device/network', "{\"network\":\"YAYA\"}")
                .reply(200, { result: true });

            let functionMw = mw({});
            functionMw(req, {}, (error) => {
                assert.ifError(error);
            });
            setTimeout(() => {
                assert.strictEqual(uracScope.isDone(), true, "urac was not notified");
                assert.strictEqual(authScope.isDone(), true, "the extra target was not notified");
                done();
            }, 100);
        });

        it("defaults the extra target to post when no method is set", (done) => {
            let req = buildReq({
                active: true,
                targets: [{
                    serviceName: "authenticator",
                    serviceVersion: "1",
                    api: "/my/device/network"
                }]
            });
            nock('http://urac.fake:4001').post('/user/last/seen').reply(200, { result: true });
            const authScope = nock('http://authenticator.fake:4002')
                .post('/my/device/network')
                .reply(200, { result: true });

            let functionMw = mw({});
            functionMw(req, {}, () => {
            });
            setTimeout(() => {
                assert.strictEqual(authScope.isDone(), true, "the extra target was not posted to");
                done();
            }, 100);
        });

        it("still notifies urac when a target names a service that is not in the registry", (done) => {
            let req = buildReq({
                active: true,
                targets: [{
                    serviceName: "doesnotexist",
                    serviceVersion: "1",
                    api: "/nope"
                }]
            });
            const uracScope = nock('http://urac.fake:4001')
                .post('/user/last/seen')
                .reply(200, { result: true });

            let functionMw = mw({});
            assert.doesNotThrow(() => {
                functionMw(req, {}, () => {
                });
            });
            setTimeout(() => {
                assert.strictEqual(uracScope.isDone(), true, "urac was not notified");
                done();
            }, 100);
        });

        it("skips a malformed target and still notifies urac", (done) => {
            let req = buildReq({
                active: true,
                targets: [{ serviceVersion: "1" }, null]
            });
            const uracScope = nock('http://urac.fake:4001')
                .post('/user/last/seen')
                .reply(200, { result: true });

            let functionMw = mw({});
            functionMw(req, {}, () => {
            });
            setTimeout(() => {
                assert.strictEqual(uracScope.isDone(), true, "urac was not notified");
                done();
            }, 100);
        });

        it("does not notify any target when the include filter excludes the request", (done) => {
            let req = buildReq({
                active: true,
                include: { "someotherservice": true },
                targets: [{
                    serviceName: "authenticator",
                    serviceVersion: "1",
                    api: "/my/device/network",
                    method: "put"
                }]
            });
            const uracScope = nock('http://urac.fake:4001').post('/user/last/seen').reply(200, {});
            const authScope = nock('http://authenticator.fake:4002').put('/my/device/network').reply(200, {});

            let functionMw = mw({});
            functionMw(req, {}, () => {
            });
            setTimeout(() => {
                assert.strictEqual(uracScope.isDone(), false, "urac should have been skipped");
                assert.strictEqual(authScope.isDone(), false, "the extra target should have been skipped");
                nock.cleanAll();
                done();
            }, 100);
        });

    });

});