/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
 */

/* eslint-env node */

const fs = require('fs');
const path = require('path');

const PLUGIN_ID = 'cordova-plugin-file';
const ASSIGNMENT = /module\.exports\s*=\s*(?:true|false)\s*;/;

// Cordova evaluates <hook> scripts by calling the exported function.
module.exports = function (context) {
    const projectRoot = context && context.opts && context.opts.projectRoot;
    if (!projectRoot) {
        return;
    }

    const enabled = isEnabled(readWebSafe(projectRoot));
    const flagFiles = collectFlagFiles(context, projectRoot);
    if (flagFiles.length === 0) {
        console.warn('cordova-plugin-file: WEB_SAFE flag file was not found');
        return;
    }

    let changed = false;
    flagFiles.forEach(function (flagFile) {
        if (writeFlag(flagFile, enabled)) {
            changed = true;
        }
    });
    if (changed) {
        console.log('cordova-plugin-file: WEB_SAFE=' + (enabled ? 'true' : 'false'));
    }
};

// Install wraps www/webSafe.js into platforms/<platform>/... and the WebView
// loads that copy. Prepare does not read plugins/cordova-plugin-file again.
const SKIP_DIRS = {
    node_modules: true,
    build: true,
    '.gradle': true,
    intermediates: true,
    outputs: true,
    '.cxx': true,
    CordovaLib: true,
    gen: true
};

function collectFlagFiles (context, projectRoot) {
    const found = [];
    const seen = new Set();

    function add (file) {
        if (!file || !fs.existsSync(file)) {
            return;
        }
        let key = path.normalize(file);
        try {
            key = fs.realpathSync(file);
        } catch (e) {
            // Fall back to the path as given when the file cannot be resolved.
        }
        key = key.toLowerCase();
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        found.push(file);
    }

    const pluginDir = context.opts && context.opts.plugin && context.opts.plugin.dir;
    if (pluginDir) {
        add(path.join(pluginDir, 'www', 'webSafe.js'));
    }
    add(path.join(projectRoot, 'plugins', PLUGIN_ID, 'www', 'webSafe.js'));
    add(path.join(projectRoot, 'www', 'plugins', PLUGIN_ID, 'www', 'webSafe.js'));

    const platformsDir = path.join(projectRoot, 'platforms');
    if (fs.existsSync(platformsDir)) {
        walkFlagFiles(platformsDir, add, 0);
    }
    return found;
}

function walkFlagFiles (dir, add, depth) {
    if (depth > 14) {
        return;
    }
    let entries;
    try {
        entries = fs.readdirSync(dir);
    } catch (e) {
        return;
    }
    entries.forEach(function (name) {
        if (SKIP_DIRS[name]) {
            return;
        }
        const full = path.join(dir, name);
        let stat;
        try {
            stat = fs.statSync(full);
        } catch (e) {
            return;
        }
        if (!stat.isDirectory()) {
            return;
        }
        if (name === PLUGIN_ID) {
            add(path.join(full, 'www', 'webSafe.js'));
            return;
        }
        walkFlagFiles(full, add, depth + 1);
    });
}

function writeFlag (flagFile, enabled) {
    const source = fs.readFileSync(flagFile, 'utf8');
    const line = 'module.exports = ' + (enabled ? 'true' : 'false') + ';';
    const updated = ASSIGNMENT.test(source)
        ? source.replace(ASSIGNMENT, line)
        : source.replace(/\s*$/, '\n' + line + '\n');
    if (updated === source) {
        return false;
    }
    fs.writeFileSync(flagFile, updated);
    return true;
}

// config.xml wins when the variable is written there. Otherwise use the
// locations Cordova fills in for --variable / --save.
function readWebSafe (projectRoot) {
    const fromConfig = readConfigVariable(projectRoot);
    if (fromConfig !== undefined) {
        return fromConfig;
    }
    const fromPackage = readPackageVariable(projectRoot);
    if (fromPackage !== undefined) {
        return fromPackage;
    }
    return readFetchVariable(projectRoot);
}

function isEnabled (value) {
    return String(value).trim().toLowerCase() === 'true';
}

function readConfigVariable (projectRoot) {
    const configPath = path.join(projectRoot, 'config.xml');
    if (!fs.existsSync(configPath)) {
        return undefined;
    }
    const xml = fs.readFileSync(configPath, 'utf8');
    const pluginMatch = xml.match(/<plugin\b[^>]*\bname\s*=\s*["']cordova-plugin-file["'][^>]*>[\s\S]*?<\/plugin>/i);
    if (!pluginMatch) {
        return undefined;
    }
    const block = pluginMatch[0];
    const namedFirst = block.match(/<variable\b[^>]*\bname\s*=\s*["']WEB_SAFE["'][^>]*\bvalue\s*=\s*["']([^"']*)["']/i);
    if (namedFirst) {
        return namedFirst[1];
    }
    const valueFirst = block.match(/<variable\b[^>]*\bvalue\s*=\s*["']([^"']*)["'][^>]*\bname\s*=\s*["']WEB_SAFE["']/i);
    if (valueFirst) {
        return valueFirst[1];
    }
    return undefined;
}

function readPackageVariable (projectRoot) {
    const pkgPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        return undefined;
    }
    let pkg;
    try {
        pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch (e) {
        return undefined;
    }
    const plugins = pkg.cordova && pkg.cordova.plugins;
    const entry = plugins && plugins[PLUGIN_ID];
    if (!entry || !Object.prototype.hasOwnProperty.call(entry, 'WEB_SAFE')) {
        return undefined;
    }
    return entry.WEB_SAFE;
}

function readFetchVariable (projectRoot) {
    const fetchPath = path.join(projectRoot, 'plugins', 'fetch.json');
    if (!fs.existsSync(fetchPath)) {
        return undefined;
    }
    let fetched;
    try {
        fetched = JSON.parse(fs.readFileSync(fetchPath, 'utf8'));
    } catch (e) {
        return undefined;
    }
    const entry = fetched[PLUGIN_ID];
    if (!entry || !entry.variables || !Object.prototype.hasOwnProperty.call(entry.variables, 'WEB_SAFE')) {
        return undefined;
    }
    return entry.variables.WEB_SAFE;
}

module.exports.readWebSafe = readWebSafe;
module.exports.isEnabled = isEnabled;
