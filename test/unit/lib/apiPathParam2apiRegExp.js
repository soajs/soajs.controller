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
                    },
                    "/refreshToken/:token/user/:userId": {
                        access: false
                    }
                }
            }
        }
    };
    it("Vanilla test", function (done) {
        let response = lib(acl);
        assert.ok(response.oauth.delete.apisRegExp);
        let _path = "/refreshToken/12242rde21sew/user/ed2ed23werd2wfd3"
        let test = _path.match(response.oauth.delete.apisRegExp[0].regExp);
        assert.ok(test);
        done();
    });
});