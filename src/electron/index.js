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

const { Buffer } = require('buffer');
const path = require('path');
const fs = require('fs-extra');
const { app } = require('electron');

const pathsPrefix = {
    applicationDirectory: path.dirname(app.getAppPath()) + path.sep,
    dataDirectory: app.getPath('userData') + path.sep,
    cacheDirectory: app.getPath('cache') + path.sep,
    tempDirectory: app.getPath('temp') + path.sep,
    documentsDirectory: app.getPath('documents') + path.sep
};

const FileError = {
    // Found in DOMException
    NOT_FOUND_ERR: 1,
    SECURITY_ERR: 2,
    ABORT_ERR: 3,

    // Added by File API specification
    NOT_READABLE_ERR: 4,
    ENCODING_ERR: 5,
    NO_MODIFICATION_ALLOWED_ERR: 6,
    INVALID_STATE_ERR: 7,
    SYNTAX_ERR: 8,
    INVALID_MODIFICATION_ERR: 9,
    QUOTA_EXCEEDED_ERR: 10,
    TYPE_MISMATCH_ERR: 11,
    PATH_EXISTS_ERR: 12

};

/**
 * Returns an an object that's converted by cordova to a FileEntry or a DirectoryEntry.
 * @param {boolean} isFile - is the object a file or a directory. true for file and false for directory.
 * @param {String} name - the name of the file.
 * @param {String} fullPath - the full path to the file.
 * @param {String} [filesystem = null] - the filesystem.
 * @param {String} [nativeURL = null] - the native URL of to the file.
 * @returns {Promise<Array>} - An object containing Entry information.
*/
function returnEntry (isFile, name, fullPath, filesystem = null, nativeURL = null) {
    return {
        isFile,
        isDirectory: !isFile,
        name,
        fullPath,
        filesystem,
        nativeURL: nativeURL ?? fullPath
    };
}

