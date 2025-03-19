"use strict";

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const http = require('http');
const https = require('https');

function checkStatus(uri) {
    return new Promise((resolve, reject) => {
        let onResponse = false;

        const req = http.get(uri, (res) => {
            if (res.statusCode === 200) {
                onResponse = true;
                resolve(res.statusCode === 200); // Resolve with true if 200, false otherwise
            }
            // res.on('data', () => { }); // Consume data to avoid issues (important!)

            res.on('error', (err) => {
                if (!onResponse) {
                    onResponse = true;
                    return reject(err);
                }
            });
            res.on('close', () => {
                if (!onResponse) {
                    onResponse = true;
                    return reject(new Error("Closed"));
                }
            });
        });

        req.on('error', (err) => {
            if (!onResponse) {
                onResponse = true;
                return reject(err);
            }
        });
        req.on('close', () => {
            if (!onResponse) {
                onResponse = true;
                return reject(new Error("Closed"));
            }
        });


        req.end();
    });
}

function httpRequestLight({ uri, data = null, method = 'GET', headers = null, json = true }) {
    return new Promise((resolve, reject) => {
        let onResponse = false;
        let options = {};
        const requestDataString = data ? (json ? JSON.stringify(data) : data.toString()) : '';

        let urlObj = {};
        try {
            urlObj = new URL(uri);
            options = {
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
                for (const key in headers) {
                    if (headers.hasOwnProperty(key)) {
                        options.headers[key] = headers[key];
                    }
                }
            }
        } catch (error) {
            if (!onResponse) {
                onResponse = true;
                return reject(error); // Reject with error and null data for request errors
            }
        }
        // const req = http.request(options);
        let req = null;
        if (urlObj.protocol === "https:") {
            req = https.request(options);
        } else {
            req = http.request(options);
        }

        req.on('response', (res) => { // Listen for the 'response' event
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error(`Status Code: ${res.statusCode}`));
            }

            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {

                if (!onResponse) {
                    onResponse = true;
                    try {
                        const parsedData = json ? JSON.parse(responseData) : responseData;
                        return resolve(parsedData);
                    } catch (error) {
                        return resolve(responseData);
                    }
                }
            });

            res.on('error', (err) => {
                if (!onResponse) {
                    onResponse = true;
                    return reject(err);
                }
            });
            res.on('close', () => {
                if (!onResponse) {
                    onResponse = true;
                    return reject(new Error("Closed"));
                }
            });
        });

        req.on('error', (err) => {
            if (!onResponse) {
                onResponse = true;
                return reject(err);
            }
        });
        req.on('close', () => {
            if (!onResponse) {
                onResponse = true;
                return reject(new Error("Closed"));
            }
        });

        if (data) {
            req.write(requestDataString);
        }

        req.end();
    });
}

function httpRequest({ uri, data = null, body = null, qs = null, method = 'GET', headers = null, json = true }) {
    return new Promise((resolve, reject) => {
        data = data || body; // to be compatible with request package

        let onResponse = false;
        let options = {};
        let urlObj = {};

        const requestDataString = data ? (json ? JSON.stringify(data) : data.toString()) : '';
        try {
            urlObj = new URL(uri);

            if (qs) {
                // Merge query parameters into the path
                const existingParams = new URLSearchParams(urlObj.search);
                const mergedParams = new URLSearchParams();

                // Add existing params
                existingParams.forEach((value, key) => {
                    mergedParams.append(key, value);
                });
                // Add/override queryParams
                for (const key in qs) {
                    if (qs.hasOwnProperty(key)) {
                        mergedParams.set(key, qs[key]);
                    }
                }
                urlObj.search = mergedParams.toString();
            }

            options = {
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
                for (const key in headers) {
                    if (headers.hasOwnProperty(key)) {
                        options.headers[key] = headers[key];
                    }
                }
            }
        } catch (error) {
            if (!onResponse) {
                onResponse = true;
                return reject({ error: error, body: null }); // Reject with error and null data for request errors
            }
        }
        // const req = http.request(options);
        let req = null;
        if (urlObj.protocol === "https:") {
            req = https.request(options);
        } else {
            req = http.request(options);
        }

        req.on('response', (res) => { // Listen for the 'response' event
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                if (!onResponse) {
                    onResponse = true;
                    if (res.statusCode < 200 || res.statusCode >= 300) {
                        const error = new Error(`Status Code: ${res.statusCode}`);
                        try {
                            const parsedData = json ? JSON.parse(responseData) : responseData;
                            return reject({ error: error, body: parsedData }); // Reject with error and data
                        } catch (parseError) {
                            return reject({ error: error, body: responseData }); // Reject with error and raw data if parse fails
                        }
                    }

                    try {
                        const parsedData = json ? JSON.parse(responseData) : responseData;
                        return resolve(parsedData);
                    } catch (parseError) {
                        return resolve(responseData);
                    }
                }
            });

            res.on('close', () => {
                if (!onResponse) {
                    onResponse = true;
                    return reject({ error: new Error("Closed"), body: null }); // Reject with error and null data for request errors
                }
            });
            res.on('error', (error) => {
                if (!onResponse) {
                    onResponse = true;
                    return reject({ error: error, body: null }); // Reject with error and null data for request errors
                }
            });
        });

        req.on('close', () => {
            if (!onResponse) {
                onResponse = true;
                return reject({ error: new Error("Closed"), body: null }); // Reject with error and null data for request errors
            }
        });
        req.on('error', (error) => {
            if (!onResponse) {
                onResponse = true;
                return reject({ error: error, body: null }); // Reject with error and null data for request errors
            }
        });

        if (data) {
            req.write(requestDataString);
        }
        req.end();
    });
}

