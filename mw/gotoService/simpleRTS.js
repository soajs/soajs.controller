'use strict';

const url = require('url');
let http = require('http');

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
            req.pause();

            let requestOptions = url.parse(obj.uri);
            requestOptions.headers = req.headers;
            requestOptions.method = req.method;
            requestOptions.agent = false;
            requestOptions.headers['host'] = requestOptions.host;

            if (obj.config.authorization)
                isRequestAuthorized(req, core, requestOptions);

            try {
                req.soajs.controller.redirectedRequest = http.request(requestOptions, function (serverResponse) {
                    serverResponse.pause();
                    serverResponse.headers['access-control-allow-origin'] = '*';

                    res.writeHeader(serverResponse.statusCode, serverResponse.headers);
                    serverResponse.pipe(res, {end: true});
                    serverResponse.resume();
                });
                req.soajs.controller.redirectedRequest.on('error', function (err) {
                    req.soajs.log.error(err);
                    if (!req.soajs.controller.monitorEndingReq) {
                        return req.soajs.controllerResponse(core.error.getError(135));
                    }
                });
                req.pipe(req.soajs.controller.redirectedRequest, {end: true});
                req.resume();
            } catch (e) {
                req.soajs.log.error(e);
                if (!req.soajs.controller.monitorEndingReq) {
                    return req.soajs.controllerResponse(core.error.getError(135));
                }
            }
        });
    };
};
