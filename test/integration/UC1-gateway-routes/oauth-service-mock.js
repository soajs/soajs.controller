'use strict';
const express = require('express');
const sApp = express();
const mApp = express();

function startServer(serverConfig, callback) {
	let mReply = {
		'result': true,
		'ts': Date.now(),
		'service': {
			'service': serverConfig.name,
			'type': 'rest',
			'route': "/heartbeat"
		}
	};
	let sReply = {
		'result': true,
		'data': {
			'firstname': "antoine",
			'lastname': "hage"
		}
	};


	sApp.get('/passport/login', (req, res) => {
		res.json(sReply);
	});

	mApp.get('/heartbeat', (req, res) => res.json(mReply));

	let sAppServer = sApp.listen(serverConfig.s.port, () => console.log(`${serverConfig.name} service mock listening on port ${serverConfig.s.port}!`));
	let mAppServer = mApp.listen(serverConfig.m.port, () => console.log(`${serverConfig.name} service mock listening on port ${serverConfig.m.port}!`));

	return callback(
		{
			"sAppServer": sAppServer,
			"mAppServer": mAppServer,
			"name": serverConfig.name
		}
	)
}

function killServer(config) {
	console.log("killing server ....");

	config.mAppServer.close((err) => {
		console.log("...sAppServer: " + config.name);
	});

	config.sAppServer.close((err) => {
		console.log("...mAppServer: " + config.name);
	});
}

module.exports = {
	startServer: startServer,
	killServer: killServer
};
