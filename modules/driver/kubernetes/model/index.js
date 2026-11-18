/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

'use strict';

/* jshint esversion: 11 */

const _service = require("./service.js");
const _node = require("./node.js");

// @kubernetes/client-node is an ES module that needs Node.js 22.19 or later. It is imported on the
// first connect, so only gateways using the Kubernetes driver load it, and with import(), so it
// never loads inside another module's evaluation.
const MIN_NODE = [22, 19];
const UNSUPPORTED = "Kubernetes driver needs Node.js " + MIN_NODE.join(".") + " or later";
let loading = null;

function supported(version) {
	const [major, minor] = String(version).split(".").map(Number);
	return major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1]);
}

function load() {
	if (!loading) {
		loading = import('@kubernetes/client-node').catch((e) => {
			loading = null;
			throw e;
		});
	}
	return loading;
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
		if (!supported(process.versions.node)) {
			return cb(new Error(UNSUPPORTED));
		}
		const {cluster, user} = clusterAndUser(config);
		if (!cluster.server) {
			return cb(new Error('Connect error: No valid url found for the kubernetes cluster'));
		}
		load().then((k) => {
			const kubeconfig = new k.KubeConfig();
			kubeconfig.loadFromOptions({
				"clusters": [cluster],
				"users": [user],
				"contexts": [{"name": NAME, "cluster": NAME, "user": NAME}],
				"currentContext": NAME
			});
			return {
				"k8s": k,
				"kubeconfig": kubeconfig,
				"server": cluster.server.replace(/\/+$/, ""),
				"http": new k.IsomorphicFetchHttpLibrary()
			};
		}).then((client) => {
			// out of the promise chain: an exception in cb is not turned into a rejection
			process.nextTick(() => cb(null, client));
		}, (e) => {
			process.nextTick(() => cb(e));
		});
	},
	
	// for the tests
	"supported": supported,
	
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
