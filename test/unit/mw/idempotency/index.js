"use strict";

const helper = require("../../../helper.js");
const mw = helper.requireModule('./mw/idempotency/index');
const assert = require('assert');

describe("Unit test for: mw - idempotency", () => {

	let mockLog = {
		debug: () => {},
		info: () => {},
		warn: () => {},
		error: () => {}
	};

	let mockConfig = {
		log: mockLog,
		gatewayDB: {}
	};

	describe("middleware initialization", () => {
		it("should return a function", (done) => {
			let functionMw = mw(mockConfig);
			assert.strictEqual(typeof functionMw, 'function');
			done();
		});
	});

	describe("no idempotency key header", () => {
		it("should call next() when no Idempotency-Key header", (done) => {
			let req = {
				headers: {},
				method: 'POST',
				soajs: {
					tenant: { id: '123' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'test'] } },
					registry: { custom: {} }
				}
			};
			let res = {};
			let functionMw = mw(mockConfig);
			functionMw(req, res, (error) => {
				assert.ifError(error);
				done();
			});
		});
	});

	describe("invalid idempotency key format", () => {
		it("should return 400 for invalid UUID format", (done) => {
			let responseData = null;
			let req = {
				headers: { 'idempotency-key': 'not-a-valid-uuid' },
				soajs: {
					tenant: { id: '123' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'test'] } },
					registry: { custom: {} },
					controllerResponse: (data) => {
						responseData = data;
					}
				}
			};
			let res = {};
			let functionMw = mw(mockConfig);
			functionMw(req, res, () => {
				assert.fail('Should not call next');
			});
			setTimeout(() => {
				assert.notStrictEqual(responseData, null);
				assert.strictEqual(responseData.status, 400);
				assert.strictEqual(responseData.code, 180);
				done();
			}, 10);
		});

		it("should return 400 for UUID v1 format", (done) => {
			let responseData = null;
			let req = {
				headers: { 'idempotency-key': 'a1b2c3d4-e5f6-1789-abcd-ef0123456789' }, // v1 UUID
				soajs: {
					tenant: { id: '123' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'test'] } },
					registry: { custom: {} },
					controllerResponse: (data) => {
						responseData = data;
					}
				}
			};
			let res = {};
			let functionMw = mw(mockConfig);
			functionMw(req, res, () => {
				assert.fail('Should not call next');
			});
			setTimeout(() => {
				assert.notStrictEqual(responseData, null);
				assert.strictEqual(responseData.status, 400);
				assert.strictEqual(responseData.code, 180);
				done();
			}, 10);
		});
	});

	describe("valid idempotency key", () => {
		it("should call next() when no configuration exists", (done) => {
			let req = {
				headers: { 'idempotency-key': '550e8400-e29b-41d4-a716-446655440000' },
				method: 'POST',
				soajs: {
					tenant: { id: '123' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'test'] } },
					registry: { custom: {} }
				}
			};
			let res = {};
			let functionMw = mw(mockConfig);
			functionMw(req, res, (error) => {
				assert.ifError(error);
				done();
			});
		});

		it("should call next() for GET requests", (done) => {
			let req = {
				headers: { 'idempotency-key': '550e8400-e29b-41d4-a716-446655440000' },
				method: 'GET',
				soajs: {
					tenant: { id: '123' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'test'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									idempotency: {
										services: {
											test: { enabled: true, ttl: 60000, apis: ['POST /test'] }
										}
									}
								}
							}
						}
					}
				}
			};
			let res = {};
			let functionMw = mw(mockConfig);
			functionMw(req, res, (error) => {
				assert.ifError(error);
				done();
			});
		});

		it("should call next() when service not configured", (done) => {
			let req = {
				headers: { 'idempotency-key': '550e8400-e29b-41d4-a716-446655440000' },
				method: 'POST',
				soajs: {
					tenant: { id: '123' },
					controller: { serviceParams: { name: 'unconfigured', serviceInfo: ['', 'unconfigured', 'test'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									idempotency: {
										services: {
											other: { enabled: true, ttl: 60000, apis: ['POST /test'] }
										}
									}
								}
							}
						}
					}
				}
			};
			let res = {};
			let functionMw = mw(mockConfig);
			functionMw(req, res, (error) => {
				assert.ifError(error);
				done();
			});
		});

		it("should call next() when service not enabled", (done) => {
			let req = {
				headers: { 'idempotency-key': '550e8400-e29b-41d4-a716-446655440000' },
				method: 'POST',
				soajs: {
					tenant: { id: '123' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'test'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									idempotency: {
										services: {
											test: { enabled: false, ttl: 60000, apis: ['POST /test'] }
										}
									}
								}
							}
						}
					}
				}
			};
			let res = {};
			let functionMw = mw(mockConfig);
			functionMw(req, res, (error) => {
				assert.ifError(error);
				done();
			});
		});

		it("should call next() when API not in configured list", (done) => {
			let req = {
				headers: { 'idempotency-key': '550e8400-e29b-41d4-a716-446655440000' },
				method: 'POST',
				soajs: {
					tenant: { id: '123' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'other'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									idempotency: {
										services: {
											test: { enabled: true, ttl: 60000, apis: ['POST /test'] }
										}
									}
								}
							}
						}
					}
				}
			};
			let res = {};
			let functionMw = mw(mockConfig);
			functionMw(req, res, (error) => {
				assert.ifError(error);
				done();
			});
		});
	});

	describe("idempotency processing", () => {
		it("should process new request and call next()", (done) => {
			let req = {
				headers: { 'idempotency-key': '550e8400-e29b-41d4-a716-446655440001' },
				method: 'POST',
				soajs: {
					tenant: { id: 'tenant-new' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'test'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									idempotency: {
										model: 'memory',
										services: {
											test: { enabled: true, ttl: 60000, apis: ['POST /test'] }
										}
									}
								}
							}
						}
					}
				}
			};
			let res = {
				writeHead: function() { return this; },
				write: function() { return true; },
				end: function() {},
				on: function() {}
			};
			let functionMw = mw(mockConfig);
			functionMw(req, res, (error) => {
				assert.ifError(error);
				done();
			});
		});

		it("should match API with path parameters", (done) => {
			let req = {
				headers: { 'idempotency-key': '550e8400-e29b-41d4-a716-446655440002' },
				method: 'PUT',
				soajs: {
					tenant: { id: 'tenant-param' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'users', '123', 'update'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									idempotency: {
										model: 'memory',
										services: {
											test: { enabled: true, ttl: 60000, apis: ['PUT /users/:id/update'] }
										}
									}
								}
							}
						}
					}
				}
			};
			let res = {
				writeHead: function() { return this; },
				write: function() { return true; },
				end: function() {},
				on: function() {}
			};
			let functionMw = mw(mockConfig);
			functionMw(req, res, (error) => {
				assert.ifError(error);
				done();
			});
		});
	});

	describe("enforcement", () => {
		it("should return 428 when enforced and no key on matched API", (done) => {
			let responseData = null;
			let req = {
				headers: {},
				method: 'POST',
				soajs: {
					tenant: { id: '123' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'test'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									idempotency: {
										services: {
											test: { enabled: true, enforce: true, ttl: 60000, apis: ['POST /test'] }
										}
									}
								}
							}
						}
					},
					controllerResponse: (data) => {
						responseData = data;
					}
				}
			};
			let res = {};
			let functionMw = mw(mockConfig);
			functionMw(req, res, () => {
				assert.fail('Should not call next');
			});
			setTimeout(() => {
				assert.notStrictEqual(responseData, null);
				assert.strictEqual(responseData.status, 428);
				assert.strictEqual(responseData.code, 182);
				done();
			}, 10);
		});

		it("should call next() when enforced and key is present", (done) => {
			let req = {
				headers: { 'idempotency-key': '550e8400-e29b-41d4-a716-446655440010' },
				method: 'POST',
				soajs: {
					tenant: { id: 'tenant-enforce' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'test'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									idempotency: {
										model: 'memory',
										services: {
											test: { enabled: true, enforce: true, ttl: 60000, apis: ['POST /test'] }
										}
									}
								}
							}
						}
					}
				}
			};
			let res = {
				writeHead: function() { return this; },
				write: function() { return true; },
				end: function() {},
				on: function() {}
			};
			let functionMw = mw(mockConfig);
			functionMw(req, res, (error) => {
				assert.ifError(error);
				done();
			});
		});

		it("should call next() when not enforced and no key (backwards compatible)", (done) => {
			let req = {
				headers: {},
				method: 'POST',
				soajs: {
					tenant: { id: '123' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'test'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									idempotency: {
										services: {
											test: { enabled: true, ttl: 60000, apis: ['POST /test'] }
										}
									}
								}
							}
						}
					}
				}
			};
			let res = {};
			let functionMw = mw(mockConfig);
			functionMw(req, res, (error) => {
				assert.ifError(error);
				done();
			});
		});

		it("should return 428 when global enforce is set and service has no override", (done) => {
			let responseData = null;
			let req = {
				headers: {},
				method: 'POST',
				soajs: {
					tenant: { id: '123' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'test'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									idempotency: {
										enforce: true,
										services: {
											test: { enabled: true, ttl: 60000, apis: ['POST /test'] }
										}
									}
								}
							}
						}
					},
					controllerResponse: (data) => {
						responseData = data;
					}
				}
			};
			let res = {};
			let functionMw = mw(mockConfig);
			functionMw(req, res, () => {
				assert.fail('Should not call next');
			});
			setTimeout(() => {
				assert.notStrictEqual(responseData, null);
				assert.strictEqual(responseData.status, 428);
				assert.strictEqual(responseData.code, 182);
				done();
			}, 10);
		});

		it("should let service enforce=false override global enforce=true", (done) => {
			let req = {
				headers: {},
				method: 'POST',
				soajs: {
					tenant: { id: '123' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'test'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									idempotency: {
										enforce: true,
										services: {
											test: { enabled: true, enforce: false, ttl: 60000, apis: ['POST /test'] }
										}
									}
								}
							}
						}
					}
				}
			};
			let res = {};
			let functionMw = mw(mockConfig);
			functionMw(req, res, (error) => {
				assert.ifError(error);
				done();
			});
		});

		it("should not enforce on GET requests", (done) => {
			let req = {
				headers: {},
				method: 'GET',
				soajs: {
					tenant: { id: '123' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'test'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									idempotency: {
										services: {
											test: { enabled: true, enforce: true, ttl: 60000, apis: ['POST /test'] }
										}
									}
								}
							}
						}
					}
				}
			};
			let res = {};
			let functionMw = mw(mockConfig);
			functionMw(req, res, (error) => {
				assert.ifError(error);
				done();
			});
		});

		it("should not enforce when API is not in the configured list", (done) => {
			let req = {
				headers: {},
				method: 'POST',
				soajs: {
					tenant: { id: '123' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'other'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									idempotency: {
										services: {
											test: { enabled: true, enforce: true, ttl: 60000, apis: ['POST /test'] }
										}
									}
								}
							}
						}
					}
				}
			};
			let res = {};
			let functionMw = mw(mockConfig);
			functionMw(req, res, (error) => {
				assert.ifError(error);
				done();
			});
		});
	});

	describe("UUID validation", () => {
		it("should accept valid UUID v4", (done) => {
			let req = {
				headers: { 'idempotency-key': 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
				method: 'POST',
				soajs: {
					tenant: { id: '123' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'test'] } },
					registry: { custom: {} }
				}
			};
			let res = {};
			let functionMw = mw(mockConfig);
			functionMw(req, res, (error) => {
				assert.ifError(error);
				done();
			});
		});

		it("should accept UUID v4 with uppercase", (done) => {
			let req = {
				headers: { 'idempotency-key': 'F47AC10B-58CC-4372-A567-0E02B2C3D479' },
				method: 'POST',
				soajs: {
					tenant: { id: '123' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'test'] } },
					registry: { custom: {} }
				}
			};
			let res = {};
			let functionMw = mw(mockConfig);
			functionMw(req, res, (error) => {
				assert.ifError(error);
				done();
			});
		});
	});

});
