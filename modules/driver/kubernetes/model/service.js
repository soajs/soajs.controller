/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

'use strict';

const wrapper = require('./wrapper.js');

let bl = {
	
	"getOne": (client, options, cb) => {
		if (!options || !options.namespace || !options.name) {
			return cb(new Error("service getOne: options is required with {namespace, and name}"));
		}
		wrapper.service.get(client, {namespace: options.namespace, name: options.name}, (error, item) => {
			return cb(error, item);
		});
	},
	"get": (client, options, cb) => {
		if (!options || !options.namespace) {
			return cb(new Error("service get: options is required with {namespace}"));
		}
		wrapper.service.get(client, {namespace: options.namespace, qs: options.filter || null}, (error, items) => {
			return cb(error, items);
		});
	},
	"getIps": (client, options, cb) => {
		if (!options || !options.namespace || !options.name) {
			return cb(new Error("service getIps: options is required with {namespace, and name}"));
		}
		wrapper.service.get(client, {namespace: options.namespace, name: options.name}, (error, item) => {
			if (item && item.spec && item.spec.clusterIP) {
				let response = {
					"ip": item.spec.clusterIP,
					"ports": item.spec.ports
				};
				if (item.spec.type === "LoadBalancer") {
					response.extIp = item.status.loadBalancer.ingress[0].ip;
				}
				return cb(null, response);
				
			} else {
				return cb(error, null);
			}
		});
	}
};
module.exports = bl;