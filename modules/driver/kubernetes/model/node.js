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
	"get": (client, options, cb) => {
		wrapper.node.get(client, {qs: options.filter || null}, (error, list) => {
			return cb(error, list);
		});
	}
};
module.exports = bl;