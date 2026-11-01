'use strict';
const express = require('express');
const sApp = express();
const mApp = express();

function startServer(serverConfig, callback) {
	if (!serverConfig) {
		serverConfig = {}
	}
	if (!serverConfig.name) {
		serverConfig.name = "httpmethods";
	}
	if (!serverConfig.s) {
		serverConfig.s = {};
		serverConfig.s.port = 4010;
	}
	if (!serverConfig.m) {
		serverConfig.m = {};
		serverConfig.m.port = 5011;
	}
	
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
			'lastname': "hage",
			'type': "mock service"
		}
	};
	
	sApp.get('/myroute', (req, res) => {
		sReply.data.url = req.url;
		sReply.data.method = req.method;
		res.json(sReply);
	});
	sApp.post('/myroute', (req, res) => {
		sReply.data.url = req.url;
		sReply.data.method = req.method;
		res.json(sReply);
	});
	sApp.put('/myroute', (req, res) => {
		sReply.data.url = req.url;
		sReply.data.method = req.method;
		res.json(sReply);
	});
	sApp.delete('/myroute', (req, res) => {
		sReply.data.url = req.url;
		sReply.data.method = req.method;
		res.json(sReply);
	});
	sApp.patch('/myroute', (req, res) => {
		sReply.data.url = req.url;
		sReply.data.method = req.method;
		res.json(sReply);
	});
	sApp.head('/myroute', (req, res) => {
		sReply.data.url = req.url;
		sReply.data.method = req.method;
		res.json(sReply);
	});
	sApp.options('/myroute', (req, res) => {
		sReply.data.url = req.url;
		sReply.data.method = req.method;
		res.json(sReply);
	});
	
	
	mApp.get('/heartbeat', (req, res) => {
		mReply.service.route = '/heartbeat';
		res.json(mReply)
	});
	// what a soajs service answers on GET /mcp/tools, for the /soajs/mcp tests (UC8)
	mApp.get('/mcp/tools', (req, res) => {
		res.json({
			'result': true,
			'ts': Date.now(),
			'service': {'service': serverConfig.name.toUpperCase(), 'type': 'rest', 'route': '/mcp/tools'},
			'data': {
				'name': serverConfig.name,
				'version': '1',
				'tools': [
					{
						'm': 'get', 'v': '/myroute', 'l': 'Route to test get', 'group': 'Integration test',
						'inputSchema': {'type': 'object', 'properties': {'name': {'type': 'string'}}, 'required': ['name']},
						'fields': {'name': {'in': 'query', 'path': ['name']}}
					},
					{
						'm': 'post', 'v': '/myroute', 'l': 'Route to test post',
						'inputSchema': {'type': 'object', 'properties': {'title': {'type': 'string'}}},
						'fields': {'title': {'in': 'body', 'path': ['title']}}
					},
					{
						'm': 'delete', 'v': '/myroute', 'l': 'Route to test delete',
						'inputSchema': {'type': 'object', 'properties': {}},
						'fields': {}
					}
				]
			}
		});
	});
	mApp.get('/wrench', (req, res) => {
		mReply.service.route = '/wrench';
		res.json(mReply)
	});
	
	
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