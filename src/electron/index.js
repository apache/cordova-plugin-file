const { Buffer } = require('node:buffer');
const path = require('node:path');
const fs = require('fs-extra');
const { app } = require('electron');

const FileError = require('../../www/FileError');

const pathsPrefix = {
    applicationDirectory: path.dirname(app.getAppPath()) + path.sep,
    dataDirectory: app.getPath('userData') + path.sep,
    cacheDirectory: app.getPath('cache') + path.sep,
    tempDirectory: app.getPath('temp') + path.sep,
    documentsDirectory: app.getPath('documents') + path.sep
};

function returnEntry (isFile, name, fullPath, filesystem = null, nativeURL = null) {
    return {
        isFile,
        isDirectory: !isFile,
        name,
        fullPath,
        filesystem,
        nativeURL
    };
}

module.exports = {
    readEntries: ([args]) => {
        const fullPath = args[0];
        return new Promise((resolve, reject) => {
            fs.readdir(fullPath, { withFileTypes: true }, (err, files) => {
                if (err) {
                    reject(err);
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

    getFile,

    getFileMetadata: ([args]) => {
        const fullPath = args[0];
        return new Promise((resolve, reject) => {
            fs.stat(fullPath, (err, stats) => {
                if (err) {
                    reject(FileError.NOT_FOUND_ERR);
                    return;
                }
                const baseName = path.basename(fullPath);
                resolve({ name: baseName, localURL: fullPath, type: '', lastModified: stats.mtime, size: stats.size, lastModifiedDate: stats.mtime });
            });
        });
    },

    getMetadata: ([args]) => {
        return new Promise((resolve, reject) => {
            fs.stat(args[0], (err, stats) => {
                if (err) {
                    reject(FileError.NOT_FOUND_ERR);
                    return;
                }
                resolve({
                    modificationTime: stats.mtime,
                    size: stats.size
                });
            });
        });
    },

    setMetadata: ([args]) => {
        const fullPath = args[0];
        const metadataObject = args[1];
        return new Promise((resolve, reject) => {
            fs.utimes(fullPath, metadataObject.modificationTime, metadataObject.modificationTime, (err) => {
                if (err) {
                    reject(FileError.NOT_FOUND_ERR);
                    return;
                }
                resolve();
            });
        });
    },

    readAsText: ([args]) => {
        const fileName = args[0];
        const enc = args[1];
        const startPos = args[2];
        const endPos = args[3];
        return readAs('text', fileName, enc, startPos, endPos);
    },

    readAsDataURL: ([args]) => {
        const fileName = args[0];
        const startPos = args[1];
        const endPos = args[2];

        return readAs('dataURL', fileName, null, startPos, endPos);
    },

    readAsBinaryString: ([args]) => {
        const fileName = args[0];
        const startPos = args[1];
        const endPos = args[2];

        return readAs('binaryString', fileName, null, startPos, endPos);
    },

    readAsArrayBuffer: ([args]) => {
        const fileName = args[0];
        const startPos = args[1];
        const endPos = args[2];

        return readAs('arrayBuffer', fileName, null, startPos, endPos);
    },

    remove: ([args]) => {
        const fullPath = args[0];
        return new Promise((resolve, reject) => {
            fs.stat(fullPath, (err, stats) => {
                if (err) {
                    reject(FileError.NOT_FOUND_ERR);
                    return;
                }
                fs.remove(fullPath, (err) => {
                    if (err) {
                        reject(FileError.NO_MODIFICATION_ALLOWED_ERR);
                        return;
                    }
                    resolve();
                });
            });
        });
    },

    removeRecursively: this.remove,

    getDirectory: getDirectory,

    getParent: ([args]) => {
        const parentPath = path.dirname(args[0]);
        const parentName = path.basename(parentPath);
        const fullPath = path.dirname(parentPath) + path.sep;

        return getDirectory([[fullPath, parentName, { create: false }]]);
    },

    copyTo: ([args]) => {
        const srcPath = args[0];
        const dstDir = args[1];
        const dstName = args[2];
        return new Promise((resolve, reject) => {
            fs.copyFile(srcPath, dstDir + dstName, async (err) => {
                if (err) {
                    reject(FileError.INVALID_MODIFICATION_ERR);
                    return;
                }
                resolve(await getFile([[dstDir, dstName]]));
            });
        });
    },

    moveTo: ([args]) => {
        const srcPath = args[0];
        // parentFullPath and name parameters is ignored because
        // args is being passed downstream to copyTo method
        const dstDir = args[1]; // eslint-disable-line
        const dstName = args[2]; // eslint-disable-line
        return new Promise((resolve, reject) => {
            fs.move(srcPath, dstDir + dstName, { overwrite: true })
                .then(async () => {
                    resolve(await getFile([[dstDir, dstName]]));
                })
                .catch(err => reject(err));
        });
    },

    resolveLocalFileSystemURI: ([args]) => {
        let uri = args[0];

        // support for encodeURI
        if (/\%5/g.test(uri) || /\%20/g.test(uri)) { // eslint-disable-line no-useless-escape
            uri = decodeURI(uri);
        }
        // support for cdvfile
        if (uri.trim().substr(0, 7) === 'cdvfile') {
            if (uri.indexOf('cdvfile://localhost') === -1) {
                reject(FileError.ENCODING_ERR);
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
                reject(FileError.ENCODING_ERR);
                return;
            }
        }

        return new Promise((resolve, reject) => {
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

    requestAllPaths: () => {
        return pathsPrefix;
    },

    write: ([args]) => {
        const fileName = args[0];
        const data = args[1];
        const position = args[2];
        const isBinary = args[3]; // eslint-disable-line no-unused-vars
        return new Promise((resolve, reject) => {
            if (!data) {
                reject(FileError.INVALID_MODIFICATION_ERR);
                return;
            }

            const buf = Buffer.from(data);
            let bytesWritten = 0;
            fs.open(fileName, 'a')
                .then(fd => {
                    return fs.write(fd, buf, 0, buf.length, position)
                        .then(bw => { bytesWritten = bw; })
                        .finally(() => fs.close(fd));
                })
                .then(() => resolve(bytesWritten))
                .catch(() => {
                    reject(FileError.INVALID_MODIFICATION_ERR);
                });
        });
    },

    truncate: ([args]) => {
        const fullPath = args[0];
        const size = args[1];
        return new Promise((resolve, reject) => {
            fs.truncate(fullPath, size, err => {
                if (err) {
                    reject(FileError.INVALID_STATE_ERR);
                    return;
                }
                resolve(size);
            });
        });
    }
};

/** * Helpers ***/

function readAs (what, fullPath, encoding, startPos, endPos) {
    return new Promise((resolve, reject) => {
        fs.open(fullPath, 'r', (err, fd) => {
            if (err) {
                reject(FileError.NOT_FOUND_ERR);
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
                .catch(() => {
                    reject(FileError.NOT_READABLE_ERR);
                })
                .then(() => fs.close(fd));
        });
    });
}

function getFile ([args]) {
    const absolutePath = args[0] + args[1];
    const options = args[2] || {};
    return new Promise((resolve, reject) => {
        fs.stat(absolutePath, (err, stats) => {
            if (err && err.message && err.message.indexOf('ENOENT') !== 0) {
                reject(FileError.INVALID_STATE_ERR);
                return;
            }
            const exists = !err;
            const baseName = path.basename(absolutePath);

            function createFile () {
                fs.open(absolutePath, 'w', (err, fd) => {
                    if (err) {
                        reject(FileError.INVALID_STATE_ERR);
                        return;
                    }
                    fs.close(fd, (err) => {
                        if (err) {
                            reject(FileError.INVALID_STATE_ERR);
                            return;
                        }
                        resolve(returnEntry(true, baseName, absolutePath));
                    });
                });
            }

            if (options.create === true && options.exclusive === true && exists) {
                // If create and exclusive are both true, and the path already exists,
                // getFile must fail.
                reject(FileError.PATH_EXISTS_ERR);
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
                    reject(FileError.INVALID_MODIFICATION_ERR);
                }
            } else if (!options.create && !exists) {
                // If create is not true and the path doesn't exist, getFile must fail.
                reject(FileError.NOT_FOUND_ERR);
            } else if (!options.create && exists && stats.isDirectory()) {
                // If create is not true and the path exists, but is a directory, getFile
                // must fail.
                reject(FileError.TYPE_MISMATCH_ERR);
            } else {
                // Otherwise, if no other error occurs, getFile must return a FileEntry
                // corresponding to path.
                resolve(returnEntry(true, baseName, absolutePath));
            }
        });
    });
}

function getDirectory ([args]) {
    const absolutePath = args[0] + args[1];
    const options = args[2] || {};
    return new Promise((resolve, reject) => {
        fs.stat(absolutePath, (err, stats) => {
            if (err && err.message && err.message.indexOf('ENOENT') !== 0) {
                reject(FileError.INVALID_STATE_ERR);
                return;
            }
            const exists = !err;
            const baseName = path.basename(absolutePath);

            if (options.create === true && options.exclusive === true && exists) {
                // If create and exclusive are both true, and the path already exists,
                // getDirectory must fail.
                reject(FileError.PATH_EXISTS_ERR);
            } else if (options.create === true && !exists) {
                // If create is true, the path doesn't exist, and no other error occurs,
                // getDirectory must create it as a zero-length file and return a corresponding
                // MyDirectoryEntry.
                fs.mkdir(absolutePath, (err) => {
                    if (err) {
                        reject(FileError.PATH_EXISTS_ERR);
                        return;
                    }
                    resolve(returnEntry(false, baseName, absolutePath));
                });
            } else if (options.create === true && exists) {
                if (stats.isDirectory()) {
                    resolve(returnEntry(false, baseName, absolutePath));
                } else {
                    reject(FileError.INVALID_MODIFICATION_ERR);
                }
            } else if (!options.create && !exists) {
                // If create is not true and the path doesn't exist, getDirectory must fail.
                reject(FileError.NOT_FOUND_ERR);
            } else if (!options.create && exists && stats.isFile()) {
                // If create is not true and the path exists, but is a file, getDirectory
                // must fail.
                reject(FileError.TYPE_MISMATCH_ERR);
            } else {
                // Otherwise, if no other error occurs, getDirectory must return a
                // DirectoryEntry corresponding to path.
                resolve(returnEntry(false, baseName, absolutePath));
            }
        });
    });
}
