'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

/**
 *
 * @returns {Function}
 */
module.exports = () => {

    return (req, res, next) => {
        req.get = function (name) {
            if (!name) {
                throw new TypeError('name argument is required to req.get');
            }

            if (typeof name !== 'string') {
                throw new TypeError('name must be a string to req.get');
            }

            let lc = name.toLowerCase();

            switch (lc) {
                case 'referer':
                case 'referrer':
                    return req.headers.referrer || req.headers.referer;
                default:
                    return req.headers[lc];
            }
        };
        return next();
    };
};
