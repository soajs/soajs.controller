"use strict";
const assert = require('assert');
let request = require("request");

function requester(method, params, cb) {
	let requestOptions = {
		// timeout: 30000,
		'uri': params.uri,
		'json': params.body || true
	};
	if (!params.headers) {
		params.headers = {};
	}
	params.headers['user-agent'] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2227.1 Safari/537.36";
	
	if (params.headers) {
		requestOptions.headers = params.headers;
	}
	if (params.authorization) {
		requestOptions.headers.authorization = params.authorization;
	}
	if (params.qs) {
		requestOptions.qs = params.qs;
	}
	if (params.form !== undefined) {
		requestOptions.form = params.form;
	}
	
	if (method === 'delete') {
		request.del(requestOptions, function (error, response, body) {
			assert.ifError(error);
			assert.ok(body);
			return cb(null, body);
		});
	} else if (method === 'head') {
		request.head(requestOptions, function (error, response, body) {
			assert.ifError(error);
			assert.ifError(body);
			assert.ok(response.headers);
			return cb(null, response.headers);
		});
	} else if (method === 'options') {
		request.options(requestOptions, function (error, response, body) {
			assert.ifError(error);
			assert.ifError(body);
			assert.ok(response.headers);
			return cb(null, response.headers);
		});
	} else {
		request[method](requestOptions, function (error, response, body) {
			assert.ifError(error);
			assert.ok(body);
			return cb(null, body);
		});
	}
}

module.exports = requester;
