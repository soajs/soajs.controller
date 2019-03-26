"use strict";

const http = require('http');
const request = require('request');

const helper = require("../../helper.js");
helper.requireModule('./lib/http');
const enhancer_mw = helper.requireModule('./mw/enhancer/index');
const assert = require('assert');

describe("Unit test for: lib - http", function () {
    let what2expect = {ip: '127.0.0.1', HATask: null, fetched: null};
    let server = null;
    let port = 6000;
    it("Create http server", function (done) {
        server = http.createServer(function (req, res) {
            enhancer_mw()(req, res, () => {
                let ip = req.getClientIP();
                let uAgent = req.getClientUserAgent();
                assert.ok(ip);
                res.writeHead(200, {'Content-Type': 'image/x-icon'});
                return res.end();
            });
        });
        server.listen(port, function (err) {

        });
        done();
    });
    it("Vanilla test", function (done) {
        let requestOptions = {
            'method': "get",
            'uri': "http://127.0.0.1:6000",
            'timeout': 1000 * 3600,
            'jar': false
        };
        request(requestOptions, (error, response) => {
            done();
        });
    });
});