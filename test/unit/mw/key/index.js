"use strict";

const helper = require("../../../helper.js");
const mw = helper.requireModule('./mw/key/index');

describe("Unit test for: mw - key", function () {
    let req = {
        "get": () => {
            return null;
        },
        "soajs": {
            "controller": {"serviceParams": {}},
            "registry": {
                "serviceConfig": {
                    "key": {
                        algorithm: "aes256",
                        password: "soajs key lal massa"
                    }
                }
            },
            "log": {
                "error": (err) => {
                    console.log(err);
                }
            }
        }
    };
    let res = {};
    let key = "3d90163cf9d6b3076ad26aa5ed58556348069258e5c6c941ee0f18448b570ad1c5c790e2d2a1989680c55f4904e2005ff5f8e71606e4aa641e67882f4210ebbc5460ff305dcb36e6ec2a2299cf0448ef60b9e38f41950ec251c1cf41f05f3ce9";
    let keyObj = {
        "key": "a139786a6e6d18e48b4987e83789430b",
        "extKey": "3d90163cf9d6b3076ad26aa5ed58556348069258e5c6c941ee0f18448b570ad1c5c790e2d2a1989680c55f4904e2005ff5f8e71606e4aa641e67882f4210ebbc5460ff305dcb36e6ec2a2299cf0448ef60b9e38f41950ec251c1cf41f05f3ce9",
        "tenant": {"id": "10d2cb5fc04ce51e06000001", "code": "DBTN", "locked": true},
        "application": {
            "product": "DSBRD",
            "package": "DSBRD_GUEST",
            "appId": "5c0e74ba9acc3c5a84a5125a",
            "acl": null,
            "acl_all_env": null
        },
        "device": null,
        "env": "dev",
        "geo": null,
        "config": {}
    };
    let provision = {
        "getExternalKeyData": (key, keyConfig, cb) => {
            return cb(null, keyObj);
        },
        "getPackageData": (pack, cb) => {
            return cb(null, {
                "acl": {
                    "golangpub": {},
                    "oauth": {"1": [null]},
                    "urac": {"2": [null]},
                    "dashboard": {"1": [null]}
                },
                "acl_all_env": {"dev": {"golangpub": {}, "oauth": [null], "urac": [null], "dashboard": [null]}},
                "_TTL": 604800000,
                "_TIME": 1553723540850
            });
        }
    };
    it("Install & Use the MW", function (done) {
        let mw_use = mw({});
        mw_use(req, res, () => {
            done();
        });
    });
    it("Call MW with a valid key", function (done) {
        req.get = () => {
            return key;
        };
        let mw_use = mw({"provision": provision, "regEnvironment": "dev"});
        mw_use(req, res, () => {
            done();
        });
    });
    it("Call MW with a valid key and wrong env", function (done) {
        req.get = () => {
            return key;
        };
        let mw_use = mw({"provision": provision, "regEnvironment": "dashboard"});
        mw_use(req, res, () => {
            done();
        });
    });
    it("Call MW with a valid key and invalid package", function (done) {
        req.get = () => {
            return key;
        };
        provision.getPackageData = (pack, cb) => {
            return cb("error: wewewwwwwwewewew is not a valid pack");
        };
        let mw_use = mw({"provision": provision, "regEnvironment": "dev"});
        mw_use(req, res, () => {
            done();
        });
    });
    it("Call MW with a valid key and silent package error", function (done) {
        req.get = () => {
            return key;
        };
        provision.getPackageData = (pack, cb) => {
            return cb(null, null);
        };
        let mw_use = mw({"provision": provision, "regEnvironment": "dev"});
        mw_use(req, res, () => {
            done();
        });
    });

    it("Call MW with an invalid key", function (done) {
        req.get = () => {
            return "wewewwwwwwewewew";
        };
        provision.getExternalKeyData = (key, keyConfig, cb) => {
            return cb("error: wewewwwwwwewewew is not a valid key");
        };
        let mw_use = mw({"provision": provision, "regEnvironment": "dev"});
        mw_use(req, res, () => {
            done();
        });
    });
    it("Call MW with an invalid key and silent key error", function (done) {
        req.get = () => {
            return "wewewwwwwwewewew";
        };
        provision.getExternalKeyData = (key, keyConfig, cb) => {
            return cb(null, null);
        };
        let mw_use = mw({"provision": provision, "regEnvironment": "dev"});
        mw_use(req, res, () => {
            done();
        });
    });

    describe("Network Package Override", function () {
        let networkKeyObj = {
            "key": "a139786a6e6d18e48b4987e83789430b",
            "tenant": {"id": "10d2cb5fc04ce51e06000001", "code": "DBTN", "locked": true},
            "application": {
                "product": "AVAPP",
                "package": "AVAPP_EXMPL",
                "appId": "5c0e74ba9acc3c5a84a5125a",
                "acl": null,
                "acl_all_env": null
            },
            "device": null,
            "env": "dev",
            "geo": null,
            "config": {
                "gateway": {
                    "networkPackages": {
                        "mw": {
                            "AVAPP": {
                                "default": "AVAPP_DEFAU",
                                "users": {
                                    "AVAPP_EXMPL": "AVAPP_ALTRN"
                                }
                            }
                        }
                    }
                }
            }
        };

        let networkReq = {
            "get": () => {
                return key;
            },
            "soajs": {
                "controller": {"serviceParams": {}},
                "registry": {
                    "serviceConfig": {
                        "key": {
                            algorithm: "aes256",
                            password: "soajs key lal massa"
                        }
                    },
                    "custom": {
                        "gateway": {
                            "value": {
                                "lastSeen": {
                                    "network": "mw"
                                }
                            }
                        }
                    }
                },
                "log": {
                    "error": (err) => {
                        console.log(err);
                    },
                    "debug": (msg) => {
                        console.log(msg);
                    }
                }
            }
        };

        it("Call MW with network package override - should replace package with default", function (done) {
            let networkProvision = {
                "getExternalKeyData": (key, keyConfig, cb) => {
                    return cb(null, JSON.parse(JSON.stringify(networkKeyObj)));
                },
                "getPackageData": (pack, cb) => {
                    // Verify the package was overridden
                    if (pack === "AVAPP_DEFAU") {
                        return cb(null, {"acl": {}, "_TTL": 604800000});
                    }
                    return cb(new Error("Expected package AVAPP_DEFAU but got " + pack));
                }
            };
            let mw_use = mw({"provision": networkProvision, "regEnvironment": "dev"});
            mw_use(networkReq, res, (err) => {
                if (err) {
                    done(new Error("Unexpected error: " + err));
                } else {
                    done();
                }
            });
        });

        it("Call MW without network in registry - should NOT replace package", function (done) {
            let reqNoNetwork = JSON.parse(JSON.stringify(networkReq));
            reqNoNetwork.soajs.registry.custom = {};
            reqNoNetwork.get = () => key;
            reqNoNetwork.soajs.log = {
                "error": (err) => { console.log(err); },
                "debug": (msg) => { console.log(msg); }
            };

            let networkProvision = {
                "getExternalKeyData": (key, keyConfig, cb) => {
                    return cb(null, JSON.parse(JSON.stringify(networkKeyObj)));
                },
                "getPackageData": (pack, cb) => {
                    // Verify the package was NOT overridden
                    if (pack === "AVAPP_EXMPL") {
                        return cb(null, {"acl": {}, "_TTL": 604800000});
                    }
                    return cb(new Error("Expected package AVAPP_EXMPL but got " + pack));
                }
            };
            let mw_use = mw({"provision": networkProvision, "regEnvironment": "dev"});
            mw_use(reqNoNetwork, res, (err) => {
                if (err) {
                    done(new Error("Unexpected error: " + err));
                } else {
                    done();
                }
            });
        });

        it("Call MW with different network - should NOT replace package", function (done) {
            let reqDiffNetwork = JSON.parse(JSON.stringify(networkReq));
            reqDiffNetwork.soajs.registry.custom.gateway.value.lastSeen.network = "other";
            reqDiffNetwork.get = () => key;
            reqDiffNetwork.soajs.log = {
                "error": (err) => { console.log(err); },
                "debug": (msg) => { console.log(msg); }
            };

            let networkProvision = {
                "getExternalKeyData": (key, keyConfig, cb) => {
                    return cb(null, JSON.parse(JSON.stringify(networkKeyObj)));
                },
                "getPackageData": (pack, cb) => {
                    // Verify the package was NOT overridden (different network)
                    if (pack === "AVAPP_EXMPL") {
                        return cb(null, {"acl": {}, "_TTL": 604800000});
                    }
                    return cb(new Error("Expected package AVAPP_EXMPL but got " + pack));
                }
            };
            let mw_use = mw({"provision": networkProvision, "regEnvironment": "dev"});
            mw_use(reqDiffNetwork, res, (err) => {
                if (err) {
                    done(new Error("Unexpected error: " + err));
                } else {
                    done();
                }
            });
        });
    });
});