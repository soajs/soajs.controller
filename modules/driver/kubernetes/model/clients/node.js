/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

'use strict';


const node = {
	/**
	 * Node Wrapper
	 */
	get(deployer, opts, cb) {
		async function main() {
			if (opts.name) {
				return await deployer.api.v1.nodes(opts.name).get({qs: opts.qs});
			} else {
				return await deployer.api.v1.nodes.get({qs: opts.qs});
			}
		}
		
		main().then((result) => {
			return cb(null, result.body);
		}).catch((err) => {
			return cb(err);
		});
	}
};

module.exports = node;
