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
	const Mongo = require("soajs.core.modules").mongo;
	const profile = JSON.parse(JSON.stringify(require("../data/soajs_profile.js")));
	// the import changes the shared profile's name; the tokens live in core_provision
	profile.name = "core_provision";
	const mongo = new Mongo(profile);
	let pending = docs();
	const next = (error) => {
		if (error || pending.length === 0) {
			mongo.closeDb();
			return cb(error);
		}
		const d = pending.shift();
		mongo.updateOne("oauth_token", {"token": d.token}, {"$set": d}, {"upsert": true}, (error) => next(error));
	};
	next();
}

module.exports = {insert};
