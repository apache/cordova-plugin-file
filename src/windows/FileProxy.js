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

/* global Windows, WinJS, MSApp */
/* eslint prefer-regex-literals: 0 */

const File = require('./File');
const FileError = require('./FileError');
const Flags = require('./Flags');
const FileSystem = require('./FileSystem');
const LocalFileSystem = require('./LocalFileSystem');
const utils = require('cordova/utils');

function Entry (isFile, isDirectory, name, fullPath, filesystemName, nativeURL) {
    this.isFile = !!isFile;
    this.isDirectory = !!isDirectory;
    this.name = name || '';
    this.fullPath = fullPath || '';
    this.filesystemName = filesystemName || null;
    this.nativeURL = nativeURL || null;
}

const FileEntry = function (name, fullPath, filesystemName, nativeURL) {
    FileEntry.__super__.constructor.apply(this, [true, false, name, fullPath, filesystemName, nativeURL]);
};

utils.extend(FileEntry, Entry);

const DirectoryEntry = function (name, fullPath, filesystemName, nativeURL) {
    DirectoryEntry.__super__.constructor.call(this, false, true, name, fullPath, filesystemName, nativeURL);
};

utils.extend(DirectoryEntry, Entry);

const getFolderFromPathAsync = Windows.Storage.StorageFolder.getFolderFromPathAsync;
const getFileFromPathAsync = Windows.Storage.StorageFile.getFileFromPathAsync;

function writeBytesAsync (storageFile, data, position) {
    return storageFile.openAsync(Windows.Storage.FileAccessMode.readWrite)
        .then(function (output) {
            output.seek(position);
            const dataWriter = new Windows.Storage.Streams.DataWriter(output);
            dataWriter.writeBytes(data);
            return dataWriter.storeAsync().then(function (size) {
                output.size = position + size;
                return dataWriter.flushAsync().then(function () {
                    output.close();
                    return size;
                });
            });
        });
}

function writeTextAsync (storageFile, data, position) {
    return storageFile.openAsync(Windows.Storage.FileAccessMode.readWrite)
        .then(function (output) {
            output.seek(position);
            const dataWriter = new Windows.Storage.Streams.DataWriter(output);
            dataWriter.writeString(data);
            return dataWriter.storeAsync().then(function (size) {
                output.size = position + size;
                return dataWriter.flushAsync().then(function () {
                    output.close();
                    return size;
                });
            });
        });
}

function writeBlobAsync (storageFile, data, position) {
    return storageFile.openAsync(Windows.Storage.FileAccessMode.readWrite)
        .then(function (output) {
            output.seek(position);
            const dataSize = data.size;
            const input = (data.detachStream || data.msDetachStream).call(data);

            // Copy the stream from the blob to the File stream
            return Windows.Storage.Streams.RandomAccessStream.copyAsync(input, output)
                .then(function () {
                    output.size = position + dataSize;
                    return output.flushAsync().then(function () {
                        input.close();
                        output.close();

                        return dataSize;
                    });
                });
        });
}

function writeArrayBufferAsync (storageFile, data, position) {
    return writeBlobAsync(storageFile, new Blob([data]), position); // eslint-disable-line no-undef
}

