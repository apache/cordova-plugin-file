const { Buffer } = require('node:buffer');
const fs = require('fs-extra');
const nodePath = require('path');
const app = require('electron').app;

const FileError = require('../../www/FileError');

const pathsPrefix = {
    applicationDirectory: nodePath.dirname(app.getAppPath()) + nodePath.sep,
    dataDirectory: app.getPath('userData') + nodePath.sep,
    cacheDirectory: app.getPath('cache') + nodePath.sep,
    tempDirectory: app.getPath('temp') + nodePath.sep,
    documentsDirectory: app.getPath('documents') + nodePath.sep
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
                const baseName = nodePath.basename(fullPath);
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
        const parentPath = nodePath.dirname(args[0]);
        const parentName = nodePath.basename(parentPath);
        const path = nodePath.dirname(parentPath) + nodePath.sep;

        return getDirectory([[path, parentName, { create: false }]]);
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
        let path = args[0];

        // support for encodeURI
        if (/\%5/g.test(path) || /\%20/g.test(path)) { // eslint-disable-line no-useless-escape
            path = decodeURI(path);
        }
        // support for cdvfile
        if (path.trim().substr(0, 7) === 'cdvfile') {
            if (path.indexOf('cdvfile://localhost') === -1) {
                reject(FileError.ENCODING_ERR);
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
                reject(FileError.ENCODING_ERR);
                return;
            }
        }

        return new Promise((resolve, reject) => {
            fs.stat(path, (err, stats) => {
                if (err) {
                    reject(new Error(FileError.NOT_FOUND_ERR));
                    return;
                }

                const baseName = nodePath.basename(path);
                if (stats.isDirectory()) {
                    // add trailing slash if it is missing
                    if ((path) && !/\/$/.test(path)) {
                        path += '/';
                    }
                    resolve(returnEntry(false, baseName, path));
                } else {
                    // remove trailing slash if it is present
                    if (path && /\/$/.test(path)) {
                        path = path.substring(0, path.length - 1);
                    }
                    resolve(returnEntry(true, baseName, path));
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
    const path = args[0] + args[1];
    const options = args[2] || {};
    return new Promise((resolve, reject) => {
        fs.stat(path, (err, stats) => {
            if (err && err.message && err.message.indexOf('ENOENT') !== 0) {
                reject(FileError.INVALID_STATE_ERR);
                return;
            }
            const exists = !err;
            const baseName = nodePath.basename(path);

            function createFile () {
                fs.open(path, 'w', (err, fd) => {
                    if (err) {
                        reject(FileError.INVALID_STATE_ERR);
                        return;
                    }
                    fs.close(fd, (err) => {
                        if (err) {
                            reject(FileError.INVALID_STATE_ERR);
                            return;
                        }
                        resolve(returnEntry(true, baseName, path));
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
                resolve(returnEntry(true, baseName, path));
            }
        });
    });
}

function getDirectory ([args]) {
    const path = args[0] + args[1];
    const options = args[2] || {};
    return new Promise((resolve, reject) => {
        fs.stat(path, (err, stats) => {
            if (err && err.message && err.message.indexOf('ENOENT') !== 0) {
                reject(FileError.INVALID_STATE_ERR);
                return;
            }
            const exists = !err;
            const baseName = nodePath.basename(path);

            if (options.create === true && options.exclusive === true && exists) {
                // If create and exclusive are both true, and the path already exists,
                // getDirectory must fail.
                reject(FileError.PATH_EXISTS_ERR);
            } else if (options.create === true && !exists) {
                // If create is true, the path doesn't exist, and no other error occurs,
                // getDirectory must create it as a zero-length file and return a corresponding
                // MyDirectoryEntry.
                fs.mkdir(path, (err) => {
                    if (err) {
                        reject(FileError.PATH_EXISTS_ERR);
                        return;
                    }
                    resolve(returnEntry(false, baseName, path));
                });
            } else if (options.create === true && exists) {
                if (stats.isDirectory()) {
                    resolve(returnEntry(false, baseName, path));
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
                resolve(returnEntry(false, baseName, path));
            }
        });
    });
}
