"use strict";

/**
 * Access tokens the contract needs besides the integration data: an expired one, one whose
 * expires is null, one whose expires is a string, one without expires. Written to the local test
 * database (core_provision.oauth_token, as the import) before the cases run; the expired one just
 * before its case, as the TTL index on expires can remove it while the cases run.
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

function write(list, cb) {
	const Mongo = require("soajs.core.modules").mongo;
	const profile = JSON.parse(JSON.stringify(require("../data/soajs_profile.js")));
	// the import changes the shared profile's name; the tokens live in core_provision
	profile.name = "core_provision";
	const mongo = new Mongo(profile);
	let pending = list.slice();
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

// the tokens that do not expire by date, written before the cases run
function insert(cb) {
	write(docs().filter((d) => !expiredByDate(d)), cb);
}

// a token with a past date, written just before the case that uses it
function before(token, cb) {
	write(docs().filter((d) => d.token === token), cb);
}

function expiredByDate(d) {
	return d.expires instanceof Date && d.expires.getTime() < Date.now();
}

module.exports = {insert, before};
