/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

'use strict';

const service = require('./clients/service.js');
const node = require('./clients/node.js');

const wrapper = {
	
	/**
	 * Service Wrapper
	 */
	service: service,
	
	/**
	 * Node Wrapper
	 */
	node: node
};

module.exports = wrapper;
