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

            let connector = http.request(requestOptions, function (serverResponse) {
                serverResponse.pause();
                serverResponse.headers['access-control-allow-origin'] = '*';

                res.writeHeader(serverResponse.statusCode, serverResponse.headers);
                serverResponse.pipe(res, {end: true});
                serverResponse.resume();
            });
            connector.on('aborted', function (err) {
                req.soajs.log.error(err);
                try {
                    return req.soajs.controllerResponse(core.error.getError(135));
                } catch (e) {
                    req.soajs.log.error(e);
                }
            });
            req.pipe(connector, {end: true});
            req.resume();
        });
    };
};
