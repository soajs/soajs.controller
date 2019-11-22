"use strict";

const helper = require("../../../../helper.js");
const mwLib = helper.requireModule('./mw/gotoService/lib/isRequestAuthorized');


describe("Unit test for: mw - gotoService lib isRequestAuthorized", function () {

    let req = {
        headers: {
            soajsauth: "wwwwww"
        },
        soajs: {
            controller: {
                serviceParams: {
                    parsedUrl: {
                        query: {
                            soajsauth: "wwwwww"
                        }
                    }
                }
            },
            registry: {serviceConfig: {session: {name: "qqq"}}}
        },
    };
    let core = {
        security: {
            authorization: {
                setCookie: () => {
                    return "coockie";
                }
            }
        }
    };
    let requestOptions = {
        headers: {cookie: 'coockie1;coockie2'}
    };

    it("Install & Use the MW Lib - with header", function (done) {
        mwLib(req, core, requestOptions);
        console.log(requestOptions.headers.cookie);
        done();
    });

    it("Install & Use the MW Lib - without header", function (done) {
        req.headers = null;
        mwLib(req, core, requestOptions);
        console.log(requestOptions.headers.cookie);
        done();
    });
});