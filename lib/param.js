'use strict';

/*
 * return a param Object of config and init param
 */

module.exports = (config) => {
    //Assure config
    config = config || {};

    //Build init param
    let param = {};
    param.awareness = true;
    param.serviceName = "controller";
    param.serviceVersion = "1";
    //param.serviceIp = process.env.SOAJS_SRVIP || null;
    param.serviceHATask = null;

    //automatically add maintenance to service
    if (!config.maintenance)
        config.maintenance = {};
    config.maintenance.port = {"type": "maintenance"};
    config.maintenance.readiness = "/heartbeat";
    if (!config.maintenance.commands)
        config.maintenance.commands = [];
    config.maintenance.commands.push({"label": "Releoad Registry", "path": "/reloadRegistry", "icon": "registry"});
    config.maintenance.commands.push({"label": "Statistics Info", "path": "/awarenessStat", "icon": "awareness"});
    config.maintenance.commands.push({"label": "Releoad Provision Info", "path": "/loadProvision", "icon": "provision"});

    //return param
    return {"config": config, "init": param};
};