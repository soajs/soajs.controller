/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

'use strict';

const request = require("./request.js");

const services = {
	/**
	 * The namespace's services (opts.qs: labelSelector and the other list parameters), or one
	 * service by opts.name.
	 */
	get(deployer, opts, cb) {
		let path = "/api/v1/namespaces/" + encodeURIComponent(opts.namespace) + "/services";
		if (opts.name) {
			path += "/" + encodeURIComponent(opts.name);
		}
		request.get(deployer, path, opts.qs, cb);
	}
};

module.exports = services;
