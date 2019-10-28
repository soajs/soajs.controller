'use strict';

const soajs = require('soajs');

let controller = new soajs.server.controller();
controller.init(function () {
	controller.start();
});

