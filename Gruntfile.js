'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const fs = require('fs');
const path = require('path');

let lib = {
	/**
	 * Function that find the root path where grunt plugins are installed.
	 *
	 * @method findRoot
	 * @return String rootPath
	 */
	findRoot: function () {
		let cwd = process.cwd();
		let rootPath = cwd;
		let newRootPath = null;
		while (!fs.existsSync(path.join(process.cwd(), "node_modules/grunt"))) {
			process.chdir("..");
			newRootPath = process.cwd();
			if (newRootPath === rootPath) {
				return;
			}
			rootPath = newRootPath;
		}
		process.chdir(cwd);
		return rootPath;
	},
	/**
	 * Function load the npm tasks from the root path
	 *
	 * @method loadTasks
	 * @param grunt {Object} The grunt instance
	 * @param tasks {Array} Array of tasks as string
	 */
	loadTasks: function (grunt, rootPath, tasks) {
		tasks.forEach(function (name) {
			if (name === 'grunt-cli') {
				return;
			}
			let cwd = process.cwd();
			process.chdir(rootPath); // load files from proper root, I don't want to install everything locally per module!
			grunt.loadNpmTasks(name);
			process.chdir(cwd);
		});
	}
};

module.exports = function (grunt) {
	//Loading the needed plugins to run the grunt tasks
	let pluginsRootPath = lib.findRoot();
	lib.loadTasks(grunt, pluginsRootPath, ['grunt-contrib-jshint', 'grunt-jsdoc', 'grunt-contrib-clean', 'grunt-mocha-test', 'grunt-env', 'grunt-istanbul', 'grunt-coveralls', 'grunt-babel', 'grunt-contrib-copy']);
	grunt.initConfig({
		//Defining jshint tasks
		jshint: {
			options: {
				"bitwise": true,
				"curly": true,
				"eqeqeq": true,
				"eqnull": true,
				"esversion": 8,
				"forin": true,
				"latedef": "nofunc",
				"leanswitch": true,
				"maxerr": 100,
				"noarg": true,
				"nonbsp": true,
				"strict": "global",
				"undef": true,
				"unused": true,
				"varstmt": true,
				
				"node": true,
				
				"globals": {
					"describe": false,
					"it": false,
					"before": false,
					"beforeEach": false,
					"after": false,
					"afterEach": false
				}
			},
			files: {
				src: ['index.js', '_index.js', 'config.js', 'Gruntfile.js', 'lib/**/*.js', 'modules/driver/*.js', 'modules/driver/kubernetes/*.js', 'modules/driver/kubernetes/bl/*.js', 'modules/driver/kubernetes/model/*.js', 'modules/registry/*.js', 'mw/**/*.js', 'server/**/*.js', 'utilities/**/*.js']
			},
			gruntfile: {
				src: 'Gruntfile.js'
			}
		},
		
		env: {
			mochaTest: {
				SOAJS_IMPORTER_DROPDB: true,
				SOAJS_ENV: "dev",
				SOAJS_TEST: true,
				SOAJS_PROFILE: __dirname + "/profiles/single.js",
				APP_DIR_FOR_CODE_COVERAGE: '../'
			},
			coverage: {
				SOAJS_IMPORTER_DROPDB: true,
				SOAJS_ENV: "dev",
				SOAJS_TEST: true,
				SOAJS_PROFILE: __dirname + "/profiles/single.js",
				APP_DIR_FOR_CODE_COVERAGE: '../test/coverage/instrument/test/dist/'
			}
		},
		
		clean: {
			doc: {
				src: ['doc/']
			},
			coverage: {
				src: ['test/coverage/']
			},
			dist: {
				src: ['test/dist/']
			}
		},
		
		babel: {
			options: {
				sourceMap: true,
				presets: ['@babel/preset-env'],
				plugins: ["@babel/plugin-transform-runtime"],
			},
			dist: {
				files: [

					{
						expand: true,
						cwd: 'lib/',
						src: ['*.js'],
						dest: 'test/dist/lib/'
					},
					{
						expand: true,
						cwd: 'modules/',
						src: ['**/*.js'],
						dest: 'test/dist/modules/'
					},
					{
						expand: true,
						cwd: 'mw/',
						src: ['**/*.js'],
						dest: 'test/dist/mw/'
					},
					{
						expand: true,
						cwd: 'profiles/',
						src: ['*.js'],
						dest: 'test/dist/profiles/'
					},
					{
						expand: true,
						cwd: 'server/',
						src: ['*.js'],
						dest: 'test/dist/server/'
					},
					{ 'test/dist/index.js': 'index.js' },
					{ 'test/dist/_index.js': '_index.js' },
					{ 'test/dist/config.js': 'config.js' },
				]
			}
		},

		copy: {
			main: {
				files: [
					{expand: true, src: ['package.json'], dest: 'test/coverage/instrument/', filter: 'isFile'},
					{
						cwd: 'modules/driver/kubernetes/model/swagger/',
						src: '**/*',
						dest: 'test/coverage/instrument/modules/driver/kubernetes/model/swagger/',
						expand: true
					},
					{
						cwd: 'modules/driver/kubernetes/model/clients/',  // set working folder / root to copy
						src: '**/*',
						dest: 'test/coverage/instrument/modules/driver/kubernetes/model/clients/',    // destination folder
						expand: true           // required when using cwd
					}
				]
			}
		},
		
		instrument: {
			// files: ['index.js', '_index.js', 'config.js', 'lib/**/*.js', 'modules/driver/*.js', 'modules/driver/kubernetes/*.js', 'modules/driver/kubernetes/bl/*.js', 'modules/driver/kubernetes/model/*.js', 'modules/registry/*.js', 'mw/**/*.js', 'server/**/*.js', 'utilities/**/*.js'],
			files: ['test/dist/index.js', 'test/dist/_index.js', 'test/dist/config.js', 'test/dist/lib/**/*.js', 'test/dist/modules/**/*.js', 'test/dist/mw/**/*.js', 'test/dist/server/**/*.js', 'test/dist/utilities/**/*.js'],
			options: {
				lazy: false,
				basePath: 'test/coverage/instrument/'
			}
		},
		
		storeCoverage: {
			options: {
				dir: 'test/coverage/reports'
			}
		},
		
		makeReport: {
			src: 'test/coverage/reports/**/*.json',
			options: {
				type: 'lcov',
				dir: 'test/coverage/reports',
				print: 'detail'
			}
		},
		
		mochaTest: {
			unit: {
				options: {
					reporter: 'spec',
					timeout: 90000
				},
				src: ['test/unit/index.js']
			},
			integration: {
				options: {
					reporter: 'spec',
					timeout: 90000
				},
				src: ['test/integration/index.js']
			}
		},
		
		coveralls: {
			options: {
				// LCOV coverage file relevant to every target
				src: 'test/coverage/reports/lcov.info',
				
				// When true, grunt-coveralls will only print a warning rather than
				// an error, to prevent CI builds from failing unnecessarily (e.g. if
				// coveralls.io is down). Optional, defaults to false.
				force: false
			},
			your_target: {
				// Target-specific LCOV coverage file
				src: 'test/coverage/reports/lcov.info'
			}
		}
	});
	
	process.env.SHOW_LOGS = grunt.option('showLogs');
	grunt.registerTask("default", ['jshint']);
	grunt.registerTask("integration", ['env:mochaTest', 'mochaTest:integration']);
	grunt.registerTask("integration-coverage", ['clean', 'babel', 'copy', 'env:coverage', 'instrument', 'mochaTest:integration', 'storeCoverage', 'makeReport']);
	grunt.registerTask("unit", ['env:mochaTest', 'mochaTest:unit']);
	grunt.registerTask("unit-coverage", ['clean', 'babel', 'copy', 'env:coverage', 'instrument', 'mochaTest:unit', 'storeCoverage', 'makeReport']);
	grunt.registerTask("test", ['clean', 'babel', 'copy', 'env:coverage', 'instrument', 'mochaTest:unit', 'mochaTest:integration', 'storeCoverage', 'makeReport']);
	grunt.registerTask("coverage", ['clean', 'babel',  'copy', 'env:coverage', 'instrument', 'mochaTest:unit', 'mochaTest:integration', 'storeCoverage', 'makeReport', 'coveralls']);
	
};