function cordovaPathToNative (path) {
    // turn / into \\
    let cleanPath = path.replace(/\//g, '\\');
    // turn  \\ into \
    cleanPath = cleanPath.replace(/\\+/g, '\\');
    return cleanPath;
}

function nativePathToCordova (path) {
    const cleanPath = path.replace(/\\/g, '/');
    return cleanPath;
}

const driveRE = new RegExp('^[/]*([A-Z]:)');
const invalidNameRE = /[\\?*|"<>:]/;
function validName (name) {
    return !invalidNameRE.test(name.replace(driveRE, ''));
}

function sanitize (path) {
    const slashesRE = new RegExp('/{2,}', 'g');
    const components = path.replace(slashesRE, '/').split(/\/+/);
    // Remove double dots, use old school array iteration instead of RegExp
    // since it is impossible to debug them
    for (let index = 0; index < components.length; ++index) {
        if (components[index] === '..') {
            components.splice(index, 1);
            if (index > 0) {
                // if we're not in the start of array then remove preceeding path component,
                // In case if relative path points above the root directory, just ignore double dots
                // See file.spec.111 should not traverse above above the root directory for test case
                components.splice(index - 1, 1);
                --index;
            }
        }
    }
    return components.join('/');
}

const WinFS = function (name, root) {
    this.winpath = root.winpath;
    if (this.winpath && !/\/$/.test(this.winpath)) {
        this.winpath += '/';
    }
    this.makeNativeURL = function (path) {
        // CB-11848: This RE supposed to match all leading slashes in sanitized path.
        // Removing leading slash to avoid duplicating because this.root.nativeURL already has trailing slash
        const regLeadingSlashes = /^\/*/;
        const sanitizedPath = sanitize(path.replace(':', '%3A')).replace(regLeadingSlashes, '');
        return FileSystem.encodeURIPath(this.root.nativeURL + sanitizedPath);
    };
    root.fullPath = '/';
    if (!root.nativeURL) { root.nativeURL = 'file://' + sanitize(this.winpath + root.fullPath).replace(':', '%3A'); }
    WinFS.__super__.constructor.call(this, name, root);
};

utils.extend(WinFS, FileSystem);

WinFS.prototype.__format__ = function (fullPath) {
    const path = sanitize('/' + this.name + (fullPath[0] === '/' ? '' : '/') + FileSystem.encodeURIPath(fullPath));
    return 'cdvfile://localhost' + path;
};

const windowsPaths = {
    dataDirectory: 'ms-appdata:///local/',
    cacheDirectory: 'ms-appdata:///temp/',
    tempDirectory: 'ms-appdata:///temp/',
    syncedDataDirectory: 'ms-appdata:///roaming/',
    applicationDirectory: 'ms-appx:///',
    applicationStorageDirectory: 'ms-appx:///'
};

let AllFileSystems;

function getAllFS () {
    if (!AllFileSystems) {
        AllFileSystems = {
            persistent: Object.freeze(new WinFS('persistent', {
                name: 'persistent',
                nativeURL: 'ms-appdata:///local',
                winpath: nativePathToCordova(Windows.Storage.ApplicationData.current.localFolder.path)
            })),
            temporary: Object.freeze(new WinFS('temporary', {
                name: 'temporary',
                nativeURL: 'ms-appdata:///temp',
                winpath: nativePathToCordova(Windows.Storage.ApplicationData.current.temporaryFolder.path)
            })),
            application: Object.freeze(new WinFS('application', {
                name: 'application',
                nativeURL: 'ms-appx:///',
                winpath: nativePathToCordova(Windows.ApplicationModel.Package.current.installedLocation.path)
            })),
            root: Object.freeze(new WinFS('root', {
                name: 'root',
                // nativeURL: 'file:///'
                winpath: ''
            }))
        };
    }
    return AllFileSystems;
}

function getFS (name) {
    return getAllFS()[name];
}

FileSystem.prototype.__format__ = function (fullPath) {
    return getFS(this.name).__format__(fullPath);
};

require('./fileSystems').getFs = function (name, callback) {
    setTimeout(function () { callback(getFS(name)); });
};

function getFilesystemFromPath (path) {
    let res;
    const allfs = getAllFS();
    Object.keys(allfs).some(function (fsn) {
        const fs = allfs[fsn];
        if (path.indexOf(fs.winpath) === 0) { res = fs; }
        return res;
    });
    return res;
}

const msapplhRE = new RegExp('^ms-appdata://localhost/');
function pathFromURL (url) {
    url = url.replace(msapplhRE, 'ms-appdata:///');
    let path = decodeURIComponent(url);
    // support for file name with parameters
    if (/\?/g.test(path)) {
        path = String(path).split('?')[0];
    }
    if (path.indexOf('file:/') === 0) {
        if (path.indexOf('file://') !== 0) {
            url = 'file:///' + url.substr(6);
        }
    }

    // eslint-disable-next-line
    ['file://', 'ms-appdata:///', 'ms-appx://', 'cdvfile://localhost/'].every(function (p) {
        if (path.indexOf(p) !== 0) { return true; }
        const thirdSlash = path.indexOf('/', p.length);
        if (thirdSlash < 0) {
            path = '';
        } else {
            path = sanitize(path.substr(thirdSlash));
        }
    });

    return path.replace(driveRE, '$1');
}

function getFilesystemFromURL (url) {
    url = url.replace(msapplhRE, 'ms-appdata:///');
    let res;
    if (url.indexOf('file:/') === 0) { res = getFilesystemFromPath(pathFromURL(url)); } else {
        const allfs = getAllFS();
        Object.keys(allfs).every(function (fsn) {
            const fs = allfs[fsn];
            if (url.indexOf(fs.root.nativeURL) === 0 ||
                url.indexOf('cdvfile://localhost/' + fs.name + '/') === 0) {
                res = fs;
                return false;
            }
            return true;
        });
    }
    return res;
}

function getFsPathForWinPath (fs, wpath) {
    const path = nativePathToCordova(wpath);
    if (path.indexOf(fs.winpath) !== 0) { return null; }
    return path.replace(fs.winpath, '/');
}

const WinError = {
    invalidArgument: -2147024809,
    fileNotFound: -2147024894,
    accessDenied: -2147024891
};

function openPath (path, ops) {
    ops = ops || {};
    return new WinJS.Promise(function (complete, failed) {
        getFileFromPathAsync(path).done(
            function (file) {
                complete({ file });
            },
            function (err) {
                if (err.number !== WinError.fileNotFound && err.number !== WinError.invalidArgument) { failed(FileError.NOT_READABLE_ERR); }
                getFolderFromPathAsync(path)
                    .done(
                        function (dir) {
                            if (!ops.getContent) { complete({ folder: dir }); } else {
                                WinJS.Promise.join({
                                    files: dir.getFilesAsync(),
                                    folders: dir.getFoldersAsync()
                                }).done(
                                    function (a) {
                                        complete({
                                            folder: dir,
                                            files: a.files,
                                            folders: a.folders
                                        });
                                    },
                                    function () {
                                        failed(FileError.NOT_READABLE_ERR);
                                    }
                                );
                            }
                        },
                        function (err) {
                            if (err.number === WinError.fileNotFound || err.number === WinError.invalidArgument) { complete({}); } else { failed(FileError.NOT_READABLE_ERR); }
                        }
                    );
            }
        );
    });
}

function copyFolder (src, dst, name) {
    name = name || src.name;
    return new WinJS.Promise(function (complete, failed) {
        WinJS.Promise.join({
            fld: dst.createFolderAsync(name, Windows.Storage.CreationCollisionOption.openIfExists),
            files: src.getFilesAsync(),
            folders: src.getFoldersAsync()
        }).done(
            function (the) {
                if (!(the.files.length || the.folders.length)) {
                    complete();
                    return;
                }
                let todo = the.files.length;
                const copyfolders = function () {
                    if (!(todo--)) {
                        complete();
                        return;
                    }
                    copyFolder(the.folders[todo], dst).done(function () { copyfolders(); }, failed);
                };
                const copyfiles = function () {
                    if (!(todo--)) {
                        todo = the.folders.length;
                        copyfolders();
                        return;
                    }
                    the.files[todo].copyAsync(the.fld).done(function () { copyfiles(); }, failed);
                };
                copyfiles();
            },
            failed
        );
    });
}

function moveFolder (src, dst, name) {
    name = name || src.name;
    return new WinJS.Promise(function (complete, failed) {
        WinJS.Promise.join({
            fld: dst.createFolderAsync(name, Windows.Storage.CreationCollisionOption.openIfExists),
            files: src.getFilesAsync(),
            folders: src.getFoldersAsync()
        }).done(
            function (the) {
                if (!(the.files.length || the.folders.length)) {
                    complete();
                    return;
                }
                let todo = the.files.length;
                const movefolders = function () {
                    if (!(todo--)) {
                        src.deleteAsync().done(complete, failed);
                        return;
                    }
                    moveFolder(the.folders[todo], the.fld).done(movefolders, failed);
                };
                const movefiles = function () {
                    if (!(todo--)) {
                        todo = the.folders.length;
                        movefolders();
                        return;
                    }
                    the.files[todo].moveAsync(the.fld).done(function () { movefiles(); }, failed);
                };
                movefiles();
            },
            failed
        );
    });
}

function transport (success, fail, args, ops) { // ["fullPath","parent", "newName"]
    const src = args[0];
    const parent = args[1];
    const name = args[2];

    const srcFS = getFilesystemFromURL(src);
    const dstFS = getFilesystemFromURL(parent);
    const srcPath = pathFromURL(src);
    const dstPath = pathFromURL(parent);
    if (!(srcFS && dstFS && validName(name))) {
        fail(FileError.ENCODING_ERR);
        return;
    }

    const srcWinPath = cordovaPathToNative(sanitize(srcFS.winpath + srcPath));
    const dstWinPath = cordovaPathToNative(sanitize(dstFS.winpath + dstPath));
    const tgtFsPath = sanitize(dstPath + '/' + name);
    const tgtWinPath = cordovaPathToNative(sanitize(dstFS.winpath + dstPath + '/' + name));
    if (srcWinPath === dstWinPath || srcWinPath === tgtWinPath) {
        fail(FileError.INVALID_MODIFICATION_ERR);
        return;
    }

    WinJS.Promise.join({
        src: openPath(srcWinPath),
        dst: openPath(dstWinPath),
        tgt: openPath(tgtWinPath, { getContent: true })
    }).done(
        function (the) {
            if ((!the.dst.folder) || !(the.src.folder || the.src.file)) {
                fail(FileError.NOT_FOUND_ERR);
                return;
            }
            if ((the.src.folder && the.tgt.file) ||
                (the.src.file && the.tgt.folder) ||
                (the.tgt.folder && (the.tgt.files.length || the.tgt.folders.length))) {
                fail(FileError.INVALID_MODIFICATION_ERR);
                return;
            }
            if (the.src.file) {
                ops.fileOp(the.src.file, the.dst.folder, name, Windows.Storage.NameCollisionOption.replaceExisting)
                    .done(
                        function (storageFile) {
                            success(new FileEntry(
                                name,
                                tgtFsPath,
                                dstFS.name,
                                dstFS.makeNativeURL(tgtFsPath)
                            ));
                        },
                        function () {
                            fail(FileError.INVALID_MODIFICATION_ERR);
                        }
                    );
            } else {
                ops.folderOp(the.src.folder, the.dst.folder, name).done(
                    function () {
                        success(new DirectoryEntry(
                            name,
                            tgtFsPath,
                            dstFS.name,
                            dstFS.makeNativeURL(tgtFsPath)
                        ));
                    },
                    function () {
                        fail(FileError.INVALID_MODIFICATION_ERR);
                    }
                );
            }
        },
        function () {
            fail(FileError.INVALID_MODIFICATION_ERR);
        }
    );
}

module.exports = {
    requestAllFileSystems: function () {
        return getAllFS();
    },
    requestAllPaths: function (success) {
        success(windowsPaths);
    },
    getFileMetadata: function (success, fail, args) {
        module.exports.getMetadata(success, fail, args);
    },

    getMetadata: function (success, fail, args) {
        const fs = getFilesystemFromURL(args[0]);
        const path = pathFromURL(args[0]);
        if (!fs || !validName(path)) {
            fail(FileError.ENCODING_ERR);
            return;
        }
        const fullPath = cordovaPathToNative(fs.winpath + path);

        const getMetadataForFile = function (storageFile) {
            storageFile.getBasicPropertiesAsync().then(
                function (basicProperties) {
                    success(new File(storageFile.name, storageFile.path, storageFile.fileType, basicProperties.dateModified, basicProperties.size));
                }, function () {
                    fail(FileError.NOT_READABLE_ERR);
                }
            );
        };

        const getMetadataForFolder = function (storageFolder) {
            storageFolder.getBasicPropertiesAsync().then(
                function (basicProperties) {
                    const metadata = {
                        size: basicProperties.size,
                        lastModifiedDate: basicProperties.dateModified
                    };
                    success(metadata);
                },
                function () {
                    fail(FileError.NOT_READABLE_ERR);
                }
            );
        };

        getFileFromPathAsync(fullPath).then(getMetadataForFile,
            function () {
                getFolderFromPathAsync(fullPath).then(getMetadataForFolder,
                    function () {
                        fail(FileError.NOT_FOUND_ERR);
                    }
                );
            }
        );
    },

    getParent: function (win, fail, args) { // ["fullPath"]
        const fs = getFilesystemFromURL(args[0]);
        const path = pathFromURL(args[0]);
        if (!fs || !validName(path)) {
            fail(FileError.ENCODING_ERR);
            return;
        }
        if (!path || (new RegExp('/[^/]*/?$')).test(path)) {
            win(new DirectoryEntry(fs.root.name, fs.root.fullPath, fs.name, fs.makeNativeURL(fs.root.fullPath)));
            return;
        }

        const parpath = path.replace(new RegExp('/[^/]+/?$', 'g'), '');
        const parname = path.substr(parpath.length);
        const fullPath = cordovaPathToNative(fs.winpath + parpath);

        const result = new DirectoryEntry(parname, parpath, fs.name, fs.makeNativeURL(parpath));
        getFolderFromPathAsync(fullPath).done(
            function () { win(result); },
            function () { fail(FileError.INVALID_STATE_ERR); }
        );
    },

    readAsText: function (win, fail, args) {
        const url = args[0];
        const enc = args[1];
        let startPos = args[2];
        let endPos = args[3];

        const fs = getFilesystemFromURL(url);
        const path = pathFromURL(url);
        if (!fs) {
            fail(FileError.ENCODING_ERR);
            return;
        }
        const wpath = cordovaPathToNative(sanitize(fs.winpath + path));

        let encoding = Windows.Storage.Streams.UnicodeEncoding.utf8;
        if (enc === 'Utf16LE' || enc === 'utf16LE') {
            encoding = Windows.Storage.Streams.UnicodeEncoding.utf16LE;
        } else if (enc === 'Utf16BE' || enc === 'utf16BE') {
            encoding = Windows.Storage.Streams.UnicodeEncoding.utf16BE;
        }

        getFileFromPathAsync(wpath).then(function (file) {
            return file.openReadAsync();
        }).then(function (stream) {
            startPos = (startPos < 0) ? Math.max(stream.size + startPos, 0) : Math.min(stream.size, startPos);
            endPos = (endPos < 0) ? Math.max(endPos + stream.size, 0) : Math.min(stream.size, endPos);
            stream.seek(startPos);

            const readSize = endPos - startPos;
            const buffer = new Windows.Storage.Streams.Buffer(readSize);

            return stream.readAsync(buffer, readSize, Windows.Storage.Streams.InputStreamOptions.none);
        }).done(function (buffer) {
            try {
                win(Windows.Security.Cryptography.CryptographicBuffer.convertBinaryToString(encoding, buffer));
            } catch (e) {
                fail(FileError.ENCODING_ERR);
            }
        }, function () {
            fail(FileError.NOT_FOUND_ERR);
        });
    },

    readAsBinaryString: function (win, fail, args) {
        const url = args[0];
        const startPos = args[1];
        const endPos = args[2];

        const fs = getFilesystemFromURL(url);
        const path = pathFromURL(url);
        if (!fs) {
            fail(FileError.ENCODING_ERR);
            return;
        }
        const wpath = cordovaPathToNative(sanitize(fs.winpath + path));

        getFileFromPathAsync(wpath).then(
            function (storageFile) {
                Windows.Storage.FileIO.readBufferAsync(storageFile).done(
                    function (buffer) {
                        const dataReader = Windows.Storage.Streams.DataReader.fromBuffer(buffer);
                        // var fileContent = dataReader.readString(buffer.length);
                        const byteArray = new Uint8Array(buffer.length);
                        let byteString = '';
                        dataReader.readBytes(byteArray);
                        dataReader.close();
                        for (let i = 0; i < byteArray.length; i++) {
                            const charByte = byteArray[i];
                            // var charRepresentation = charByte <= 127 ? String.fromCharCode(charByte) : charByte.toString(16);
                            const charRepresentation = String.fromCharCode(charByte);
                            byteString += charRepresentation;
                        }
                        win(byteString.slice(startPos, endPos));
                    }
                );
            }, function () {
                fail(FileError.NOT_FOUND_ERR);
            }
        );
    },

    readAsArrayBuffer: function (win, fail, args) {
        const url = args[0];
        const fs = getFilesystemFromURL(url);
        const path = pathFromURL(url);
        if (!fs) {
            fail(FileError.ENCODING_ERR);
            return;
        }
        const wpath = cordovaPathToNative(sanitize(fs.winpath + path));

        getFileFromPathAsync(wpath).then(
            function (storageFile) {
                const blob = MSApp.createFileFromStorageFile(storageFile);
                const url = URL.createObjectURL(blob, { oneTimeOnly: true }); // eslint-disable-line no-undef
                const xhr = new XMLHttpRequest(); // eslint-disable-line no-undef
                xhr.open('GET', url, true);
                xhr.responseType = 'arraybuffer';
                xhr.onload = function () {
                    let resultArrayBuffer = xhr.response;
                    // get start and end position of bytes in buffer to be returned
                    const startPos = args[1] || 0;
                    const endPos = args[2] || resultArrayBuffer.length;
                    // if any of them is specified, we'll slice output array
                    if (startPos !== 0 || endPos !== resultArrayBuffer.length) {
                        // slice method supported only on Windows 8.1, so we need to check if it's available
                        // see http://msdn.microsoft.com/en-us/library/ie/dn641192(v=vs.94).aspx
                        if (resultArrayBuffer.slice) {
                            resultArrayBuffer = resultArrayBuffer.slice(startPos, endPos);
                        } else {
                            // if slice isn't available, we'll use workaround method
                            const tempArray = new Uint8Array(resultArrayBuffer);
                            const resBuffer = new ArrayBuffer(endPos - startPos);
                            const resArray = new Uint8Array(resBuffer);

                            for (let i = 0; i < resArray.length; i++) {
                                resArray[i] = tempArray[i + startPos];
                            }
                            resultArrayBuffer = resBuffer;
                        }
                    }
                    win(resultArrayBuffer);
                };
                xhr.send();
            }, function () {
                fail(FileError.NOT_FOUND_ERR);
            }
        );
    },

    readAsDataURL: function (win, fail, args) {
        const url = args[0];
        const fs = getFilesystemFromURL(url);
        const path = pathFromURL(url);
        if (!fs) {
            fail(FileError.ENCODING_ERR);
            return;
        }
        const wpath = cordovaPathToNative(sanitize(fs.winpath + path));

        getFileFromPathAsync(wpath).then(
            function (storageFile) {
                Windows.Storage.FileIO.readBufferAsync(storageFile).done(
                    function (buffer) {
                        let strBase64 = Windows.Security.Cryptography.CryptographicBuffer.encodeToBase64String(buffer);
                        // the method encodeToBase64String will add "77u/" as a prefix, so we should remove it
                        if (String(strBase64).substr(0, 4) === '77u/') {
                            strBase64 = strBase64.substr(4);
                        }
                        const mediaType = storageFile.contentType;
                        const result = 'data:' + mediaType + ';base64,' + strBase64;
                        win(result);
                    }
                );
            }, function () {
                fail(FileError.NOT_FOUND_ERR);
            }
        );
    },

    getDirectory: function (win, fail, args) {
        const dirurl = args[0];
        const path = args[1];
        const options = args[2];

        const fs = getFilesystemFromURL(dirurl);
        const dirpath = pathFromURL(dirurl);
        if (!fs || !validName(path)) {
            fail(FileError.ENCODING_ERR);
            return;
        }
        const fspath = sanitize(dirpath + '/' + path);
        const completePath = sanitize(fs.winpath + fspath);

        const name = completePath.substring(completePath.lastIndexOf('/') + 1);

        const wpath = cordovaPathToNative(completePath.substring(0, completePath.lastIndexOf('/')));

        let flag = '';
        if (options) {
            flag = new Flags(options.create, options.exclusive);
        } else {
            flag = new Flags(false, false);
        }

        getFolderFromPathAsync(wpath).done(
            function (storageFolder) {
                if (flag.create === true && flag.exclusive === true) {
                    storageFolder.createFolderAsync(name, Windows.Storage.CreationCollisionOption.failIfExists).done(
                        function (storageFolder) {
                            win(new DirectoryEntry(storageFolder.name, fspath, fs.name, fs.makeNativeURL(fspath)));
                        }, function (err) { // eslint-disable-line n/handle-callback-err
                            fail(FileError.PATH_EXISTS_ERR);
                        }
                    );
                } else if (flag.create === true && flag.exclusive === false) {
                    storageFolder.createFolderAsync(name, Windows.Storage.CreationCollisionOption.openIfExists).done(
                        function (storageFolder) {
                            win(new DirectoryEntry(storageFolder.name, fspath, fs.name, fs.makeNativeURL(fspath)));
                        }, function () {
                            fail(FileError.INVALID_MODIFICATION_ERR);
                        }
                    );
                } else if (flag.create === false) {
                    storageFolder.getFolderAsync(name).done(
                        function (storageFolder) {
                            win(new DirectoryEntry(storageFolder.name, fspath, fs.name, fs.makeNativeURL(fspath)));
                        },
                        function () {
                            // check if path actually points to a file
                            storageFolder.getFileAsync(name).done(
                                function () {
                                    fail(FileError.TYPE_MISMATCH_ERR);
                                }, function () {
                                    fail(FileError.NOT_FOUND_ERR);
                                }
                            );
                        }
                    );
                }
            }, function () {
                fail(FileError.NOT_FOUND_ERR);
            }
        );
    },

    remove: function (win, fail, args) {
        const fs = getFilesystemFromURL(args[0]);
        const path = pathFromURL(args[0]);
        if (!fs || !validName(path)) {
            fail(FileError.ENCODING_ERR);
            return;
        }

        // FileSystem root can't be removed!
        if (!path || path === '/') {
            fail(FileError.NO_MODIFICATION_ALLOWED_ERR);
            return;
        }
        const fullPath = cordovaPathToNative(fs.winpath + path);

        getFileFromPathAsync(fullPath).then(
            function (storageFile) {
                storageFile.deleteAsync().done(win, function () {
                    fail(FileError.INVALID_MODIFICATION_ERR);
                });
            },
            function () {
                getFolderFromPathAsync(fullPath).done(
                    function (sFolder) {
                        sFolder.getFilesAsync()
                        // check for files
                            .then(function (fileList) {
                                if (fileList) {
                                    if (fileList.length === 0) {
                                        return sFolder.getFoldersAsync();
                                    } else {
                                        fail(FileError.INVALID_MODIFICATION_ERR);
                                    }
                                }
                            })
                            // check for folders
                            .done(function (folderList) {
                                if (folderList) {
                                    if (folderList.length === 0) {
                                        sFolder.deleteAsync().done(
                                            win,
                                            function () {
                                                fail(FileError.INVALID_MODIFICATION_ERR);
                                            }
                                        );
                                    } else {
                                        fail(FileError.INVALID_MODIFICATION_ERR);
                                    }
                                }
                            });
                    },
                    function () {
                        fail(FileError.NOT_FOUND_ERR);
                    }
                );
            }
        );
    },

    removeRecursively: function (successCallback, fail, args) {
        const fs = getFilesystemFromURL(args[0]);
        const path = pathFromURL(args[0]);
        if (!fs || !validName(path)) {
            fail(FileError.ENCODING_ERR);
            return;
        }

        // FileSystem root can't be removed!
        if (!path || path === '/') {
            fail(FileError.NO_MODIFICATION_ALLOWED_ERR);
            return;
        }
        const fullPath = cordovaPathToNative(fs.winpath + path);

        getFolderFromPathAsync(fullPath).done(function (storageFolder) {
            storageFolder.deleteAsync().done(function (res) {
                successCallback(res);
            }, function (err) {
                fail(err);
            });
        }, function () {
            fail(FileError.FILE_NOT_FOUND_ERR);
        });
    },

    getFile: function (win, fail, args) {
        const dirurl = args[0];
        const path = args[1];
        const options = args[2];

        const fs = getFilesystemFromURL(dirurl);
        const dirpath = pathFromURL(dirurl);
        if (!fs || !validName(path)) {
            fail(FileError.ENCODING_ERR);
            return;
        }
        const fspath = sanitize(dirpath + '/' + path);
        const completePath = sanitize(fs.winpath + fspath);

        const fileName = completePath.substring(completePath.lastIndexOf('/') + 1);

        const wpath = cordovaPathToNative(completePath.substring(0, completePath.lastIndexOf('/')));

        let flag = '';
        if (options !== null) {
            flag = new Flags(options.create, options.exclusive);
        } else {
            flag = new Flags(false, false);
        }

        getFolderFromPathAsync(wpath).done(
            function (storageFolder) {
                if (flag.create === true && flag.exclusive === true) {
                    storageFolder.createFileAsync(fileName, Windows.Storage.CreationCollisionOption.failIfExists).done(
                        function (storageFile) {
                            win(new FileEntry(storageFile.name, fspath, fs.name, fs.makeNativeURL(fspath)));
                        }, function () {
                            fail(FileError.PATH_EXISTS_ERR);
                        }
                    );
                } else if (flag.create === true && flag.exclusive === false) {
                    storageFolder.createFileAsync(fileName, Windows.Storage.CreationCollisionOption.openIfExists).done(
                        function (storageFile) {
                            win(new FileEntry(storageFile.name, fspath, fs.name, fs.makeNativeURL(fspath)));
                        }, function () {
                            fail(FileError.INVALID_MODIFICATION_ERR);
                        }
                    );
                } else if (flag.create === false) {
                    storageFolder.getFileAsync(fileName).done(
                        function (storageFile) {
                            win(new FileEntry(storageFile.name, fspath, fs.name, fs.makeNativeURL(fspath)));
                        }, function () {
                            // check if path actually points to a folder
                            storageFolder.getFolderAsync(fileName).done(
                                function () {
                                    fail(FileError.TYPE_MISMATCH_ERR);
                                }, function () {
                                    fail(FileError.NOT_FOUND_ERR);
                                }
                            );
                        }
                    );
                }
            }, function (err) {
                fail(
                    err.number === WinError.accessDenied
                        ? FileError.SECURITY_ERR
                        : FileError.NOT_FOUND_ERR
                );
            }
        );
    },

    readEntries: function (win, fail, args) { // ["fullPath"]
        const fs = getFilesystemFromURL(args[0]);
        const path = pathFromURL(args[0]);
        if (!fs || !validName(path)) {
            fail(FileError.ENCODING_ERR);
            return;
        }
        const fullPath = cordovaPathToNative(fs.winpath + path);

        const result = [];

        getFolderFromPathAsync(fullPath).done(function (storageFolder) {
            const promiseArr = [];
            let index = 0;
            promiseArr[index++] = storageFolder.getFilesAsync().then(function (fileList) {
                if (fileList !== null) {
                    for (let i = 0; i < fileList.length; i++) {
                        const fspath = getFsPathForWinPath(fs, fileList[i].path);
                        if (!fspath) {
                            fail(FileError.NOT_FOUND_ERR);
                            return;
                        }
                        result.push(new FileEntry(fileList[i].name, fspath, fs.name, fs.makeNativeURL(fspath)));
                    }
                }
            });
            promiseArr[index++] = storageFolder.getFoldersAsync().then(function (folderList) {
                if (folderList !== null) {
                    for (let j = 0; j < folderList.length; j++) {
                        const fspath = getFsPathForWinPath(fs, folderList[j].path);
                        if (!fspath) {
                            fail(FileError.NOT_FOUND_ERR);
                            return;
                        }
                        result.push(new DirectoryEntry(folderList[j].name, fspath, fs.name, fs.makeNativeURL(fspath)));
                    }
                }
            });
            WinJS.Promise.join(promiseArr).then(function () {
                win(result);
            });
        }, function () { fail(FileError.NOT_FOUND_ERR); });
    },

    write: function (win, fail, args) {
        const url = args[0];
        const data = args[1];
        const position = args[2];
        const isBinary = args[3];

        const fs = getFilesystemFromURL(url);
        const path = pathFromURL(url);
        if (!fs) {
            fail(FileError.ENCODING_ERR);
            return;
        }
        const completePath = sanitize(fs.winpath + path);
        const fileName = completePath.substring(completePath.lastIndexOf('/') + 1);
        const dirpath = completePath.substring(0, completePath.lastIndexOf('/'));
        const wpath = cordovaPathToNative(dirpath);

        function getWriteMethodForData (data, isBinary) {
            if (data instanceof Blob) {
                return writeBlobAsync;
            }

            if (data instanceof ArrayBuffer) {
                return writeArrayBufferAsync;
            }

            if (isBinary) {
                return writeBytesAsync;
            }

            if (typeof data === 'string') {
                return writeTextAsync;
            }

            throw new Error('Unsupported data type for write method');
        }

        const writePromise = getWriteMethodForData(data, isBinary);

        getFolderFromPathAsync(wpath).done(
            function (storageFolder) {
                storageFolder.createFileAsync(fileName, Windows.Storage.CreationCollisionOption.openIfExists).done(
                    function (storageFile) {
                        writePromise(storageFile, data, position).done(
                            function (bytesWritten) {
                                const written = bytesWritten || data.length;
                                win(written);
                            },
                            function () {
                                fail(FileError.INVALID_MODIFICATION_ERR);
                            }
                        );
                    },
                    function () {
                        fail(FileError.INVALID_MODIFICATION_ERR);
                    }
                );
            },
            function () {
                fail(FileError.NOT_FOUND_ERR);
            }
        );
    },

    truncate: function (win, fail, args) { // ["fileName","size"]
        const url = args[0];
        const size = args[1];

        const fs = getFilesystemFromURL(url);
        const path = pathFromURL(url);
        if (!fs) {
            fail(FileError.ENCODING_ERR);
            return;
        }
        const completePath = sanitize(fs.winpath + path);
        const wpath = cordovaPathToNative(completePath);
        const dirwpath = cordovaPathToNative(completePath.substring(0, completePath.lastIndexOf('/')));

        getFileFromPathAsync(wpath).done(function (storageFile) {
            // the current length of the file.
            let leng = 0;

            storageFile.getBasicPropertiesAsync().then(function (basicProperties) {
                leng = basicProperties.size;
                if (Number(size) >= leng) {
                    win(this.length);
                    return;
                }
                if (Number(size) >= 0) {
                    Windows.Storage.FileIO.readTextAsync(storageFile, Windows.Storage.Streams.UnicodeEncoding.utf8).then(function (fileContent) {
                        fileContent = fileContent.substr(0, size);
                        const name = storageFile.name;
                        storageFile.deleteAsync().then(function () {
                            return getFolderFromPathAsync(dirwpath);
                        }).done(function (storageFolder) {
                            storageFolder.createFileAsync(name).then(function (newStorageFile) {
                                Windows.Storage.FileIO.writeTextAsync(newStorageFile, fileContent).done(function () {
                                    win(String(fileContent).length);
                                }, function () {
                                    fail(FileError.NO_MODIFICATION_ALLOWED_ERR);
                                });
                            }, function () {
                                fail(FileError.NO_MODIFICATION_ALLOWED_ERR);
                            });
                        });
                    }, function () { fail(FileError.NOT_FOUND_ERR); });
                }
            });
        }, function () { fail(FileError.NOT_FOUND_ERR); });
    },

    copyTo: function (success, fail, args) { // ["fullPath","parent", "newName"]
        transport(success, fail, args,
            {
                fileOp: function (file, folder, name, coll) {
                    return file.copyAsync(folder, name, coll);
                },
                folderOp: function (src, dst, name) {
                    return copyFolder(src, dst, name);
                }
            }
        );
    },

    moveTo: function (success, fail, args) {
        transport(success, fail, args,
            {
                fileOp: function (file, folder, name, coll) {
                    return file.moveAsync(folder, name, coll);
                },
                folderOp: function (src, dst, name) {
                    return moveFolder(src, dst, name);
                }
            }
        );
    },
    tempFileSystem: null,

    persistentFileSystem: null,

    requestFileSystem: function (win, fail, args) {
        const type = args[0];
        const size = args[1];
        const MAX_SIZE = 10000000000;
        if (size > MAX_SIZE) {
            fail(FileError.QUOTA_EXCEEDED_ERR);
            return;
        }

        let fs;
        switch (type) {
        case LocalFileSystem.TEMPORARY:
            fs = getFS('temporary');
            break;
        case LocalFileSystem.PERSISTENT:
            fs = getFS('persistent');
            break;
        }
        if (fs) { win(fs); } else { fail(FileError.NOT_FOUND_ERR); }
    },

    resolveLocalFileSystemURI: function (success, fail, args) {
        const uri = args[0];

        let path = pathFromURL(uri);
        const fs = getFilesystemFromURL(uri);
        if (!fs || !validName(path)) {
            fail(FileError.ENCODING_ERR);
            return;
        }
        if (path.indexOf(fs.winpath) === 0) { path = path.substr(fs.winpath.length); }
        const abspath = cordovaPathToNative(fs.winpath + path);

        getFileFromPathAsync(abspath).done(
            function (storageFile) {
                success(new FileEntry(storageFile.name, path, fs.name, fs.makeNativeURL(path)));
            }, function () {
                getFolderFromPathAsync(abspath).done(
                    function (storageFolder) {
                        success(new DirectoryEntry(storageFolder.name, path, fs.name, fs.makeNativeURL(path)));
                    }, function () {
                        fail(FileError.NOT_FOUND_ERR);
                    }
                );
            }
        );
    }
};

require('cordova/exec/proxy').add('File', module.exports);
