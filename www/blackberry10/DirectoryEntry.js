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

var argscheck = require('cordova/argscheck'),
    utils = require('cordova/utils'),
    Entry = require('./BB10Entry'),
    FileError = require('./FileError'),
    DirectoryReader = require('./BB10DirectoryReader'),
    fileUtils = require('./BB10Utils'),
    DirectoryEntry = function (name, fullPath) {
        DirectoryEntry.__super__.constructor.call(this, false, true, name, fullPath);
    };

utils.extend(DirectoryEntry, Entry);

DirectoryEntry.prototype.createReader = function () {
    return new DirectoryReader(this.fullPath);
};

DirectoryEntry.prototype.getDirectory = function (path, options, successCallback, errorCallback) {
    argscheck.checkArgs('sOFF', 'DirectoryEntry.getDirectory', arguments);
    this.nativeEntry.getDirectory(path, options, function (entry) {
        successCallback(fileUtils.createEntry(entry));
    }, errorCallback);
};

DirectoryEntry.prototype.removeRecursively = function (successCallback, errorCallback) {
    argscheck.checkArgs('FF', 'DirectoryEntry.removeRecursively', arguments);
    this.nativeEntry.removeRecursively(successCallback, errorCallback);
};

DirectoryEntry.prototype.getFile = function (path, options, successCallback, errorCallback) {
    argscheck.checkArgs('sOFF', 'DirectoryEntry.getFile', arguments);
    this.nativeEntry.getFile(path, options, function (entry) {
        successCallback(fileUtils.createEntry(entry));
    }, errorCallback);
};

module.exports = DirectoryEntry;