module.exports = {
    /**
     * Read the file contents as text
     *
     * @param {[fullPath: String]} params
     *      fullPath - the full path of the directory to read entries from
     * @returns {Promise<Array>} - An array of Entries in that directory
     *
     */
    readEntries: function ([fullPath]) {
        return new Promise((resolve, reject) => {
            fs.readdir(fullPath, { withFileTypes: true }, (err, files) => {
                if (err) {
                    reject(new Error(FileError.NOT_FOUND_ERR));
                    return;
                }

                const result = [];

                files.forEach(d => {
                    let absolutePath = fullPath + d.name;

                    if (d.isDirectory()) {
                        absolutePath += path.sep;
                    }

                    result.push({
                        isDirectory: d.isDirectory(),
                        isFile: d.isFile(),
                        name: d.name,
                        fullPath: absolutePath,
                        filesystemName: 'temporary',
                        nativeURL: absolutePath
                    });
                });

                resolve(result);
            });
        });
    },

    /**
     * Get the file given the path and fileName.
     *
     * @param {[dstDir: String, dstName: String, options: Object]} param
     *   dstDir: The fullPath to the directory the file is in.
     *   dstName: The filename including the extension.
     *   options: fileOptions {create: boolean, exclusive: boolean}.
     *
     * @returns {Promise<Object>} - The file object that is converted to FileEntry by cordova.
     */
    getFile,

    /**
     * get the file Metadata.
     *
     * @param {[fullPath: String]} param
     *  fullPath: the full path of the file including the extension.
     * @returns {Promise<Object>} - An Object containing the file metadata.
     */
    getFileMetadata: function ([fullPath]) {
        return new Promise((resolve, reject) => {
            fs.stat(fullPath, (err, stats) => {
                if (err) {
                    reject(new Error(FileError.NOT_FOUND_ERR));
                    return;
                }

                resolve({
                    name: path.basename(fullPath),
                    localURL: fullPath,
                    type: '',
                    lastModified: stats.mtime,
                    size: stats.size,
                    lastModifiedDate: stats.mtime
                });
            });
        });
    },

    /**
     * get the file or directory Metadata.
     *
     * @param {[fullPath: String]} param
     *      fullPath: the full path of the file or directory.
     * @returns {Promise<Object>} - An Object containing the metadata.
     */
    getMetadata: function ([url]) {
        return new Promise((resolve, reject) => {
            fs.stat(url, (err, stats) => {
                if (err) {
                    reject(new Error(FileError.NOT_FOUND_ERR));
                    return;
                }

                resolve({
                    modificationTime: stats.mtime,
                    size: stats.size
                });
            });
        });
    },

    /**
     * set the file or directory Metadata.
     *
     * @param {[fullPath: String, metadataObject: Object]} param
     *      fullPath: the full path of the file including the extension.
     *      metadataObject: the object containing metadataValues (currently only supports modificationTime)
     * @returns {Promise<Object>} - An Object containing the file metadata.
     */
    setMetadata: function ([fullPath, metadataObject]) {
        return new Promise((resolve, reject) => {
            const modificationTime = metadataObject.modificationTime;
            const utimesError = function (err) {
                if (err) {
                    reject(new Error(FileError.NOT_FOUND_ERR));
                    return;
                }
                resolve();
            };

            fs.utimes(fullPath, modificationTime, modificationTime, utimesError);
        });
    },

    /**
     * Read the file contents as text
     *
     * @param {[fileName: String, enc: String, startPos: number, endPos: number]} param
     *   fileName: The fullPath of the file to be read.
     *   enc: The encoding to use to read the file.
     *   startPos: The start position from which to begin reading the file.
     *   endPos: The end position at which to stop reading the file.
     *
     * @returns {Promise<String>} The string value within the file.
     */
    readAsText: function ([fileName, enc, startPos, endPos]) {
        return readAs('text', fileName, enc, startPos, endPos);
    },

    /**
     * Read the file as a data URL.
     *
     * @param {[fileName: String, startPos: number, endPos: number]} param
     *   fileName: The fullPath of the file to be read.
     *   startPos: The start position from which to begin reading the file.
     *   endPos: The end position at which to stop reading the file.
     *
     * @returns {Promise<String>} the file as a dataUrl.
     */
    readAsDataURL: function ([fileName, startPos, endPos]) {
        return readAs('dataURL', fileName, null, startPos, endPos);
    },

    /**
     * Read the file contents as binary string.
     *
     * @param {[fileName: String, startPos: number, endPos: number]} param
     *   fileName: The fullPath of the file to be read.
     *   startPos: The start position from which to begin reading the file.
     *   endPos: The end position at which to stop reading the file.
     *
     * @returns {Promise<String>} The file as a binary string.
     */
    readAsBinaryString: function ([fileName, startPos, endPos]) {
        return readAs('binaryString', fileName, null, startPos, endPos);
    },

    /**
     * Read the file contents as text
     *
     * @param {[fileName: String, startPos: number, endPos: number]} param
     *   fileName: The fullPath of the file to be read.
     *   startPos: The start position from which to begin reading the file.
     *   endPos: The end position at which to stop reading the file.
     *
     * @returns {Promise<Array>} The file as an arrayBuffer.
     */
    readAsArrayBuffer: function ([fileName, startPos, endPos]) {
        return readAs('arrayBuffer', fileName, null, startPos, endPos);
    },

    /**
     * Remove the file or directory
     *
     * @param {[fullPath: String]} param
     *   fullePath: The fullPath of the file or directory.
     *
     * @returns {Promise<void>} resolves when file or directory is deleted.
     */
    remove: function ([fullPath]) {
        return new Promise((resolve, reject) => {
            fs.stat(fullPath, (err, stats) => {
                if (err) {
                    reject(new Error(FileError.NOT_FOUND_ERR));
                    return;
                }
                if (stats.isDirectory() && fs.readdirSync(fullPath).length !== 0) {
                    reject(new Error(FileError.INVALID_MODIFICATION_ERR));
                    return;
                }
                fs.remove(fullPath)
                    .then(() => resolve())
                    .catch(() => {
                        reject(new Error(FileError.NO_MODIFICATION_ALLOWED_ERR));
                    });
            });
        });
    },

    /**
     * Remove the file or directory
     *
     * @param {[fullPath: String]} param
     *   fullePath: The fullPath of the file or directory.
     *
     * @returns {Promise<void>} resolves when file or directory is deleted.
     */
    removeRecursively: function ([fullPath]) {
        return new Promise((resolve, reject) => {
            fs.stat(fullPath, (err, stats) => {
                if (err) {
                    reject(new Error(FileError.NOT_FOUND_ERR));
                    return;
                }

                fs.remove(fullPath, (err) => {
                    if (err) {
                        reject(new Error(FileError.NO_MODIFICATION_ALLOWED_ERR));
                        return;
                    }
                    resolve();
                });
            });
        });
    },

    /**
     * Get the directory given the path and directory name.
     *
     * @param {[dstDir: String, dstName: String, options: Object]} param
     *   dstDir: The fullPath to the directory the directory is in.
     *   dstName: The name of the directory.
     *   options: options {create: boolean, exclusive: boolean}.
     *
     * @returns {Promise<Object>} The directory object that is converted to DirectoryEntry by cordova.
     */
    getDirectory,

    /**
     * Get the Parent directory
     *
     * @param {[url: String]} param
     *   url: The fullPath to the directory the directory is in.
     *
     * @returns {Promise<Object>} The parent directory object that is converted to DirectoryEntry by cordova.
     */
    getParent: function ([url]) {
        const parentPath = path.dirname(url);
        const parentName = path.basename(parentPath);
        const fullPath = path.dirname(parentPath) + path.sep;

        return getDirectory([fullPath, parentName, { create: false }]);
    },

    /**
     * Copy File
     *
     * @param {[srcPath: String, dstDir: String, dstName: String]} param
     *      srcPath: The fullPath to the file including extension.
     *      dstDir: The destination directory.
     *      dstName: The destination file name.
     *
     * @returns {Promise<Object>} The copied file.
     */
    copyTo: function ([srcPath, dstDir, dstName]) {
        return new Promise((resolve, reject) => {
            if (dstName.indexOf('/') !== -1 || path.resolve(srcPath) === path.resolve(dstDir + dstName)) {
                reject(new Error(FileError.INVALID_MODIFICATION_ERR));
                return;
            }
            if (!dstDir || !dstName) {
                reject(new Error(FileError.INVALID_MODIFICATION_ERR));
                return;
            }
            fs.stat(srcPath)
                .then((stats) => {
                    fs.copy(srcPath, dstDir + dstName, { recursive: stats.isDirectory() })
                        .then(async () => resolve(await stats.isDirectory() ? getDirectory([dstDir, dstName]) : getFile([dstDir, dstName])))
                        .catch(() => reject(new Error(FileError.ENCODING_ERR)));
                })
                .catch(() => reject(new Error(FileError.NOT_FOUND_ERR)));
        });
    },

    /**
     * Move File. Always Overwrites.
     *
     * @param {[srcPath: String, dstDir: String, dstName: String]} param
     *      srcPath: The fullPath to the file including extension.
     *      dstDir: The destination directory.
     *      dstName: The destination file name.
     *
     * @returns {Promise<Object>} The moved file.
     */
    moveTo: function ([srcPath, dstDir, dstName]) {
        return new Promise((resolve, reject) => {
            if (dstName.indexOf('/') !== -1 || path.resolve(srcPath) === path.resolve(dstDir + dstName)) {
                reject(new Error(FileError.INVALID_MODIFICATION_ERR));
                return;
            }
            if (!dstDir || !dstName) {
                reject(new Error(FileError.INVALID_MODIFICATION_ERR));
                return;
            }
            fs.stat(srcPath)
                .then((stats) => {
                    fs.move(srcPath, dstDir + dstName)
                        .then(async () => resolve(await stats.isDirectory() ? getDirectory([dstDir, dstName]) : getFile([dstDir, dstName])))
                        .catch(() => reject(new Error(FileError.ENCODING_ERR)));
                })
                .catch(() => reject(new Error(FileError.NOT_FOUND_ERR)));
        });
    },

    /**
     * resolve the File system URL as a FileEntry or a DirectoryEntry.
     *
     * @param {[uri: String]} param
     *      uri: The full path for the file.
     * @returns {Promise<Object>} The entry for the file or directory.
     */
    resolveLocalFileSystemURI: function ([uri]) {
        return new Promise((resolve, reject) => {
            // support for encodeURI
            if (/\%5/g.test(uri) || /\%20/g.test(uri)) { // eslint-disable-line no-useless-escape
                uri = decodeURI(uri);
            }

            // support for cdvfile
            if (uri.trim().substr(0, 7) === 'cdvfile') {
                if (uri.indexOf('cdvfile://localhost') === -1) {
                    reject(new Error(FileError.ENCODING_ERR));
                    return;
                }

                const indexApplication = uri.indexOf('application');
                const indexPersistent = uri.indexOf('persistent');
                const indexTemporary = uri.indexOf('temporary');

                if (indexApplication !== -1) { // cdvfile://localhost/application/path/to/file
                    uri = pathsPrefix.applicationDirectory + uri.substr(indexApplication + 12);
                } else if (indexPersistent !== -1) { // cdvfile://localhost/persistent/path/to/file
                    uri = pathsPrefix.dataDirectory + uri.substr(indexPersistent + 11);
                } else if (indexTemporary !== -1) { // cdvfile://localhost/temporary/path/to/file
                    uri = pathsPrefix.tempDirectory + uri.substr(indexTemporary + 10);
                } else {
                    reject(new Error(FileError.ENCODING_ERR));
                    return;
                }
            }

            fs.stat(uri, (err, stats) => {
                if (err) {
                    reject(new Error(FileError.NOT_FOUND_ERR));
                    return;
                }

                const baseName = path.basename(uri);
                if (stats.isDirectory()) {
                    // add trailing slash if it is missing
                    if ((uri) && !/\/$/.test(uri)) {
                        uri += '/';
                    }

                    resolve(returnEntry(false, baseName, uri));
                } else {
                    // remove trailing slash if it is present
                    if (uri && /\/$/.test(uri)) {
                        uri = uri.substring(0, uri.length - 1);
                    }

                    resolve(returnEntry(true, baseName, uri));
                }
            });
        });
    },

    /**
     * Gets all the path URLs.
     *
     * @returns {Object} returns an object with all the paths.
     */
    requestAllPaths: function () {
        return pathsPrefix;
    },

    /**
     * Write to a file.
     *
     * @param {[fileName: String, data: String, position: Number]} param
     *      fileName: the full path of the file including fileName and extension.
     *      data: the data to be written to the file.
     *      position: the position offset to start writing from.
     * @returns {Promise<Object>} An object with information about the amount of bytes written.
     */
    write: function ([fileName, data, position]) {
        return new Promise((resolve, reject) => {
            if (!data) {
                reject(new Error(FileError.INVALID_MODIFICATION_ERR));
                return;
            }

            const buf = Buffer.from(data);
            let bytesWritten = 0;

            fs.open(fileName, 'a')
                .then(fd => {
                    return fs.write(fd, buf, 0, buf.length, position)
                        .then(bw => { bytesWritten = bw.bytesWritten; })
                        .finally(() => fs.close(fd));
                })
                .then(() => resolve(bytesWritten))
                .catch(() => reject(new Error(FileError.INVALID_MODIFICATION_ERR)));
        });
    },

    /**
     * Truncate the file.
     *
     * @param {[fullPath: String, size: Number]} param
     *      fullPath: the full path of the file including file extension
     *      size: the length of the file to truncate to.
     * @returns {Promise}
     */
    truncate: function ([fullPath, size]) {
        return new Promise((resolve, reject) => {
            fs.truncate(fullPath, size, err => {
                if (err) {
                    reject(new Error(FileError.INVALID_STATE_ERR));
                    return;
                }

                resolve(size);
            });
        });
    },

    requestFileSystem: function ([type, size]) {
        if (type !== 0 && type !== 1) {
            throw new Error(FileError.INVALID_MODIFICATION_ERR);
        }

        const name = type === 0 ? 'temporary' : 'persistent';
        return {
            name,
            root: returnEntry(false, name, '/')
        };
    }
};

