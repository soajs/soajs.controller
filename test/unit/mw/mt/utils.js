"use strict";

const helper = require("../../../helper.js");
const utils = helper.requireModule('./mw/mt/utils');
const assert = require('assert');


describe("Unit test for: mw - mt utils", () => {
	
	it("test securityDeviceCheck", function (done) {
		let obj = {
			req: {
				getClientUserAgent: function () {
					return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36";
				},
				soajs: {
					controller: {
						serviceParams: {
							name: "test",
							path: "lolaa"
						}
					}
				},
				method: "test"
			},
			keyObj: {
				device: {
					"allow": [{"family": "chrome"}], "deny": [
						{
							family: '*',
							os: {
								family: 'major'
							}
						}
					]
				}
			}
		};
		utils.securityDeviceCheck(obj, function (error, obj) {
			assert.ok(obj.device);
			done();
		});
	});
	it("test securityDeviceCheck - major as string", function (done) {
		let obj = {
			req: {
				soajs: {
					log: {
						error: function (input) {
							console.error(input);
						}
					}
				},
				getClientUserAgent: function () {
					return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2227.1 Safari/537.36";
				}
			},
			keyObj: {
				device: {
					"allow": [
						{
							"family": "chrome",
							"major": "test",
							"minor": "23",
							"patch": {
								"min": "2222",
								"max": "2229"
							}
						}
					],
					"deny": [
						{
							"major": "xxx",
							"family": "IE"
						},
						null,
						{
							min: "zzz",
							major: "trolloolllooloo"
						}
					]
				}
			}
		};
		utils.securityDeviceCheck(obj, function (error, obj) {
			assert.strictEqual(error, 156);
			done();
		});
	});
	
	it("test securityDeviceCheck - major as object min > chrome version", function (done) {
		let obj = {
			req: {
				soajs: {
					log: {
						error: function (input) {
							console.error(input);
						}
					}
				},
				getClientUserAgent: function () {
					return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2227.1 Safari/537.36";
				}
			},
			keyObj: {
				device: {
					"allow": [
						{
							"family": "chrome",
							"major": {
								min: "42"
							},
							"minor": "23",
							"patch": {
								"min": "2222",
								"max": "2229"
							}
						}
					],
					"deny": [
						{
							"major": "xxx",
							"family": "IE"
						},
						null,
						{
							min: "12",
							major: "trolloolllooloo"
						}
					]
				}
			}
		};
		utils.securityDeviceCheck(obj, function (error, obj) {
			assert.strictEqual(error, 156);
			done();
		});
	});
	
	it("test securityDeviceCheck - major as object max > chrome version", function (done) {
		let obj = {
			req: {
				soajs: {
					log: {
						error: function (input) {
							console.error(input);
						}
					}
				},
				getClientUserAgent: function () {
					return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2227.1 Safari/537.36";
				}
			},
			keyObj: {
				device: {
					"allow": [
						{
							"family": "chrome",
							"major": {
								max: "40"
							},
							"minor": "23",
							"patch": {
								"min": "2222",
								"max": "2229"
							}
						}
					],
					"deny": [
						{
							"major": "xxx",
							"family": "IE"
						},
						null,
						{
							min: "12",
							major: "trolloolllooloo"
						}
					]
				}
			}
		};
		utils.securityDeviceCheck(obj, function (error, obj) {
			assert.strictEqual(error, 156);
			done();
		});
	});
	
	it("test securityDeviceCheck - with different os", function (done) {
		let obj = {
			req: {
				soajs: {
					log: {
						error: function (input) {
							console.error(input);
						}
					}
				},
				getClientUserAgent: function () {
					return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2227.1 Safari/537.36";
				}
			},
			keyObj: {
				device: {
					"allow": [
						{
							"family": "chrome",
							"os": {
								family: "Mac OS Xx"
							},
							"major": {
								max: "40"
							},
							"minor": "23",
							"patch": {
								"min": "2222",
								"max": "2229"
							}
						}
					],
					"deny": []
				}
			}
		};
		utils.securityDeviceCheck(obj, function (error, obj) {
			assert.strictEqual(error, 156);
			done();
		});
	});
	
	it("test securityDeviceCheck - with identical os different major minor & patch", function (done) {
		let obj = {
			req: {
				soajs: {
					log: {
						error: function (input) {
							console.error(input);
						}
					}
				},
				getClientUserAgent: function () {
					return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2227.1 Safari/537.36";
				}
			},
			keyObj: {
				device: {
					"allow": [
						{
							"family": "chrome",
							"os": {
								family: "Mac OS X"
							},
							"major": {
								max: "40"
							},
							"minor": "23",
							"patch": {
								"min": "2222",
								"max": "2229"
							}
						}
					],
					"deny": []
				}
			}
		};
		utils.securityDeviceCheck(obj, function (error, obj) {
			assert.strictEqual(error, 156);
			done();
		});
	});
	
	it("test securityDeviceCheck - with identical os different and major", function (done) {
		let obj = {
			req: {
				soajs: {
					log: {
						error: function (input) {
							console.error(input);
						}
					}
				},
				getClientUserAgent: function () {
					return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2227.1 Safari/537.36";
				}
			},
			keyObj: {
				device: {
					"allow": [
						{
							"family": "chrome",
							"os": {
								family: "Mac OS X"
							},
							"major": "41",
							"minor": "23",
							"patch": {
								"min": "2222",
								"max": "2229"
							}
						}
					],
					"deny": []
				}
			}
		};
		utils.securityDeviceCheck(obj, function (error, obj) {
			assert.strictEqual(error, 156);
			done();
		});
	});
	
	
	it("test securityGeoCheck - fail on deny: Geographic security configuration failed", (done) => {
		let obj = {
			req: {
				soajs: {
					log: {
						error: function (input) {
							console.error(input);
						}
					}
				},
				getClientIP: function () {
					return 2;
				}
			},
			keyObj: {
				geo: {
					deny: ["wrongdata"]
				}
			}
		};
		utils.securityGeoCheck(obj, (error, obj) => {
			done();
		});
	});
	it("test securityGeoCheck - fail on deny: 155", (done) => {
		let obj = {
			req: {
				soajs: {
					log: {
						error: function (input) {
							console.error(input);
						}
					}
				},
				getClientIP: function () {
					return "192.168.2.3";
				}
			},
			keyObj: {
				geo: {
					deny: ["192.168.2.3"]
				}
			}
		};
		utils.securityGeoCheck(obj, (error, obj) => {
			done();
		});
	});
	it("test securityGeoCheck - fail on allow : Geographic security configuration failed", function (done) {
		let obj = {
			req: {
				soajs: {
					log: {
						error: function (input) {
							console.error(input);
						}
					}
				},
				getClientIP: function () {
					return 2;
				}
			},
			keyObj: {
				geo: {
					allow: ["wrongdata"]
				}
			}
		};
		utils.securityGeoCheck(obj, (error, obj) => {
			done();
		});
	});
	it("test ipWhitelist", function (done) {
		let obj = {
			"req": {
				"soajs": {
					"log": {
						error: function (input) {
							console.error(input);
						},
						debug: function (input) {
							console.debug(input);
						}
					},
					"registry": {
						"custom": {
							"gateway": {
								"value": {
									"mt": {
										"whitelist": {
											"ips": ["10.0.0.0/8"],
											"acl": true,
											"oauth": true
										}
									}
								}
							}
						}
					}
				},
				"getClientIP": function () {
					return "10.35.5.1";
				}
			}
		};
		utils.ipWhitelist(obj, (error, obj) => {
			assert.strictEqual(obj.skipACL, true);
			assert.strictEqual(obj.skipOAUTH, true);
			done();
		});
	});
});