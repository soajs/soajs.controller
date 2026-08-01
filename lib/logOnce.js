'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const reported = new Set();

/**
 * Log a message once per distinct key.
 *
 * Static misconfiguration is discovered inside the request path, so reporting it
 * normally would repeat on every request for the lifetime of the process. The
 * condition cannot resolve itself without a registry change, so the first report
 * carries all the information the rest would.
 *
 * @param log    the soajs logger
 * @param level  one of the logger levels, ex: error
 * @param key    identifies the condition, repeats with the same key are dropped
 * @param message
 */
function logOnce(log, level, key, message) {
	if (reported.has(key)) {
		return false;
	}
	if (!log || typeof log[level] !== "function") {
		return false;
	}
	reported.add(key);
	log[level](message);
	return true;
}

/**
 * Forget what has been reported. Used by the unit tests.
 */
function resetLogOnce() {
	reported.clear();
}

module.exports = { logOnce, resetLogOnce };
