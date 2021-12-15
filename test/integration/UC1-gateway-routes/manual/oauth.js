"use strict";

let oauthserver = require('../oauth-service-mock.js');

let oauthServers = null;

oauthserver.startServer({s: {port: 4004}, m: {port: 5004}, name: "OAUTH"}, function (servers) {
	oauthServers = servers;
});
