'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);

// const request = require('request');
const { httpRequestLight } = require("../../lib/request.js");
const http = require('http');
// const querystring = require('querystring');

module.exports = (configuration) => {

	let core = configuration.core;
	let isRequestAuthorized = require("./lib/isRequestAuthorized.js");
	let preRedirect = require("./lib/preRedirect.js");

	/**
	 *
	 * @param req
	 * @param res
	 * @returns {*}
	 */
	return (req, res) => {
		preRedirect(req, res, core, function (obj) {
			let log_monitor_triggered = false;
			let requestOptions = {
				'method': req.method.toUpperCase(),
				'uri': obj.uri,
				//'timeout': obj.requestTO * 1000,
				'headers': req.headers,
				// 'jar': false
			};
			if (obj.config.authorization) {
				isRequestAuthorized(req, core, requestOptions);
			}

			let restServiceParams = req.soajs.controller.serviceParams;
			try {
				let log_monitor = (doc) => {
					if (log_monitor_triggered) {
						return;
					}
					log_monitor_triggered = true;
					let soamonitor = "soamonitor";
					let soamonitorVersion = "1";
					let port = get(["registry", "services", "soamonitor", "port"], req.soajs);
					if (!port) {
						port = "4050";
					}
					let api = "/monitor/item";

					req.soajs.awareness.getHost(soamonitor, soamonitorVersion, function (host) {
						if (!host) {
							req.soajs.log.debug('Unable to find any healthy host for service ' + soamonitor);
						} else {
							if (doc && doc.body) {
								doc.body = doc.body.toString();
							}
							if (doc && doc.response) {
								doc.response = doc.response.toString();
							}
							let uri = "http://" + host + ":" + port + api;
							let options = {
								"method": "POST",
								"uri": uri,
								"data": doc,
								"json": true
							};
							if (req.headers && req.headers.soajsinjectobj) {
								options.headers = { "soajsinjectobj": req.headers.soajsinjectobj };
							}
							httpRequestLight(options)
								.then((body) => {
									if (body && !body.result) {
										req.soajs.log.debug(body);
									}
								})
								.catch((error) => {
									req.soajs.log.debug('Unable register monitor: ' + error.message);
								});

							// let uri = 'http://' + host + ':' + port + api;
							// let options = {
							// 	'uri': uri,
							// 	"body": doc,
							// 	"json": true
							// };
							// if (req.headers && req.headers.soajsinjectobj) {
							// 	options.headers = { "soajsinjectobj": req.headers.soajsinjectobj };
							// }
							// request.post(options, (error, response, body) => {
							// 	if (error) {
							// 		req.soajs.log.debug('Unable register monitor: ' + error.message);
							// 	}
							// 	if (body && !body.result) {
							// 		req.soajs.log.debug(body);
							// 	}
							// });
						}
					});
				};
				let monitor = get(["registry", "custom", "gateway", "value", "gotoService", "monitor"], req.soajs);
				let monitoObj = {
					"time": {}
				};
				let monitor_service_blacklist = false;
				if (monitor && monitor.blacklist) {
					if (Array.isArray(monitor.blacklist) && monitor.blacklist.length > 0) {
						if (monitor.blacklist.includes(req.soajs.controller.serviceParams.name)) {
							monitor_service_blacklist = true;
						}
					}
				}
				if (monitor && monitor.whitelist) {
					if (Array.isArray(monitor.whitelist) && monitor.whitelist.length > 0) {
						monitor_service_blacklist = true;
						if (monitor.whitelist.includes(req.soajs.controller.serviceParams.name)) {
							monitor_service_blacklist = false;
						}
					}
				}
				if (monitor && !monitor_service_blacklist) {
					monitoObj.name = req.soajs.controller.serviceParams.name;
					monitoObj.version = req.soajs.controller.serviceParams.version;
					monitoObj.api = req.soajs.controller.serviceParams.parsedUrl.pathname;
					monitoObj.method = req.method;
					monitoObj.time.req_start = new Date().getTime();
				}
				if (monitor && !monitor_service_blacklist && monitor.req_info) {
					monitoObj.port = req.soajs.controller.serviceParams.registry.port;
					monitoObj.url = req.soajs.controller.serviceParams.url;
					monitoObj.host = req.host;
				}
				if (monitor && !monitor_service_blacklist && monitor.req_header) {
					monitoObj.headers = req.headers;
				}
				if (monitor && !monitor_service_blacklist && monitor.req_query) {
					monitoObj.query = req.query;
				}

				// Trigger request
				req.soajs.controller.redirectedRequest = http.request(requestOptions.uri, requestOptions);
				// req.soajs.controller.redirectedRequest = request(requestOptions);


				//NOTE: on request
				// Handle error event for both with monitor and without monitor
				req.soajs.controller.redirectedRequest.on('error', (err) => {
					req.soajs.log.error(err.message + ' with [' + restServiceParams.name + (restServiceParams.version ? ('@' + restServiceParams.version) : '') + ']');
					if (req.soajs.controller.redirectedRequest) {
						req.soajs.controller.redirectedRequest.destroy();
						req.soajs.controller.redirectedRequest = null;
					}
					if (!req.soajs.controller.monitorEndingReq) {
						req.soajs.controllerResponse(core.error.getError(135));
					}
					if (monitor && !monitor_service_blacklist && monitor.req_response) {
						monitoObj.time.res_end = new Date().getTime();
						log_monitor(monitoObj);
					}
				});
				//Handle body
				if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
					if (monitor && !monitor_service_blacklist && monitor.req_body) {
						let allowedContentType = false;
						let isStream = false;
						req.on("data", (chunk) => {
							req.soajs.controller.redirectedRequest.write(chunk);
							let resContentType = req.headers['content-type'];
							if (resContentType) {
								if (!allowedContentType) {
									allowedContentType = resContentType.match(/application\/json|text\/plain/i);
								}
								if (!isStream) {
									isStream = resContentType.match(/stream/i);
								}
							}
							if (!isStream && allowedContentType) {
								if (!monitoObj.body) {
									monitoObj.time.req_body_start = new Date().getTime();
									monitoObj.body = chunk;
								} else {
									monitoObj.body += chunk;
								}
							} else {
								monitoObj.body = "{\"contentType\": \"is stream or not allowed\", \"value': \"" + resContentType + "\"}";
							}
						});
						req.on("end", () => {
							let resContentType = req.headers['content-length'];
							if (resContentType) {
								if (!allowedContentType) {
									allowedContentType = resContentType.match(/application\/json|text\/plain/i);
								}
								if (!isStream) {
									isStream = resContentType.match(/stream/i);
								}
							}
							if (!isStream) {
								if (req.soajs.controller.redirectedRequest) {
									req.soajs.controller.redirectedRequest.end();
								}
							}
							if (!isStream && allowedContentType) {
								monitoObj.time.req_body_end = new Date().getTime();
							}
						});
					}
				}
				req.pipe(req.soajs.controller.redirectedRequest);

				// Handle response
				//NOTE: on request
				req.soajs.controller.redirectedRequest.on("response", (response) => {
					if (!res.headersSent) {
						res.writeHeader(response.statusCode, response.headers);
					}
					if (requestOptions.method !== 'HEAD') {
						if (monitor && !monitor_service_blacklist && monitor.req_response) {
							let allowedContentType = false;
							let isStream = false;
							monitoObj.time.res_start = new Date().getTime();
							// });

							//NOTE: on response
							// req.soajs.controller.redirectedRequest.on("data", (chunk) => {
							response.on("data", (chunk) => {
								res.write(chunk);
								let resContentType = res.getHeader('content-type');
								if (resContentType) {
									if (!allowedContentType) {
										allowedContentType = resContentType.match(/application\/json|text\/plain/i);
									}
									if (!isStream) {
										isStream = resContentType.match(/stream/i);
									}
								}
								if (!isStream && allowedContentType) {
									if (!monitoObj.response) {
										monitoObj.response = chunk;
									} else {
										monitoObj.response += chunk;
									}
								} else {
									monitoObj.response = "{\"contentType\": \"is stream or not allowed\", \"value': \"" + resContentType + "\"}";
								}
							});

							//NOTE: on response
							// req.soajs.controller.redirectedRequest.on("end", () => {
							response.on("end", () => {
								let resContentType = res.getHeader('content-type');
								if (resContentType) {
									if (!isStream) {
										isStream = resContentType.match(/stream/i);
									}
								}
								if (!isStream) {
									res.end();
								}
								monitoObj.time.res_end = new Date().getTime();
								log_monitor(monitoObj);
							});

							//NOTE: on response
							// req.soajs.controller.redirectedRequest.on("close", () => {
							response.on("error", () => {
								if (!req.soajs.controller.monitorEndingReq) {
									req.soajs.controllerResponse(core.error.getError(135));
								}
								monitoObj.time.res_end = new Date().getTime();
								log_monitor(monitoObj);
							});
						} else {
							response.pipe(res);
						}
					} else {
						res.end();
					}
				});
			} catch (e) {
				req.soajs.log.error(e.message + ' @catch with [' + restServiceParams.name + (restServiceParams.version ? ('@' + restServiceParams.version) : '') + ']');
				if (req.soajs.controller.redirectedRequest) {
					req.soajs.controller.redirectedRequest.destroy();
					req.soajs.controller.redirectedRequest = null;
				}
				if (!req.soajs.controller.monitorEndingReq) {
					return req.soajs.controllerResponse(core.error.getError(135));
				}
			}
		});
	};
};