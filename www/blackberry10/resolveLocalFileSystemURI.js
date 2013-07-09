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

var fileUtils = require('./BB10Utils'),
    FileError = require('./FileError');

module.exports = function (uri, success, fail) {
    var type,
        path,
        paramPath;
    if (!uri || uri.indexOf("/") === 0) {
        fail(new FileError(FileError.ENCODING_ERR));
    } else {
        type = uri.indexOf("persistent") === -1 ? 0 : 1;
        path = uri.substring(type === 1 ? uri.indexOf("persistent") + 11 : uri.indexOf("temporary") + 10);
        if (path.substring(0,1) == "/") {
            path = path.substring(1);
        }
        paramPath = path.indexOf("?");
        if (paramPath > -1) {
            path = path.substring(0, paramPath);
        }
        window.webkitRequestFileSystem(type, 25*1024*1024, function (fs) {
            if (path === "") {
                success(fileUtils.createEntry(fs.root));
            } else {
                fs.root.getDirectory(path, {}, function (entry) {
                    success(fileUtils.createEntry(entry));
                }, function () {
                    fs.root.getFile(path, {}, function (entry) {
                        success(fileUtils.createEntry(entry));
                    }, fail);
                });
            }
        }, fail);
    }
};
