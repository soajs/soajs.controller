"use strict";

const helper = require("../../helper.js");
const lib = helper.requireModule('./lib/apiPathParam2apiRegExp');
const assert = require('assert');

describe("Unit test for: lib - apiPathParam2apiRegExp", function () {
    let acl = {
        oauth: {
            access: false,
            apisPermission: "restricted",
            get: {
                apis: {
                    "/authorization": {}
                }
            },
            post: {
                apis: {
                    "/token": {}
                }
            },
            delete: {
                apis: {
                    "/accessToken/:token": {
                        access: false
                    },
                    "/refreshToken/:token": {
                        access: false
                    }
                }
            }
        }
    };
    it("Vanilla test", function (done) {
        let response = lib(acl);
        assert.ok(response.oauth.delete.apisRegExp);
        done();
    });
});