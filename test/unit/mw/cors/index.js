"use strict";

const helper = require("../../../helper.js");
const mw = helper.requireModule('./mw/cors/index');
const assert = require('assert');

describe("Unit test for: mw - cors", function () {
    let req = {
        "soajs": {
            "registry": {
                "serviceConfig": {
                    "cors": {
                        "enabled": true,
                        "origin": "*",
                        "credentials": "true",
                        "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
                        "headers": "key,soajsauth,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type",
                        "maxage": 1728000
                    }
                }
            }
        }
    };
    let res = {
        "setHeader": (msg, data) => {
            res.header[msg] = data;
        },
        "header": {},
        "end": () => {
        }
    };

    it("Install & Use the MW", function (done) {
        let mw_use = mw({});
        mw_use(req, res, () => {
            assert.ok(true);
            done();
        });
    });

    it("Run MW with OPTION as method", function (done) {
        req.method = "OPTIONS";
        res.end = () => {
            done();
        };
        let mw_use = mw({});
        mw_use(req, res, () => {
        });
    });
});