/** * Helpers ***/

/**
 * Read the file contents as specified.
 *
 * @param {[what: String, fileName: String, enc: String, startPos: number, endPos: number]} param
 *      what: what to read the file as. accepts 'text', 'dataURL', 'arrayBuffer' and 'binaryString'
 *      fileName: The fullPath of the file to be read.
 *      enc: The encoding to use to read the file.
 *      startPos: The start position from which to begin reading the file.
 *      endPos: The end position at which to stop reading the file.
 *
 * @returns {Promise<String>} The string value within the file.
 */
function readAs (what, fullPath, encoding, startPos, endPos) {
    return new Promise((resolve, reject) => {
        fs.open(fullPath, 'r', (err, fd) => {
            if (err) {
                reject(new Error(FileError.NOT_FOUND_ERR));
                return;
            }

            const buf = Buffer.alloc(endPos - startPos);

            fs.read(fd, buf, 0, buf.length, startPos)
                .then(() => {
                    switch (what) {
                    case 'text':
                        resolve(buf.toString(encoding));
                        break;
                    case 'dataURL':
                        resolve('data:;base64,' + buf.toString('base64'));
                        break;
                    case 'arrayBuffer':
                        resolve(buf);
                        break;
                    case 'binaryString':
                        resolve(buf.toString('binary'));
                        break;
                    }
                })
                .catch(() => reject(new Error(FileError.NOT_READABLE_ERR)))
                .then(() => fs.close(fd));
        });
    });
}

