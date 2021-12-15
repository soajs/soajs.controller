/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

'use strict';

const {KubeConfig, Client} = require('kubernetes-client');
const Request = require('kubernetes-client/backends/request');
const swagger = require('./swagger/swagger.json');

const _service = require("./service.js");
const _node = require("./node.js");

const cluster = {
	name: 'my-server',
	server: 'http://server.com',
};

const user = {
	name: 'my-user',
	password: 'some-password',
};

const context = {
	name: 'my-context',
	user: user.name,
	cluster: cluster.name,
};

let driver = {
	"connect": (config, cb) => {
		if (!config.token) {
			return cb(new Error('Connect error: No valid access token found for the kubernetes cluster'));
		}
		if (!config.url) {
			return cb(new Error('Connect error: No valid url found for the kubernetes cluster'));
		}
		try {
			let backend = null;
			if (config.ca) {
				let kubeconfig = new KubeConfig();
				kubeconfig.loadFromOptions({
					clusters: [cluster],
					users: [user],
					contexts: [context],
					currentContext: context.name,
				});
				backend = new Request({kubeconfig});
				backend.requestOptions = config.ca.requestOptions;
				backend.authProvider = config.ca.authProvider;
				if (!backend.requestOptions.auth) {
					backend.requestOptions.auth = {
						"bearer": config.token
					};
				}
			} else {
				backend = new Request({
					"url": config.url,
					"auth": {
						"bearer": config.token
					},
					"insecureSkipTlsVerify": true
				});
			}
			let client = new Client({
				"backend": backend,
				"spec": swagger
			});
			return cb(null, client);
		} catch (e) {
			return cb(e);
		}
	},
	
	"get": {
		"all": {
			"service": _service.get
		},
		"one": {
			"service": _service.getOne,
		},
		"serviceIps": _service.getIps,
		"nodes": _node.get
	}
};

module.exports = driver;
