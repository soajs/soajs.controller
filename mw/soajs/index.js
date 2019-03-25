'use strict';

/**
 *
 * @param configuration
 * @returns {Function}
 */
module.exports = (configuration) => {
    let log = configuration.log;
    let core = configuration.core;

    return (req, res, next) => {
        if (!req.soajs)
            req.soajs = {};

        req.soajs.log = log;
        req.soajs.registry = core.registry.get();
        req.soajs.meta = core.meta;
        req.soajs.validator = core.validator;
        return next();
    };
};