function proxyRequest(req, res, options, extraOptions = {}) {
    return new Promise((resolve, reject) => {
        let onResponse = false;

        // const proxyReq = http.request(options);
        let proxyReq = null;
        if (options.protocol === "https:") {
            proxyReq = https.request(options);
        } else {
            proxyReq = http.request(options);
        }
        if (extraOptions && extraOptions.fetchProxReq) {
            extraOptions.fetchProxReq(proxyReq);
        }
        proxyReq.on('response', (proxyRes) => {
            if (extraOptions && extraOptions.resHeaders) {
                extraOptions.resHeaders.forEach(x => {
                    proxyRes.headers[x] = extraOptions.resHeaders[x];
                });
            }
            res.writeHead(proxyRes.statusCode, proxyRes.headers); // Forward status code and headers
            if (options.method !== 'HEAD') {

                proxyRes.on('end', () => {
                    if (!onResponse) {
                        onResponse = true;
                        return resolve(); // Resolve when the proxy response ends
                    }
                });

                proxyRes.on('close', () => {
                    if (!onResponse) {
                        onResponse = true;
                        return reject(new Error("Closed")); // Reject if the proxy response encounters an error
                    }
                });
                proxyRes.on('error', (err) => {
                    if (!onResponse) {
                        onResponse = true;
                        return reject(err); // Reject if the proxy response encounters an error
                    }
                });

                proxyRes.pipe(res); // Pipe the proxy response to the original response
            } else {
                onResponse = true;
                res.end(); // End response immediately for HEAD requests
                return resolve();
            }
        });

        req.pipe(proxyReq); // Pipe the original request to the proxy request

        proxyReq.on('close', () => {
            if (!onResponse) {
                onResponse = true;
                return reject(new Error("Closed")); // Reject if the proxy request encounters an error
            }
        });
        proxyReq.on('error', (err) => {
            if (!onResponse) {
                onResponse = true;
                return reject(err); // Reject if the proxy request encounters an error
            }
        });
    });
}

function proxyRequestMonitor(req, res, options, extraOptions = {}) {
    return new Promise((resolve, reject) => {
        let onResponse = false;

        const proxyReq = http.request(options);
        if (extraOptions && extraOptions.fetchProxReq) {
            extraOptions.fetchProxReq(proxyReq);
        }
        proxyReq.on('response', (proxyRes) => {
            if (extraOptions && extraOptions.resHeaders) {
                extraOptions.resHeaders.forEach(x => {
                    proxyRes.headers[x] = extraOptions.resHeaders[x];
                });
            }
            if (!res.headersSent) {
                res.writeHead(proxyRes.statusCode, proxyRes.headers); // Forward status code and headers
            }
            let resContentType = proxyRes.headers['content-type'];

            if (extraOptions && extraOptions.events && extraOptions.events.response) {
                extraOptions.events.response(resContentType);
            }

            if (options.method !== 'HEAD') {
                if (extraOptions && extraOptions.events && extraOptions.events.data) {
                    proxyRes.on('data', (chunk) => {
                        extraOptions.events.data(chunk);
                    });
                }
                proxyRes.on('end', () => {
                    if (!onResponse) {
                        onResponse = true;
                        return resolve(); // Resolve when the proxy response ends
                    }
                });

                proxyRes.on('close', () => {
                    if (!onResponse) {
                        onResponse = true;
                        return reject(new Error("Closed")); // Reject if the proxy response encounters an error
                    }
                });
                proxyRes.on('error', (err) => {
                    if (!onResponse) {
                        onResponse = true;
                        return reject(err); // Reject if the proxy response encounters an error
                    }
                });

                proxyRes.pipe(res); // Pipe the proxy response to the original response
            } else {
                onResponse = true;
                res.end(); // End response immediately for HEAD requests
                return resolve();
            }
        });

        req.pipe(proxyReq); // Pipe the original request to the proxy request

        proxyReq.on('close', () => {
            if (!onResponse) {
                onResponse = true;
                return reject(new Error("Closed")); // Reject if the proxy request encounters an error
            }
        });
        proxyReq.on('error', (err) => {
            if (!onResponse) {
                onResponse = true;
                return reject(err); // Reject if the proxy request encounters an error
            }
        });
    });
}

module.exports = { checkStatus, httpRequestLight, httpRequest, proxyRequest, proxyRequestMonitor };
