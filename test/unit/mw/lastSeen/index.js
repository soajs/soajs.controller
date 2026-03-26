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

});