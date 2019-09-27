'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const Controller = require ("./server/controller");

let c = new Controller();
c.init((registry, log, service, server, serverMaintenance) => {
    c.start(registry, log, service, server, serverMaintenance, () => {

    });
});