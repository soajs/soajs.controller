'use strict';
let resource = {
	_id: "5cf98f13d1975b4988a84945",
	name: "dash_cluster",
	type: "cluster",
	category: "mongo",
	created: "DASHBOARD",
	author: "owner",
	locked: true,
	plugged: true,
	shared: true,
	sharedEnvs: {
		"DEV": true,
		"STG": true
	},
	config: {
		name: "core_provision",
		prefix: "",
		servers: [
			{
				host: "127.0.0.1",
				port: 27017
			}
		],
		credentials: null,
		streaming: {
			batchSize: 1000
		},
		URLParam: {
			"useUnifiedTopology": true
		},
		timeConnected: 1552747598093.0
	}
};
module.exports = resource;
