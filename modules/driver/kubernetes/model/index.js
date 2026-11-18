/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

'use strict';

const _service = require("./service.js");
const _node = require("./node.js");

// @kubernetes/client-node is loaded on the first connect: only gateways using the Kubernetes
// driver need it.
let k8s = null;

function client() {
	if (!k8s) {
		k8s = require('@kubernetes/client-node');
	}
	return k8s;
}

const NAME = "soajs";

/**
 * The cluster and user of a connection, from the deployer's configuration:
 * - with config.ca (requestOptions and authProvider, as written by soajs.infra): the cluster at
 *   requestOptions.baseUrl with its CA, and requestOptions.auth when given, else the token;
 * - otherwise: the cluster at config.url with the token, without verifying its certificate.
 */
function clusterAndUser(config) {
	let cluster = {"name": NAME, "server": config.url, "skipTLSVerify": true};
	let user = {"name": NAME, "token": config.token};
	if (config.ca) {
		const ro = config.ca.requestOptions || {};
		cluster = {"name": NAME, "server": ro.baseUrl, "skipTLSVerify": ro.strictSSL === false || ro.rejectUnauthorized === false};
		if (ro.ca) {
			cluster.caData = Buffer.from(ro.ca).toString("base64");
		}
		if (ro.auth && ro.auth.bearer) {
			user = {"name": NAME, "token": ro.auth.bearer};
		} else if (ro.auth && (ro.auth.user || ro.auth.username)) {
			user = {"name": NAME, "username": ro.auth.user || ro.auth.username, "password": ro.auth.pass || ro.auth.password};
		}
		if (ro.cert) {
			user.certData = Buffer.from(ro.cert).toString("base64");
		}
		if (ro.key) {
			user.keyData = Buffer.from(ro.key).toString("base64");
		}
	}
	return {cluster, user};
}

let driver = {
	"connect": (config, cb) => {
		if (!config.token) {
			return cb(new Error('Connect error: No valid access token found for the kubernetes cluster'));
		}
		if (!config.url) {
			return cb(new Error('Connect error: No valid url found for the kubernetes cluster'));
		}
		try {
			const k = client();
			const {cluster, user} = clusterAndUser(config);
			if (!cluster.server) {
				return cb(new Error('Connect error: No valid url found for the kubernetes cluster'));
			}
			const kubeconfig = new k.KubeConfig();
			kubeconfig.loadFromOptions({
				"clusters": [cluster],
				"users": [user],
				"contexts": [{"name": NAME, "cluster": NAME, "user": NAME}],
				"currentContext": NAME
			});
			return cb(null, {
				"kubeconfig": kubeconfig,
				"server": cluster.server.replace(/\/+$/, ""),
				"http": new k.IsomorphicFetchHttpLibrary()
			});
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
