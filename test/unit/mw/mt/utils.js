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

	// [name, User-Agent, [family, major, minor, patch], [os family, major, minor, patch]] as useragent 2.3.0 parsed them
	let userAgents = [
		["chrome-win", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.130 Safari/537.36", ["Chrome", "120", "0", "6099"], ["Windows", "10", "0", "0"]],
		["chrome-mac", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.129 Safari/537.36", ["Chrome", "120", "0", "6099"], ["Mac OS X", "10", "15", "7"]],
		["chrome-mac-old", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36", ["Chrome", "58", "0", "3029"], ["Mac OS X", "10", "12", "4"]],
		["chrome-linux", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", ["Chrome", "120", "0", "0"], ["Linux", "0", "0", "0"]],
		["chrome-cros", "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", ["Chrome", "120", "0", "0"], ["Chrome OS", "14541", "0", "0"]],
		["safari-mac", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15", ["Safari", "17", "2", "0"], ["Mac OS X", "10", "15", "7"]],
		["firefox-win", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0", ["Firefox", "121", "0", "0"], ["Windows", "10", "0", "0"]],
		["firefox-mac", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0", ["Firefox", "121", "0", "0"], ["Mac OS X", "10", "15", "0"]],
		["firefox-linux", "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0", ["Firefox", "121", "0", "0"], ["Ubuntu", "0", "0", "0"]],
		["edge-win", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91", ["Chrome", "120", "0", "0"], ["Windows", "10", "0", "0"]],
		["edge-mac", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91", ["Chrome", "120", "0", "0"], ["Mac OS X", "10", "15", "7"]],
		["edge-legacy", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.19582", ["Edge", "18", "19582", "0"], ["Windows", "10", "0", "0"]],
		["ie11", "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko", ["IE", "11", "0", "0"], ["Windows", "10", "0", "0"]],
		["opera", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0", ["Opera", "106", "0", "0"], ["Windows", "10", "0", "0"]],
		["ios-safari", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1", ["Mobile Safari", "17", "2", "0"], ["iOS", "17", "2", "1"]],
		["ipad-safari", "Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1", ["Mobile Safari", "16", "6", "0"], ["iOS", "16", "6", "0"]],
		["ios-chrome", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1", ["Chrome Mobile iOS", "120", "0", "6099"], ["iOS", "17", "2", "0"]],
		["ios-firefox", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/121.0 Mobile/15E148 Safari/605.1.15", ["Firefox iOS", "121", "0", "0"], ["iOS", "17", "2", "0"]],
		["ios-webview", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148", ["Mobile Safari UI/WKWebView", "17", "2", "0"], ["iOS", "17", "2", "0"]],
		["edge-ios", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/120.2210.79 Mobile/15E148 Safari/605.1.15", ["Mobile Safari", "17", "0", "0"], ["iOS", "17", "2", "0"]],
		["android-chrome", "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36", ["Chrome Mobile", "120", "0", "6099"], ["Android", "0", "0", "0"]],
		["android-chrome-tablet", "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", ["Chrome", "120", "0", "0"], ["Android", "0", "0", "0"]],
		["android-webview", "Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230805.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36", ["Chrome Mobile WebView", "116", "0", "0"], ["Android", "0", "0", "0"]],
		["edge-android", "Mozilla/5.0 (Linux; Android 10; HD1913) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36 EdgA/120.0.2210.84", ["Chrome Mobile", "120", "0", "6099"], ["Android", "0", "0", "0"]],
		["samsung", "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36", ["Samsung Internet", "23", "0", "0"], ["Android", "0", "0", "0"]],
		["android-firefox", "Mozilla/5.0 (Android 13; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0", ["Firefox Mobile", "121", "0", "0"], ["Android", "0", "0", "0"]],
		["opera-android", "Mozilla/5.0 (Linux; Android 10; VOG-L29) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 OPR/79.0.4195.76523", ["Opera Mobile", "79", "0", "4195"], ["Android", "0", "0", "0"]],
		["yandex", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 YaBrowser/23.11.0.0 Safari/537.36", ["Yandex Browser", "23", "11", "0"], ["Windows", "10", "0", "0"]],
		["ios-app", "democav/142 CFNetwork/3826.400.120 Darwin/24.3.0", ["democav", "142", "0", "0"], ["Other", "0", "0", "0"]],
		["curl", "curl/8.4.0", ["curl", "8", "4", "0"], ["Other", "0", "0", "0"]]
	];

	let deviceObj = (ua, device) => {
		return {
			req: {
				getClientUserAgent: function () {
					return ua;
				}
			},
			keyObj: {
				device: device
			}
		};
	};

	let exactRule = (b, os) => {
		return {
			"family": b[0], "major": b[1], "minor": b[2], "patch": b[3],
			"os": {"family": os[0], "major": os[1], "minor": os[2], "patch": os[3]}
		};
	};

	userAgents.forEach((row) => {
		let name = row[0], ua = row[1], b = row[2], os = row[3];

		it("test securityDeviceCheck - " + name + " allowed by exact rule", function (done) {
			utils.securityDeviceCheck(deviceObj(ua, {"allow": [exactRule(b, os)]}), function (error, obj) {
				assert.ifError(error);
				assert.strictEqual(obj.device, ua);
				done();
			});
		});

		it("test securityDeviceCheck - " + name + " denied by exact rule", function (done) {
			utils.securityDeviceCheck(deviceObj(ua, {"deny": [exactRule(b, os)]}), function (error) {
				assert.strictEqual(error, 156);
				done();
			});
		});

		it("test securityDeviceCheck - " + name + " not allowed by other family, os or version", function (done) {
			let otherOs = exactRule(b, os);
			otherOs.os.family = "NoSuchOS";
			let otherVersion = exactRule(b, os);
			otherVersion.major = {"min": b[1] + "1"};
			let rules = {"allow": [{"family": "NoSuchBrowser"}, otherOs, otherVersion]};
			utils.securityDeviceCheck(deviceObj(ua, rules), function (error) {
				assert.strictEqual(error, 156);
				done();
			});
		});
	});

	["constructor/1", "toString/2", "__proto__/1", "hasOwnProperty/1 (Linux; Android 10)"].forEach((ua) => {
		it("test securityDeviceCheck - " + ua + " is not allowed as chrome", function (done) {
			utils.securityDeviceCheck(deviceObj(ua, {"allow": [{"family": "chrome"}]}), function (error) {
				assert.strictEqual(error, 156);
				done();
			});
		});

		it("test securityDeviceCheck - " + ua + " is not denied as chrome", function (done) {
			utils.securityDeviceCheck(deviceObj(ua, {"deny": [{"family": "chrome"}]}), function (error, obj) {
				assert.ifError(error);
				assert.strictEqual(obj.device, ua);
				done();
			});
		});
	});

	it("test securityDeviceCheck - empty User-Agent skips device rules", function (done) {
		utils.securityDeviceCheck(deviceObj("", {"allow": [{"family": "chrome"}], "deny": [{"family": "*"}]}), function (error, obj) {
			assert.ifError(error);
			assert.ok(obj);
			done();
		});
	});

	it("test securityDeviceCheck - long padded User-Agent is checked quickly", function (done) {
		let ua = "Mozilla/5.0 (" + "X".repeat(16 * 1024) + ") Gecko/20100101 Firefox/77.0";
		let start = Date.now();
		utils.securityDeviceCheck(deviceObj(ua, {"allow": [{"family": "chrome"}], "deny": [{"family": "IE"}]}), function (error) {
			assert.ok(Date.now() - start < 200);
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