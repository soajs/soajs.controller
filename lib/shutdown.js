'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

/**
 * The gateway's graceful stop, the one place that handles SIGTERM and SIGINT:
 * 1. the gateway and maintenance servers stop accepting connections; idle keep-alive sockets close;
 * 2. requests in flight finish, for at most SOAJS_SERVER_SHUTDOWN_TIMEOUT seconds (10);
 * 3. the cleanup tasks modules registered run, in the order they registered;
 * 4. the process exits with 0. When the timeout passes first, it exits anyway.
 *
 * Modules register their cleanup with register(name, task); they do not listen for the signals.
 * A further SIGTERM or SIGINT while stopping is ignored.
 */

const DEFAULT_TIMEOUT_S = 10;

let servers = [];
let tasks = [];
let installed = false;
let stopping = null;
let log = null;
let exit = (code) => process.exit(code);

function timeoutMs() {
	let seconds = parseInt(process.env.SOAJS_SERVER_SHUTDOWN_TIMEOUT, 10);
	if (isNaN(seconds) || seconds <= 0) {
		seconds = DEFAULT_TIMEOUT_S;
	}
	return seconds * 1000;
}

function logger(level, message) {
	if (log && typeof log[level] === "function") {
		log[level](message);
	}
}

/**
 * A cleanup task, run once the servers have stopped: task(signal, done).
 */
function register(name, task) {
	tasks.push({"name": name, "task": task});
}

/**
 * A server to stop: the gateway's or the maintenance port's.
 */
function addServer(server) {
	if (server && servers.indexOf(server) === -1) {
		servers.push(server);
	}
}

/**
 * A server stopped some other way (Controller.stop) is no longer waited for.
 */
function removeServer(server) {
	let i = servers.indexOf(server);
	if (i !== -1) {
		servers.splice(i, 1);
	}
}

function closeServer(server, done) {
	let finished = false;
	let finish = () => {
		if (!finished) {
			finished = true;
			done();
		}
	};
	//NOTE: a keep-alive connection becomes idle once its request is answered: closed then
	let idle = null;
	try {
		server.close(() => {
			if (idle) {
				clearInterval(idle);
			}
			finish();
		});
		if (typeof server.closeIdleConnections === "function") {
			server.closeIdleConnections();
			idle = setInterval(() => server.closeIdleConnections(), 100);
			if (idle.unref) {
				idle.unref();
			}
		}
	} catch (e) {
		if (idle) {
			clearInterval(idle);
		}
		finish();
	}
}

function runTasks(signal, i, done) {
	if (i >= tasks.length) {
		return done();
	}
	let t = tasks[i];
	let called = false;
	let next = () => {
		if (!called) {
			called = true;
			runTasks(signal, i + 1, done);
		}
	};
	try {
		t.task(signal, next);
	} catch (e) {
		logger("error", "Shutdown: [" + t.name + "] failed: " + e.message);
		next();
	}
}

/**
 * Stops the gateway: servers, requests in flight, cleanup tasks, then exit.
 *
 * @param signal "SIGTERM" or "SIGINT"
 * @param cb called just before exit (tests)
 */
function stop(signal, cb) {
	if (stopping) {
		return stopping;
	}
	logger("warn", "Stopping on " + signal + ": no new connections, waiting for the requests in flight");
	let timer = null;
	let exited = false;
	let leave = (code) => {
		if (exited) {
			return;
		}
		exited = true;
		if (timer) {
			clearTimeout(timer);
		}
		if (typeof cb === "function") {
			cb(code);
		}
		exit(code);
	};
	timer = setTimeout(() => {
		logger("error", "Stopping on " + signal + ": not done after " + (timeoutMs() / 1000) + "s, exiting");
		leave(0);
	}, timeoutMs());
	if (timer.unref) {
		timer.unref();
	}
	stopping = new Promise((resolve) => {
		let pending = servers.length;
		let afterServers = () => {
			runTasks(signal, 0, () => {
				logger("warn", "Stopped on " + signal + ".");
				resolve();
				leave(0);
			});
		};
		if (pending === 0) {
			return afterServers();
		}
		servers.slice().forEach((server) => closeServer(server, () => {
			pending--;
			if (pending === 0) {
				afterServers();
			}
		}));
	});
	return stopping;
}

/**
 * Handles SIGTERM and SIGINT, installed once per process. The listeners stay for the life of the
 * process: a signal that comes while the gateway is stopping is ignored (the stop goes on, bounded
 * by its timeout), as the Go gateway does. With process.once, a second signal would fall back to
 * Node.js's default and end the process before the requests in flight finish.
 */
function install(_log) {
	if (_log) {
		log = _log;
	}
	if (installed) {
		return;
	}
	installed = true;
	process.on('SIGTERM', () => stop("SIGTERM"));
	process.on('SIGINT', () => stop("SIGINT"));
}

// tests: the exit function, and a fresh state
function _reset(exitFn) {
	servers = [];
	tasks = [];
	stopping = null;
	exit = exitFn || ((code) => process.exit(code));
}

module.exports = {register, addServer, removeServer, stop, install, _reset};
