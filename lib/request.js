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

function fetchData(uri) {
    return new Promise((resolve, reject) => {
        const req = http.get(uri, (res) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error(`Status Code: ${res.statusCode}`));
            }

            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(data); // Attempt to parse as JSON
                    resolve(parsedData);
                } catch (error) {
                    resolve(data); // Resolve with the raw data if JSON parsing fails
                }
            });

            res.on('error', reject); // Handle response errors
        });

        req.on('error', reject); // Handle request errors (e.g., network issues)

        req.end(); // Important: signal that the request is finished
    });
}

function postDataLight({ uri, data, method, headers = null, json = true }) {
    return new Promise((resolve, reject) => {
        const urlObj = new uri(uri);

        const postDataString = json ? JSON.stringify(data) : data.toString();

        const options = {
            "hostname": urlObj.hostname,
            "port": urlObj.port,
            "path": urlObj.pathname + urlObj.search,
            "method": method.toUpperCase(),
            "headers": {
                'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postDataString),
            },
        };
        if (headers) {
            headers.forEach(x => {
                options.headers[x] = headers[x];
            });
        }

        const req = http.request(options, (res) => {
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

        req.write(postDataString);
        req.end();
    });
}

function postData({ uri, data, method, headers = null, json = true }) {
    return new Promise((resolve, reject) => {
      const urlObj = new uri(uri);
  
      const postDataString = json ? JSON.stringify(data) : data.toString();
  
      const options = {
        "hostname": urlObj.hostname,
        "port": urlObj.port,
        "path": urlObj.pathname + urlObj.search,
        "method": method.toUpperCase(),
        "headers": {
          'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postDataString),
        },
      };
      if (headers) {
          headers.forEach(x => {
              options.headers[x] = headers[x];
          });
      }
  
      const req = http.request(options, (res) => {
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
  
      req.write(postDataString);
      req.end();
    });
  }

module.exports = { checkStatus, fetchData, postData, postDataLight };
