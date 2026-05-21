"use strict";

const helper = require("../../../helper.js");
const mw = helper.requireModule('./mw/cache/index');
const assert = require('assert');

describe("Unit test for: mw - cache", () => {

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

	describe("non-GET requests", () => {
		it("should call next() for POST requests", (done) => {
			let req = {
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

		it("should call next() for PUT requests", (done) => {
			let req = {
				method: 'PUT',
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

		it("should call next() for DELETE requests", (done) => {
			let req = {
				method: 'DELETE',
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

	describe("GET requests without configuration", () => {
		it("should call next() when no cache configuration exists", (done) => {
			let req = {
				method: 'GET',
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

		it("should call next() when service not configured", (done) => {
			let req = {
				method: 'GET',
				soajs: {
					tenant: { id: '123' },
					controller: { serviceParams: { name: 'unconfigured', serviceInfo: ['', 'unconfigured', 'test'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									cache: {
										services: {
											other: { enabled: true, apis: { 'GET /test': { enabled: true } } }
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
				method: 'GET',
				soajs: {
					tenant: { id: '123' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'test'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									cache: {
										services: {
											test: { enabled: false, apis: { 'GET /test': { enabled: true } } }
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

		it("should call next() when API not configured", (done) => {
			let req = {
				method: 'GET',
				soajs: {
					tenant: { id: '123' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'other'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									cache: {
										services: {
											test: { enabled: true, apis: { 'GET /test': { enabled: true } } }
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

		it("should call next() when API not enabled", (done) => {
			let req = {
				method: 'GET',
				soajs: {
					tenant: { id: '123' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'test'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									cache: {
										services: {
											test: { enabled: true, apis: { 'GET /test': { enabled: false } } }
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

	describe("cache processing", () => {
		it("should process cache miss and call next()", (done) => {
			let req = {
				method: 'GET',
				query: {},
				soajs: {
					tenant: { id: 'tenant-cache-miss' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'test'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									cache: {
										model: 'memory',
										defaultTTL: 60000,
										services: {
											test: { enabled: true, apis: { 'GET /test': { enabled: true, ttl: 30000 } } }
										}
									}
								}
							}
						}
					}
				}
			};
			let headerSet = false;
			let res = {
				setHeader: function(name, value) {
					if (name === 'X-Cache' && value === 'MISS') {
						headerSet = true;
					}
				},
				writeHead: function() { return this; },
				write: function() { return true; },
				end: function() {}
			};
			let functionMw = mw(mockConfig);
			functionMw(req, res, (error) => {
				assert.ifError(error);
				assert.strictEqual(headerSet, true);
				done();
			});
		});

		it("should match API with path parameters", (done) => {
			let req = {
				method: 'GET',
				query: {},
				soajs: {
					tenant: { id: 'tenant-param-cache' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'users', '123'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									cache: {
										model: 'memory',
										services: {
											test: { enabled: true, apis: { 'GET /users/:id': { enabled: true, ttl: 30000 } } }
										}
									}
								}
							}
						}
					}
				}
			};
			let headerSet = false;
			let res = {
				setHeader: function(name, value) {
					if (name === 'X-Cache') {
						headerSet = true;
					}
				},
				writeHead: function() { return this; },
				write: function() { return true; },
				end: function() {}
			};
			let functionMw = mw(mockConfig);
			functionMw(req, res, (error) => {
				assert.ifError(error);
				assert.strictEqual(headerSet, true);
				done();
			});
		});

		it("should use defaultTTL when API TTL not specified", (done) => {
			let req = {
				method: 'GET',
				query: {},
				soajs: {
					tenant: { id: 'tenant-default-ttl' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'test'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									cache: {
										model: 'memory',
										defaultTTL: 300000,
										services: {
											test: { enabled: true, apis: { 'GET /test': { enabled: true } } }
										}
									}
								}
							}
						}
					}
				}
			};
			let res = {
				setHeader: function() {},
				writeHead: function() { return this; },
				write: function() { return true; },
				end: function() {}
			};
			let functionMw = mw(mockConfig);
			functionMw(req, res, (error) => {
				assert.ifError(error);
				done();
			});
		});
	});

	describe("query parameter handling", () => {
		it("should include query params in cache key", (done) => {
			let req = {
				method: 'GET',
				query: { page: '1', limit: '10' },
				soajs: {
					tenant: { id: 'tenant-query' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'test'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									cache: {
										model: 'memory',
										services: {
											test: { enabled: true, apis: { 'GET /test': { enabled: true, ttl: 30000 } } }
										}
									}
								}
							}
						}
					}
				}
			};
			let res = {
				setHeader: function() {},
				writeHead: function() { return this; },
				write: function() { return true; },
				end: function() {}
			};
			let functionMw = mw(mockConfig);
			functionMw(req, res, (error) => {
				assert.ifError(error);
				done();
			});
		});

		it("should handle empty query params", (done) => {
			let req = {
				method: 'GET',
				query: {},
				soajs: {
					tenant: { id: 'tenant-empty-query' },
					controller: { serviceParams: { name: 'test', serviceInfo: ['', 'test', 'test'] } },
					registry: {
						custom: {
							gateway: {
								value: {
									cache: {
										model: 'memory',
										services: {
											test: { enabled: true, apis: { 'GET /test': { enabled: true, ttl: 30000 } } }
										}
									}
								}
							}
						}
					}
				}
			};
			let res = {
				setHeader: function() {},
				writeHead: function() { return this; },
				write: function() { return true; },
				end: function() {}
			};
			let functionMw = mw(mockConfig);
			functionMw(req, res, (error) => {
				assert.ifError(error);
				done();
			});
		});
	});

	describe("missing prerequisites", () => {
		it("should call next() when soajs object is missing", (done) => {
			let req = {
				method: 'GET'
			};
			let res = {};
			let functionMw = mw(mockConfig);
			functionMw(req, res, (error) => {
				assert.ifError(error);
				done();
			});
		});

		it("should call next() when tenant is missing", (done) => {
			let req = {
				method: 'GET',
				soajs: {
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

		it("should call next() when controller is missing", (done) => {
			let req = {
				method: 'GET',
				soajs: {
					tenant: { id: '123' },
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
