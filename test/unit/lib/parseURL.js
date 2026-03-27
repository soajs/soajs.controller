"use strict";

const helper = require("../../helper.js");
const lib = helper.requireModule('./lib/parseURL');
const assert = require('assert');

/**
 * Parse URL using WHATWG URL API and return object compatible with legacy url.parse()
 * @param {string} urlString - URL string to parse
 * @returns {Object} - Object with pathname, path, and query properties
 */
const parseURL = (urlString) => {
	const urlObj = new URL(urlString, 'http://localhost');
	const search = urlObj.search || '';
	return {
		pathname: urlObj.pathname,
		path: urlObj.pathname + search,
		query: Object.fromEntries(urlObj.searchParams)
	};
};

describe("Unit test for: lib - parseURL", () => {
    let uri = '/micro2/v1.1/hello';
    let parsedURL = parseURL(uri);
    it("Vanilla test with v1.1", (done) => {
        let response = lib(uri, parsedURL);
        assert.deepStrictEqual(response.name, 'micro2', "lib.parseURL vanilla test with v1.1 failed for name");
        assert.deepStrictEqual(response.service_v, '1.1', "lib.parseURL vanilla test with v1.1 failed version");
        done();
    });
    it("Vanilla test with :1.1", (done) => {
        uri = '/micro2:1.1/hello';
        parsedURL = parseURL(uri);
        let response = lib(uri, parsedURL);
        assert.deepStrictEqual(response.name, 'micro2', "lib.parseURL vanilla test with 1:1 failed for name");
        assert.deepStrictEqual(response.service_v, '1.1', "lib.parseURL vanilla test with 1:1 failed version");
        done();
    });
});
