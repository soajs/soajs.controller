'use strict';

const core = require("soajs.core.modules").core;

module.exports = (autoRegHost, cb) => {
    let fetchedHostIp = null;
    let serviceIp = null;
    let serviceHATask = null;

    if (!autoRegHost && !process.env.SOAJS_DEPLOY_HA) {
        serviceIp = '127.0.0.1';
    }
    if (!serviceIp && !(process.env.SOAJS_DEPLOY_HA === 'true')) {
        core.getHostIp((getHostIpResponse) => {
            fetchedHostIp = getHostIpResponse;
            if (fetchedHostIp && fetchedHostIp.result) {
                serviceIp = fetchedHostIp.ip;
                if (fetchedHostIp.extra && fetchedHostIp.extra.swarmTask) {
                    serviceHATask = fetchedHostIp.extra.swarmTask;
                }
            } else {
                serviceIp = "127.0.0.1";
            }
            return cb({"ip": serviceIp, "HATask": serviceHATask});
        });
    }
    else {
        return cb({"ip": serviceIp, "HATask": serviceHATask, "fetched": fetchedHostIp});
    }
};