/**
 * Get the file given the path and fileName.
 *
 * @param {[dstDir: String, dstName: String, options: Object]} param
 *   dstDir: The fullPath to the directory the file is in.
 *   dstName: The filename including the extension.
 *   options: fileOptions {create: boolean, exclusive: boolean}.
 *
 * @returns {Promise<Object>} The file object that is converted to FileEntry by cordova.
 */
function getFile ([dstDir, dstName, options]) {
    const absolutePath = path.join(dstDir, dstName);
    options = options || {};
    return new Promise((resolve, reject) => {
        fs.stat(absolutePath, (err, stats) => {
            if (err && err.message && err.message.indexOf('ENOENT') !== 0) {
                reject(new Error(FileError.INVALID_STATE_ERR));
                return;
            }

            const exists = !err;
            const baseName = path.basename(absolutePath);

            function createFile () {
                fs.open(absolutePath, 'w', (err, fd) => {
                    if (err) {
                        reject(new Error(FileError.INVALID_STATE_ERR));
                        return;
                    }

                    fs.close(fd, (err) => {
                        if (err) {
                            reject(new Error(FileError.INVALID_STATE_ERR));
                            return;
                        }
                        resolve(returnEntry(true, baseName, absolutePath.replace('\\', '/')));
                    });
                });
            }

            if (options.create === true && options.exclusive === true && exists) {
                // If create and exclusive are both true, and the path already exists,
                // getFile must fail.
                reject(new Error(FileError.PATH_EXISTS_ERR));
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
                    reject(new Error(FileError.INVALID_MODIFICATION_ERR));
                }
            } else if (!options.create && !exists) {
                // If create is not true and the path doesn't exist, getFile must fail.
                reject(new Error(FileError.NOT_FOUND_ERR));
            } else if (!options.create && exists && stats.isDirectory()) {
                // If create is not true and the path exists, but is a directory, getFile
                // must fail.
                reject(new Error(FileError.TYPE_MISMATCH_ERR));
            } else {
                // Otherwise, if no other error occurs, getFile must return a FileEntry
                // corresponding to path.
                resolve(returnEntry(true, baseName, absolutePath.replace('\\', '/')));
            }
        });
    });
}

