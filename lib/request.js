"use strict";

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const http = require('http');

function checkStatus(uri) {
    return new Promise((resolve, reject) => {
        const req = http.get(uri, (res) => {
            resolve(res.statusCode === 200); // Resolve with true if 200, false otherwise
            res.on('data', () => { }); // Consume data to avoid issues (important!)
            res.on('error', reject); // Handle response errors
        });

        req.on('error', reject); // Handle request errors

        req.end();
    });
}

function httpRequestLight({ uri, data = null, method = 'GET', headers = null, json = true }) {
    return new Promise((resolve, reject) => {
        const urlObj = new uri(uri);

        const requestDataString = data ? (json ? JSON.stringify(data) : data.toString()) : '';

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: method.toUpperCase(), // Ensure method is uppercase
            headers: {
                'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded',
                'Content-Length': data ? Buffer.byteLength(requestDataString) : 0,
            },
        };
        if (headers) {
            headers.forEach(x => {
                options.headers[x] = headers[x];
            });
        }

        const req = http.request(options);

        req.on('response', (res) => { // Listen for the 'response' event
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error(`Status Code: ${res.statusCode}`));
            }

            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const parsedData = json ? JSON.parse(responseData) : responseData;
                    resolve(parsedData);
                } catch (error) {
                    resolve(responseData);
                }
            });

            res.on('error', reject);
        });

        req.on('error', reject);

        if (data) {
            req.write(requestDataString);
        }

        req.end();
    });
}

function httpRequest({ uri, data = null, method = 'GET', headers = null, json = true }) {
    return new Promise((resolve, reject) => {
        const urlObj = new uri(uri);

        const requestDataString = data ? (json ? JSON.stringify(data) : data.toString()) : '';

        const options = {
            "hostname": urlObj.hostname,
            "port": urlObj.port,
            "path": urlObj.pathname + urlObj.search,
            "method": method.toUpperCase(),
            "headers": {
                'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded',
                'Content-Length': data ? Buffer.byteLength(requestDataString) : 0,
            },
        };
        if (headers) {
            headers.forEach(x => {
                options.headers[x] = headers[x];
            });
        }

        const req = http.request(options);

        req.on('response', (res) => { // Listen for the 'response' event
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    const error = new Error(`Status Code: ${res.statusCode}`);
                    try {
                        const parsedData = json ? JSON.parse(responseData) : responseData;
                        reject({ error: error, body: parsedData }); // Reject with error and data
                    } catch (parseError) {
                        reject({ error: error, body: responseData }); // Reject with error and raw data if parse fails
                    }
                    return;
                }

                try {
                    const parsedData = json ? JSON.parse(responseData) : responseData;
                    resolve(parsedData);
                } catch (parseError) {
                    resolve(responseData);
                }
            });

            res.on('error', (error) => {
                reject({ error: error, body: null }); // Reject with error and null data for request errors
            });
        });

        req.on('error', (error) => {
            reject({ error: error, body: null }); // Reject with error and null data for request errors
        });

        if (data) {
            req.write(requestDataString);
        }
        req.end();
    });
}

module.exports = { checkStatus, httpRequestLight, httpRequest };
