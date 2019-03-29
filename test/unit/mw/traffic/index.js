"use strict";

const helper = require("../../../helper.js");
const mw = helper.requireModule('./mw/traffic/index');
const assert = require('assert');

describe("Unit test for: mw - traffic", () => {

    it("success - default from environment", (done) => {
        let res = {};
        let req = {
            soajs: {
                registry: {
                    serviceConfig: {
                        throttling: {
                            "publicAPIStrategy": "default", // can be null means throttling is off
                            "privateAPIStrategy": "heavy", // can be null means throttling is off
                            "default": {
                                'status': 1, // 0=Off, 1=On
                                'type': 1, // 0= tenant, 1= tenant -> ip
                                'window': 60000,
                                'limit': 50,
                                'retries': 2,
                                'delay': 1000
                            }
                        }
                    }
                },
                controller: {
                    serviceParams: {
                        name: "test_service"
                    }
                },
                servicesConfig: {},
                tenant: {
                    id: "123456",
                    name: "TEST"
                },
                controllerResponse: () => {

                }
            }
        };
        let functionMw = mw({});
        functionMw(req, res, (error) => {
            assert.ifError(error);
            done();
        });
    });

    it("success - default from environment API is public", (done) => {
        let res = {};
        let req = {
            getClientIP: () => {
                return "127.0.0.1"
            },
            soajs: {
                registry: {
                    serviceConfig: {
                        throttling: {
                            "publicAPIStrategy": "default", // can be null means throttling is off
                            "privateAPIStrategy": "heavy", // can be null means throttling is off
                            "default": {
                                'status': 1, // 0=Off, 1=On
                                'type': 1, // 0= tenant, 1= tenant -> ip
                                'window': 60000,
                                'limit': 50,
                                'retries': 2,
                                'delay': 1000
                            }
                        }
                    }
                },
                controller: {
                    serviceParams: {
                        name: "test_service",
                        isAPIPublic: true
                    }
                },
                servicesConfig: {},
                tenant: {
                    id: "123456",
                    name: "TEST"
                },
                controllerResponse: () => {

                }
            }
        };
        let functionMw = mw({});
        functionMw(req, res, (error) => {
            assert.ifError(error);
            done();
        });
    });

    it("success - override at tenant level with no configuration", (done) => {
        let res = {};
        let req = {
            getClientIP: () => {
                return "127.0.0.1"
            },
            soajs: {
                registry: {
                    serviceConfig: {
                        throttling: {
                            "publicAPIStrategy": "default", // can be null means throttling is off
                            "privateAPIStrategy": "heavy", // can be null means throttling is off
                            "default": {
                                'status': 1, // 0=Off, 1=On
                                'type': 1, // 0= tenant, 1= tenant -> ip
                                'window': 60000,
                                'limit': 50,
                                'retries': 2,
                                'delay': 1000
                            }
                        }
                    }
                },
                controller: {
                    serviceParams: {
                        name: "test_service",
                        isAPIPublic: true
                    }
                },
                servicesConfig: {
                    "test_service": {
                        SOAJS: {
                            THROTTLING: {}
                        }
                    }
                },
                tenant: {
                    id: "123456",
                    name: "TEST"
                },
                controllerResponse: () => {

                }
            }
        };
        let functionMw = mw({});
        functionMw(req, res, (error) => {
            assert.ifError(error);
            done();
        });
    });

    it("success - override at tenant level", (done) => {
        let res = {};
        let req = {
            getClientIP: () => {
                return "127.0.0.1"
            },
            soajs: {
                registry: {
                    serviceConfig: {
                        throttling: {
                            "publicAPIStrategy": "default", // can be null means throttling is off
                            "privateAPIStrategy": "heavy", // can be null means throttling is off
                            "default": {
                                'status': 1, // 0=Off, 1=On
                                'type': 1, // 0= tenant, 1= tenant -> ip
                                'window': 60000,
                                'limit': 50,
                                'retries': 2,
                                'delay': 1000
                            }
                        }
                    }
                },
                controller: {
                    serviceParams: {
                        name: "test_service",
                        isAPIPublic: true
                    }
                },
                servicesConfig: {
                    "test_service": {
                        SOAJS: {
                            THROTTLING: {
                                "publicAPIStrategy": "default"
                            }
                        }
                    }
                },
                tenant: {
                    id: "123456",
                    name: "TEST"
                },
                controllerResponse: () => {

                }
            }
        };
        let functionMw = mw({});
        functionMw(req, res, (error) => {
            assert.ifError(error);
            done();
        });
    });

});