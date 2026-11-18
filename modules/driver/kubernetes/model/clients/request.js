/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

'use strict';

/**
 * get reads a path of the Kubernetes API with the connection's kubeconfig (authentication and
 * TLS from @kubernetes/client-node) and answers the API server's JSON body as it is, so the
 * driver gives the same objects as before. An error answer gives an Error with the API server's
 * Status message and the HTTP status as statusCode and code.
 */
function get(deployer, path, qs, cb) {
	// the module connect imported
	const k8s = deployer.k8s;
	async function main() {
		const url = new URL(deployer.server + path);
		if (qs) {
			for (const [name, value] of Object.entries(qs)) {
				if (value !== undefined && value !== null) {
					url.searchParams.append(name, String(value));
				}
			}
		}
		const request = new k8s.RequestContext(url.toString(), k8s.HttpMethod.GET);
		request.setHeaderParam("Accept", "application/json");
		await deployer.kubeconfig.applySecurityAuthentication(request);
		const response = await deployer.http.send(request).toPromise();
		const text = await response.body.text();
		let body = null;
		try {
			body = text ? JSON.parse(text) : null;
		} catch (e) {
			body = null;
		}
		if (response.httpStatusCode >= 200 && response.httpStatusCode < 300) {
			return body;
		}
		const error = new Error((body && body.message) || ("Kubernetes API answered " + response.httpStatusCode));
		error.statusCode = response.httpStatusCode;
		error.code = response.httpStatusCode;
		throw error;
	}
	
	main().then((body) => {
		return cb(null, body);
	}).catch((err) => {
		// a network error: its cause says what happened (e.g. connect ECONNREFUSED)
		if (err && !err.statusCode && err.cause && err.cause.message) {
			const error = new Error(err.cause.message);
			error.code = err.cause.code;
			return cb(error);
		}
		return cb(err);
	});
}

module.exports = {get};
