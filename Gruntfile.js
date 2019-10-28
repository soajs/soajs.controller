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
    lib.loadTasks(grunt, pluginsRootPath, ['grunt-contrib-jshint']);
    grunt.initConfig({
        //Defining jshint tasks
        jshint: {
            options: {
                "bitwise": true,
                "curly": true,
                "eqeqeq": true,
                "eqnull": true,
                "esversion": 6,
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
                src: ['Gruntfile.js', 'index.js']
            },
            gruntfile: {
                src: 'Gruntfile.js'
            }
        }

    });

    process.env.SHOW_LOGS = grunt.option('showLogs');
    grunt.registerTask("default", ['jshint']);

};

