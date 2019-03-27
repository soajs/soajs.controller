'use strict';

const Controller = require ("./server/controller");

let c = new Controller();
c.init((registry, log, service, server, serverMaintenance) => {
    c.start(registry, log, service, server, serverMaintenance, () => {

    });
});