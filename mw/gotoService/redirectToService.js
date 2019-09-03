'use strict';

const request = require('request');

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
            let requestOptions = {
                'method': req.method,
                'uri': obj.uri,
                //'timeout': obj.requestTO * 1000,
                'headers': req.headers,
                'jar': false
            };
            if (obj.config.authorization)
                isRequestAuthorized(req, core, requestOptions);

            try {
                req.soajs.controller.redirectedRequest = request(requestOptions);
                req.soajs.controller.redirectedRequest.on('error', function (err) {
                    req.soajs.log.error(err);
                    if (!req.soajs.controller.monitorEndingReq) {
                        return req.soajs.controllerResponse(core.error.getError(135));
                    }

                });

                if (req.method === 'POST' || req.method === 'PUT') {
                    req.pipe(req.soajs.controller.redirectedRequest).pipe(res);
                } else {
                    req.soajs.controller.redirectedRequest.pipe(res);
                }
            } catch (e) {
                req.soajs.log.error(e);
                if (!req.soajs.controller.monitorEndingReq) {
                    return req.soajs.controllerResponse(core.error.getError(135));
                }
            }
        });
    };
};