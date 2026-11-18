"use strict";

/**
 * Access tokens the contract needs besides the integration data: an expired one, one whose
 * expires is null, one whose expires is a string, one without expires. Written to the local test
 * database (core_provision.oauth_token, as the import) before the cases run.
 */

const contract = require("./cases.js");
const valid = require("../data/provision/oauth/token/access_token.js");

function docs() {
	const make = (token, expires) => {
		const d = JSON.parse(JSON.stringify(valid));
		delete d._id;
		d.token = token;
		if (expires === undefined) {
			delete d.expires;
		} else {
			d.expires = expires;
		}
		return d;
	};
	return [
		make(contract.EXPIRED, new Date(Date.UTC(2020, 0, 1))),
		make(contract.NEVER_EXPIRES, null),
		make(contract.STRING_EXPIRES, "2020-01-01T00:00:00.000Z"),
		make(contract.NO_EXPIRES, undefined)
	];
}

function insert(cb) {
	const {MongoClient} = require("mongodb");
	const client = new MongoClient("mongodb://127.0.0.1:27017");
	client.connect().then(async () => {
		const coll = client.db("core_provision").collection("oauth_token");
		for (const d of docs()) {
			await coll.replaceOne({"token": d.token}, d, {"upsert": true});
		}
	}).then(() => client.close().then(() => cb()), (e) => client.close().then(() => cb(e)));
}

module.exports = {insert};