/**
 * Get the directory given the path and directory name.
 *
 * @param {[dstDir: String, dstName: String, options: Object]} param
 *   dstDir: The fullPath to the directory the directory is in.
 *   dstName: The name of the directory.
 *   options: options {create: boolean, exclusive: boolean}.
 *
 * @returns {Promise<Object>} The directory object that is converted to DirectoryEntry by cordova.
 */
function getDirectory ([dstDir, dstName, options]) {
    const absolutePath = dstDir + dstName;
    options = options || {};
    return new Promise((resolve, reject) => {
        fs.stat(absolutePath, (err, stats) => {
            if (err && err.message && err.message.indexOf('ENOENT') !== 0) {
                reject(new Error(FileError.INVALID_STATE_ERR));
                return;
            }

            const exists = !err;
            const baseName = path.basename(absolutePath);
            if (options.create === true && options.exclusive === true && exists) {
                // If create and exclusive are both true, and the path already exists,
                // getDirectory must fail.
                reject(new Error(FileError.PATH_EXISTS_ERR));
            } else if (options.create === true && !exists) {
                // If create is true, the path doesn't exist, and no other error occurs,
                // getDirectory must create it as a zero-length file and return a corresponding
                // MyDirectoryEntry.
                fs.mkdir(absolutePath, (err) => {
                    if (err) {
                        reject(new Error(FileError.PATH_EXISTS_ERR));
                        return;
                    }
                    resolve(returnEntry(false, baseName, absolutePath));
                });
            } else if (options.create === true && exists) {
                if (stats.isDirectory()) {
                    resolve(returnEntry(false, baseName, absolutePath));
                } else {
                    reject(new Error(FileError.INVALID_MODIFICATION_ERR));
                }
            } else if (!options.create && !exists) {
                // If create is not true and the path doesn't exist, getDirectory must fail.
                reject(new Error(FileError.NOT_FOUND_ERR));
            } else if (!options.create && exists && stats.isFile()) {
                // If create is not true and the path exists, but is a file, getDirectory
                // must fail.
                reject(new Error(FileError.TYPE_MISMATCH_ERR));
            } else {
                // Otherwise, if no other error occurs, getDirectory must return a
                // DirectoryEntry corresponding to path.
                resolve(returnEntry(false, baseName, absolutePath));
            }
        });
    });
}
