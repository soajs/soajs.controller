"use strict";

const url = require('url');
const helper = require("../../helper.js");
const lib = helper.requireModule('./lib/parseURL');
const assert = require('assert');

describe("Unit test for: lib - parseURL", () => {
    let uri = '/micro2/v1.1/hello';
    let parsedURL = url.parse(uri, true);
    it("Vanilla test with v1.1", (done) => {
        let response = lib(uri, parsedURL);
        assert.deepStrictEqual(response.name, 'micro2', "lib.parseURL vanilla test with v1.1 failed for name");
        assert.deepStrictEqual(response.service_v, '1.1', "lib.parseURL vanilla test with v1.1 failed version");
        done();
    });
    it("Vanilla test with :1.1", (done) => {
        uri = '/micro2:1.1/hello';
        parsedURL = url.parse(uri, true);
        let response = lib(uri, parsedURL);
        assert.deepStrictEqual(response.name, 'micro2', "lib.parseURL vanilla test with 1:1 failed for name");
        assert.deepStrictEqual(response.service_v, '1.1', "lib.parseURL vanilla test with 1:1 failed version");
        done();
    });
});