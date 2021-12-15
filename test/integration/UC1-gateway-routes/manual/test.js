"use strict";

const helper = require("../../../helper.js");
const requester = require('../../requester');
let localConfig = helper.requireModule('./config.js');

let extKey = "3d90163cf9d6b3076ad26aa5ed58556348069258e5c6c941ee0f18448b570ad1c5c790e2d2a1989680c55f4904e2005ff5f8e71606e4aa641e67882f4210ebbc5460ff305dcb36e6ec2a2299cf0448ef60b9e38f41950ec251c1cf41f05f3ce9";
let options = {
	uri: 'http://127.0.0.1:' + localConfig.servicePort + '/oauth/passport/login',
	headers: {
		'Content-Type': 'application/json',
		'Connection': 'keep-alive',
		key: extKey
	},
	"qs": {
		access_token: "cfb209a91b23896820f510aadbf1f4284b512123"
	}
};
requester('get', options, (error, body) => {
	console.log(body.errors)
});
