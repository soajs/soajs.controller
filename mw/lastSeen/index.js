'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const { httpRequest } = require("../../lib/request.js");
const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);

/**
 *
 * @param configuration
 * @returns {Function}
 */
module.exports = () => {

    return (req, res, next) => {
        next();

        if (req.soajs.uracDriver) {
            let lastSeen = get(["soajs", "registry", "custom", "gateway", "value", "lastSeen"], req);
            if (lastSeen && lastSeen.active) {

                const item = {
                    "name": lastSeen.serviceName || "urac",
                    "version": lastSeen.serviceVersion || "3",
                    "api": lastSeen.api || "/user/last/seen"
                };

                let userId = null;
                let uracObj = req.soajs.uracDriver.getProfile();
                if (uracObj) {
                    userId = uracObj._id;
                }
                if (userId) {
                    req.soajs.awareness.getHost(item.name, item.version, (host) => {
                        if (host) {
                            item.host = host;
                            item.port = req.soajs.registry.services[item.name].port;

                            let options = {
                                "uri": "http://" + item.host + ":" + item.port + item.api,
                                "json": true,
                                "method": "POST"
                            };
                            if (lastSeen.network) {
                                options.body = { "network": lastSeen.network };
                            }
                            if (req.headers && req.headers.soajsinjectobj) {
                                options.headers = { "soajsinjectobj": req.headers.soajsinjectobj };
                            }
                            httpRequest(options)
                                .then(() => { })
                                .catch(({ error, body }) => {
                                    if (error) {
                                        req.soajs.log.debug("lastSeen failed for [" + item.name + "@" + item.version + " " + item.api + "]");
                                        req.soajs.log.debug("lastSeen " + error.message);
                                    } else {
                                        req.soajs.log.debug("lastSeen ", body);
                                    }
                                    // else if (!body.result) {
                                    //     let errorMsg = "";
                                    //     if (body.errors && body.errors && body.errors.details && body.errors.details.length > 0) {
                                    //         body.errors.details.forEach((detail) => {
                                    //             if (errorMsg === "") {
                                    //                 errorMsg += detail.message;
                                    //             }
                                    //             else {
                                    //                 errorMsg += " - " + detail.message;
                                    //             }
                                    //         });
                                    //     }
                                    //     req.soajs.log.debug("lastSeen", errorMsg);
                                    // }
                                });

                            // let options = {
                            //     method: "post",
                            //     uri: "http://" + item.host + ":" + item.port + item.api,
                            //     json: true
                            // };
                            // if (req.headers && req.headers.soajsinjectobj) {
                            //     options.headers = { "soajsinjectobj": req.headers.soajsinjectobj };
                            // }
                            // request(options, (error, response, body) => {
                            //     if (error) {
                            //         req.soajs.log.debug("lastSeen failed for [" + item.name + "@" + item.version + " " + item.api + "]");
                            //         req.soajs.log.debug("lastSeen " + error.message);
                            //     } else if (!body.result) {
                            //         let errorMsg = "";
                            //         if (body.errors && body.errors && body.errors.details && body.errors.details.length > 0) {
                            //             body.errors.details.forEach((detail) => {
                            //                 if (errorMsg === "") {
                            //                     errorMsg += detail.message;
                            //                 }
                            //                 else {
                            //                     errorMsg += " - " + detail.message;
                            //                 }
                            //             });
                            //         }
                            //         req.soajs.log.debug("lastSeen", errorMsg);
                            //     }
                            // });
                        } else {
                            req.soajs.log.debug("lastSeen failed with no host for [" + item.name + "@" + item.version + " " + item.api + "]");
                        }
                    });
                } else {
                    req.soajs.log.debug("lastSeen failed with no userId for [" + item.name + "@" + item.version + " " + item.api + "]");
                }
            }
        }
    };
};