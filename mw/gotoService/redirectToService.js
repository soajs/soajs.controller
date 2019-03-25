'use strict';

const request = require('request');

module.exports = (configuration) => {

    let isRequestAuthorized = require("./lib/isRequestAuthorized.js");
    let preRedirect = require("./lib/preRedirect.js");

    /**
     *
     * @param req
     * @param res
     * @returns {*}
     */
    return (req, res) => {
        preRedirect(req, res, function (obj) {
            let requestOptions = {
                'method': req.method,
                'uri': obj.uri,
                'timeout': 1000 * 3600,
                'headers': req.headers,
                'jar': false
            };
            if (obj.config.authorization)
                isRequestAuthorized(req, requestOptions);

            req.soajs.controller.redirectedRequest = request(requestOptions);
            req.soajs.controller.redirectedRequest.on('error', function (err) {
                req.soajs.log.error(err);
                try {
                    return req.soajs.controllerResponse(core.error.getError(135));
                } catch (e) {
                    req.soajs.log.error(e);
                }
            });

            if (req.method === 'POST' || req.method === 'PUT') {
                req.pipe(req.soajs.controller.redirectedRequest).pipe(res);
            } else {
                req.soajs.controller.redirectedRequest.pipe(res);
            }
        });
    };
};