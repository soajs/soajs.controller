"use strict";

const http = require('http');
const options = new URL('http://www.google.com');
console.log(options)
let redirectedRequest = http.request(options, function (serverResponse) {
	console.log(serverResponse.headers);
	// serverResponse.pause();
	serverResponse.headers['access-control-allow-origin'] = '*';
	serverResponse.on('data', (chunk) => {
		// console.log(`BODY: ${chunk}`);
	});
	serverResponse.on('end', () => {
		console.log('No more data in response.');
		process.exit(0);
	});
	// serverResponse.resume();
});
redirectedRequest.on('error', function (err) {
	console.log('error');
});
redirectedRequest.on('socket', function (err) {
	console.log('socket');
});
redirectedRequest.on('close', function (err) {
	console.log('close');
});
redirectedRequest.end();
