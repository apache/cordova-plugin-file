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
(function () {
    /* global require, exports, module */

    if (window.require === undefined) {
        console.error(
            'Electron Node.js integration is disabled, you can not use cordova-file-plugin without it\n' +
            'Check docs how to enable Node.js integration: https://cordova.apache.org/docs/en/latest/guide/platforms/electron/#quick-start'
        );
        return;
    }

    const nodeRequire = global.require;
    const nodePath = nodeRequire('path');
    const fs = nodeRequire('fs');
    const app = nodeRequire('electron').remote.app;

    const FileEntry = require('./FileEntry');
    const FileError = require('./FileError');
    const DirectoryEntry = require('./DirectoryEntry');
    const File = require('./File');

    (function (exports, global) {

        // https://github.com/electron/electron/blob/master/docs/api/app.md#appgetpathname
        const pathsPrefix = {
            applicationDirectory: app.getAppPath() + nodePath.sep,
            dataDirectory: app.getPath('userData') + nodePath.sep,
            cacheDirectory: app.getPath('cache') + nodePath.sep,
            tempDirectory: app.getPath('temp') + nodePath.sep,
            documentsDirectory: app.getPath('documents') + nodePath.sep
        };

    /** * Exported functionality ***/

        // list a directory's contents (files and folders).
        exports.readEntries = function (successCallback, errorCallback, args) {
            const fullPath = args[0];

            if (typeof successCallback !== 'function') {
                throw Error('Expected successCallback argument.');
            }

            fs.readdir(fullPath, {withFileTypes: true}, (err, files) => {
                if (err) {
                    if (errorCallback) {
                        errorCallback(FileError.NOT_FOUND_ERR);
                    }
                    return;
                }
                const result = [];
                files.forEach(d => {
                    let path = fullPath + d.name;
                    if (d.isDirectory()) {
                        path += nodePath.sep;
                    }
                    result.push({
                        isDirectory: d.isDirectory(),
                        isFile: d.isFile(),
                        name: d.name,
                        fullPath: path,
                        filesystemName: 'temporary',
                        nativeURL: path
                    });
                });
                successCallback(result);
            });
        };

        exports.getFile = function (successCallback, errorCallback, args) {
            const path = args[0] + args[1];
            const options = args[2] || {};

            fs.stat(path, (err, stats) => {
                if (err && err.code !== 'ENOENT') {
                    if (errorCallback) {
                        errorCallback(FileError.INVALID_STATE_ERR);
                    }
                    return;
                }
                const exists = !err;
                const baseName = nodeRequire('path').basename(path);

                function createFile () {
                    fs.open(path, 'w', (err, fd) => {
                        if (err) {
                            if (errorCallback) {
                                errorCallback(FileError.INVALID_STATE_ERR);
                            }
                            return;
                        }
                        fs.close(fd, (err) => {
                            if (err) {
                                if (errorCallback) {
                                    errorCallback(FileError.INVALID_STATE_ERR);
                                }
                                return;
                            }
                            successCallback(new FileEntry(baseName, path));
                        });
                    });
                }

                if (options.create === true && options.exclusive === true && exists) {
                    // If create and exclusive are both true, and the path already exists,
                    // getFile must fail.
                    if (errorCallback) {
                        errorCallback(FileError.PATH_EXISTS_ERR);
                    }
                } else if (options.create === true && !exists) {
                    // If create is true, the path doesn't exist, and no other error occurs,
                    // getFile must create it as a zero-length file and return a corresponding
                    // FileEntry.
                    createFile();
                } else if (options.create === true && exists) {
                    if (stats.isFile()) {
                        // Overwrite file, delete then create new.
                        createFile();
                    } else {
                        if (errorCallback) {
                            errorCallback(FileError.INVALID_MODIFICATION_ERR);
                        }
                    }
                } else if (!options.create && !exists) {
                    // If create is not true and the path doesn't exist, getFile must fail.
                    if (errorCallback) {
                        errorCallback(FileError.NOT_FOUND_ERR);
                    }
                } else if (!options.create && exists && stats.isDirectory()) {
                    // If create is not true and the path exists, but is a directory, getFile
                    // must fail.
                    if (errorCallback) {
                        errorCallback(FileError.TYPE_MISMATCH_ERR);
                    }
                } else {
                    // Otherwise, if no other error occurs, getFile must return a FileEntry
                    // corresponding to path.
                    successCallback(new FileEntry(baseName, path));
                }
            });
        };

        exports.getFileMetadata = function (successCallback, errorCallback, args) {
            const fullPath = args[0];
            fs.stat(fullPath, (err, stats) => {
                if (err) {
                    if (errorCallback) {
                        errorCallback(FileError.NOT_FOUND_ERR);
                    }
                    return;
                }
                const baseName = nodeRequire('path').basename(fullPath);
                successCallback(new File(baseName, fullPath, '', stats.mtime, stats.size));
            });
        };

        exports.getMetadata = function (successCallback, errorCallback, args) {
            fs.stat(args[0], (err, stats) => {
                if (err) {
                    if (errorCallback) {
                        errorCallback(FileError.NOT_FOUND_ERR);
                    }
                    return;
                }
                successCallback({
                    modificationTime: stats.mtime,
                    size: stats.size
                });
            });
        };

        exports.setMetadata = function (successCallback, errorCallback, args) {
            const fullPath = args[0];
            const metadataObject = args[1];

            fs.utime(fullPath, metadataObject.modificationTime, metadataObject.modificationTime, (err) => {
                if (err) {
                    if (errorCallback) {
                        errorCallback(FileError.NOT_FOUND_ERR);
                    }
                    return;
                }
                successCallback();
            });
        };

        exports.write = function (successCallback, errorCallback, args) {
            const fileName = args[0];
            const data = args[1];
            const position = args[2];
            const isBinary = args[3]; // eslint-disable-line no-unused-vars

            if (!data) {
                if (errorCallback) {
                    errorCallback(FileError.INVALID_MODIFICATION_ERR);
                }
                return;
            }

            const buf = Buffer.from(data);
            const promisify = nodeRequire('util').promisify;
            let bytesWritten = 0;
            promisify(fs.open)(fileName, 'a')
                .then(fd => {
                    return promisify(fs.write)(fd, buf, 0, buf.length, position)
                              .then(bw => { bytesWritten = bw; })
                              .finally(() => promisify(fs.close)(fd));
                })
                .then(() => successCallback(bytesWritten))
                .catch(() => {
                    if (errorCallback) {
                        errorCallback(FileError.INVALID_MODIFICATION_ERR);
                    }
                });
        };

        exports.readAsText = function (successCallback, errorCallback, args) {
            const fileName = args[0];
            const enc = args[1];
            const startPos = args[2];
            const endPos = args[3];

            readAs('text', fileName, enc, startPos, endPos, successCallback, errorCallback);
        };

        exports.readAsDataURL = function (successCallback, errorCallback, args) {
            const fileName = args[0];
            const startPos = args[1];
            const endPos = args[2];

            readAs('dataURL', fileName, null, startPos, endPos, successCallback, errorCallback);
        };

        exports.readAsBinaryString = function (successCallback, errorCallback, args) {
            const fileName = args[0];
            const startPos = args[1];
            const endPos = args[2];

            readAs('binaryString', fileName, null, startPos, endPos, successCallback, errorCallback);
        };

        exports.readAsArrayBuffer = function (successCallback, errorCallback, args) {
            const fileName = args[0];
            const startPos = args[1];
            const endPos = args[2];

            readAs('arrayBuffer', fileName, null, startPos, endPos, successCallback, errorCallback);
        };

        exports.remove = function (successCallback, errorCallback, args) {
            const fullPath = args[0];

            fs.stat(fullPath, (err, stats) => {
                if (err) {
                    if (errorCallback) {
                        errorCallback(FileError.NOT_FOUND_ERR);
                    }
                    return;
                }
                const rm = stats.isDirectory() ? fs.rmdir : fs.unlink;
                rm(fullPath, (err) => {
                    if (err) {
                        if (errorCallback) {
                            errorCallback(FileError.NO_MODIFICATION_ALLOWED_ERR);
                        }
                        return;
                    }
                    successCallback();
                });
            });
        };

        exports.truncate = function (successCallback, errorCallback, args) {
            const fullPath = args[0];
            const size = args[1];

            fs.truncate(fullPath, size, err => {
                if (err) {
                    if (errorCallback) {
                        errorCallback(FileError.INVALID_STATE_ERR);
                    }
                    return;
                }
                successCallback(size);
            })
        };

        exports.removeRecursively = function (successCallback, errorCallback, args) {
            const fullPath = args[0];
            const rimraf = require('./rimraf');

            rimraf(fullPath, {disableGlob: true}, err => {
                if (err) {
                    if (errorCallback) {
                        errorCallback(FileError.NO_MODIFICATION_ALLOWED_ERR);
                    }
                    return;
                }
                successCallback();
            });
        };

        exports.getDirectory = function (successCallback, errorCallback, args) {
            const path = args[0] + args[1];
            const options = args[2] || {};

            fs.stat(path, (err, stats) => {
                if (err && err.code !== 'ENOENT') {
                    if (errorCallback) {
                        errorCallback(FileError.INVALID_STATE_ERR);
                    }
                    return;
                }
                const exists = !err;
                const baseName = nodeRequire('path').basename(path);

                if (options.create === true && options.exclusive === true && exists) {
                    // If create and exclusive are both true, and the path already exists,
                    // getDirectory must fail.
                    if (errorCallback) {
                        errorCallback(FileError.PATH_EXISTS_ERR);
                    }
                } else if (options.create === true && !exists) {
                    // If create is true, the path doesn't exist, and no other error occurs,
                    // getDirectory must create it as a zero-length file and return a corresponding
                    // MyDirectoryEntry.
                    fs.mkdir(path, (err) => {
                        if (err) {
                            if (errorCallback) {
                                errorCallback(FileError.PATH_EXISTS_ERR);
                            }
                            return;
                        }
                        successCallback(new DirectoryEntry(baseName, path));
                    });
                } else if (options.create === true && exists) {
                    if (stats.isDirectory()) {
                        successCallback(new DirectoryEntry(baseName, path));
                    } else if (errorCallback) {
                        errorCallback(FileError.INVALID_MODIFICATION_ERR);
                    }
                } else if (!options.create && !exists) {
                    // If create is not true and the path doesn't exist, getDirectory must fail.
                    if (errorCallback) {
                        errorCallback(FileError.NOT_FOUND_ERR);
                    }
                } else if (!options.create && exists && stats.isFile()) {
                    // If create is not true and the path exists, but is a file, getDirectory
                    // must fail.
                    if (errorCallback) {
                        errorCallback(FileError.TYPE_MISMATCH_ERR);
                    }
                } else {
                    // Otherwise, if no other error occurs, getDirectory must return a
                    // DirectoryEntry corresponding to path.
                    successCallback(new DirectoryEntry(baseName, path));
                }
            });
        };

        exports.getParent = function (successCallback, errorCallback, args) {
            if (typeof successCallback !== 'function') {
                throw Error('Expected successCallback argument.');
            }

            const parentPath = nodePath.dirname(args[0]);
            const parentName = nodePath.basename(parentPath);
            const path = nodePath.dirname(parentPath) + nodePath.sep;

            exports.getDirectory(successCallback, errorCallback, [path, parentName, {create: false}]);
        };

        exports.copyTo = function (successCallback, errorCallback, args) {
            const srcPath = args[0];
            const dstDir = args[1];
            const dstName = args[2];

            fs.copyFile(srcPath, dstDir + dstName, (err) => {
                if (err) {
                    if (errorCallback) {
                        errorCallback(FileError.INVALID_MODIFICATION_ERR);
                    }
                    return;
                }
                exports.getFile(successCallback, errorCallback, [dstDir, dstName]);
            });
        };

        exports.moveTo = function (successCallback, errorCallback, args) {
            const srcPath = args[0];
            // parentFullPath and name parameters is ignored because
            // args is being passed downstream to exports.copyTo method
            const parentFullPath = args[1]; // eslint-disable-line
            const name = args[2]; // eslint-disable-line

            exports.copyTo(function (fileEntry) {

                exports.remove(function () {
                    successCallback(fileEntry);
                }, errorCallback, [srcPath]);

            }, errorCallback, args);
        };

        exports.resolveLocalFileSystemURI = function (successCallback, errorCallback, args) {
            let path = args[0];

            // support for encodeURI
            if (/\%5/g.test(path) || /\%20/g.test(path)) {  // eslint-disable-line no-useless-escape
                path = decodeURI(path);
            }

            // support for cdvfile
            if (path.trim().substr(0, 7) === 'cdvfile') {
                if (path.indexOf('cdvfile://localhost') === -1) {
                    if (errorCallback) {
                        errorCallback(FileError.ENCODING_ERR);
                    }
                    return;
                }

                const indexApplication = path.indexOf('application');
                const indexPersistent = path.indexOf('persistent');
                const indexTemporary = path.indexOf('temporary');

                if (indexApplication !== -1) { // cdvfile://localhost/application/path/to/file
                    path = pathsPrefix.applicationDirectory + path.substr(indexApplication + 12);
                } else if (indexPersistent !== -1) { // cdvfile://localhost/persistent/path/to/file
                    path = pathsPrefix.dataDirectory + path.substr(indexPersistent + 11);
                } else if (indexTemporary !== -1) { // cdvfile://localhost/temporary/path/to/file
                    path = pathsPrefix.tempDirectory + path.substr(indexTemporary + 10);
                } else {
                    if (errorCallback) {
                        errorCallback(FileError.ENCODING_ERR);
                    }
                    return;
                }
            }

            fs.stat(path, (err, stats) => {
                if (err) {
                    if (errorCallback) {
                        errorCallback(FileError.NOT_FOUND_ERR);
                    }
                    return;
                }

                const baseName = nodeRequire('path').basename(path);
                if (stats.isDirectory()) {
                    successCallback(new DirectoryEntry(baseName, path));
                } else {
                    successCallback(new FileEntry(baseName, path));
                }
            });
        };

        exports.requestAllPaths = function (successCallback) {
            successCallback(pathsPrefix);
        };

    /** * Helpers ***/

        function readAs (what, fullPath, encoding, startPos, endPos, successCallback, errorCallback) {
            const promisify = nodeRequire('util').promisify;

            fs.open(fullPath, 'r', (err, fd) => {
                if (err) {
                    if (errorCallback) {
                        errorCallback(FileError.NOT_FOUND_ERR);
                    }
                    return;
                }
                const buf = Buffer.alloc(endPos - startPos);
                promisify(fs.read)(fd, buf, 0, buf.length, startPos)
                    .then(() => {
                        switch (what) {
                        case 'text':
                            successCallback(buf.toString(encoding));
                            break;
                        case 'dataURL':
                            successCallback('data:;base64,' + buf.toString('base64'));
                            break;
                        case 'arrayBuffer':
                            successCallback(buf);
                            break;
                        case 'binaryString':
                            successCallback(buf.toString('binary'));
                            break;
                        }
                    })
                    .catch(() => {
                        if (errorCallback) {
                            errorCallback(FileError.NOT_READABLE_ERR);
                        }
                    })
                    .then(() => promisify(fs.close)(fd));
            });
        }

    })(module.exports, window);

    require('cordova/exec/proxy').add('File', module.exports);
})();
