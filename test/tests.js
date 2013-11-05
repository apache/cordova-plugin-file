exports.init = function() {
  eval(require('org.apache.cordova.test-framework.test').injectJasmineInterface(this, 'this'));

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

function createFail(message, done) {
    return function() {
        console.log('[ERROR] ' + message);
        expect(true).toBe(false);
        done();
    };
}

function createMessageFail(label, done) {
    return function(message) {
        return function() {
            console.log('[ERROR] ' + label + ': ' + message);
            expect(true).toBe(false);
            done();
        };
    };
}

function createWin(message, done) {
    return function() {
        console.log('[ERROR: Unexpected success callback] ' + message);
        expect(false).toBe(true);
        done();
    };
}


describe('File API', function() {
    // Adding a Jasmine helper matcher, to report errors when comparing to FileError better.
    var fileErrorMap = {
        1: 'NOT_FOUND_ERR',
        2: 'SECURITY_ERR',
        3: 'ABORT_ERR',
        4: 'NOT_READABLE_ERR',
        5: 'ENCODING_ERR',
        6: 'NO_MODIFICATION_ALLOWED_ERR',
        7: 'INVALID_STATE_ERR',
        8: 'SYNTAX_ERR',
        9: 'INVALID_MODIFICATION_ERR',
        10:'QUOTA_EXCEEDED_ERR',
        11:'TYPE_MISMATCH_ERR',
        12:'PATH_EXISTS_ERR'
    };

    beforeEach(function() {
        addMatchers({
            toBeFileError: function(util, customEqualityTesters) {
                return {
                    compare: function(actual, code) {
                        var result = {};
                        result.pass = util.equals(actual.code, code, customEqualityTesters);
                        if (result.pass) {
                            result.message = "Expected " + actual + "not to be FileError with code " + fileErrorMap[code] + " (" + code + ")";
                        } else {
                            result.message = "Expected FileError with code " + fileErrorMap[actual.code] + " (" + actual.code + ") to be " + fileErrorMap[code] + "(" + code + ")";
                        }
                        return result;
                    }
                };
            },
            toCanonicallyMatch: function(util, customEqualityTesters) {
                return {
                    compare: function(actual, path) {
                        var result = {};
                        var a = path.split("/").join("").split("\\").join("");
                        var b = actual.split("/").join("").split("\\").join("");
                        result.pass = util.equals(a, b, customEqualityTesters);
                        if (result.pass) {
                            result.message = "Expected paths not to match : " + path;
                        } else {
                            result.message = "Expected paths to match : " + actual + " should be " + path;
                        }
                        return result;
                    }
                };
            }
        });
    });

    // HELPER FUNCTIONS

    // deletes specified file or directory
    var deleteEntry = function(entry, success, error) {
        error = error || success;
        if (entry.isDirectory === true) {
            entry.removeRecursively(success, error);
        } else {
            entry.remove(success, error);
        }
    };

    // deletes file, if it exists, then invokes callback
    var deleteFile = function(root, fileName, success, error) {
        error = error || success;
        root.getFile(fileName, null,
            // remove file system entry
            function(entry) {
                deleteEntry(entry, success, error);
            },
            // doesn't exist: OK
            success);
    };
    // deletes and re-creates the specified file
    var createFile = function(root, fileName, success, error) {
        deleteFile(root, fileName, function() {
            root.getFile(fileName, {create: true}, success, error);
        });
    };
    // deletes and re-creates the specified directory
    var createDirectory = function(root, dirName, success, error) {
        deleteFile(root, dirName, function() {
           root.getDirectory(dirName, {create: true}, success, error);
        });
    };

    describe('FileError object', function() {
        it("file.spec.1 should define FileError constants", function() {
            expect(FileError.NOT_FOUND_ERR).toBe(1);
            expect(FileError.SECURITY_ERR).toBe(2);
            expect(FileError.ABORT_ERR).toBe(3);
            expect(FileError.NOT_READABLE_ERR).toBe(4);
            expect(FileError.ENCODING_ERR).toBe(5);
            expect(FileError.NO_MODIFICATION_ALLOWED_ERR).toBe(6);
            expect(FileError.INVALID_STATE_ERR).toBe(7);
            expect(FileError.SYNTAX_ERR).toBe(8);
            expect(FileError.INVALID_MODIFICATION_ERR).toBe(9);
            expect(FileError.QUOTA_EXCEEDED_ERR).toBe(10);
            expect(FileError.TYPE_MISMATCH_ERR).toBe(11);
            expect(FileError.PATH_EXISTS_ERR).toBe(12);
        });
    });

    describe('LocalFileSystem', function() {

        it("file.spec.2 should define LocalFileSystem constants", function() {
            expect(LocalFileSystem.TEMPORARY).toBe(0);
            expect(LocalFileSystem.PERSISTENT).toBe(1);
        });

        describe('window.requestFileSystem', function() {
            it("file.spec.3 should be defined", function() {
                expect(window.requestFileSystem).toBeDefined();
            });

            it("file.spec.4 should be able to retrieve a PERSISTENT file system", function(done) {
                var fail = createFail('window.requestFileSystem', done);
                window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fileSystem) {
                    expect(fileSystem).toBeDefined();
                    expect(fileSystem.name).toBeDefined();
                    expect(fileSystem.name).toBe("persistent");
                    expect(fileSystem.root).toBeDefined();
                    done();
                }, fail);
            });

            it("file.spec.5 should be able to retrieve a TEMPORARY file system", function(done) {
                var fail = createFail('window.requestFileSystem', done);

                // Request the file system
                window.requestFileSystem(LocalFileSystem.TEMPORARY, 0, function(fileSystem) {
                    expect(fileSystem).toBeDefined();
                    expect(fileSystem.name).toBeDefined();
                    expect(fileSystem.name).toBe("temporary");
                    expect(fileSystem.root).toBeDefined();
                    done();
                }, fail);
            });

            it("file.spec.6 should error if you request a file system that is too large", function(done) {
                var win = createWin('window.requestFileSystem', done);

                // Request the file system
                window.requestFileSystem(LocalFileSystem.TEMPORARY, 1000000000000000, win, function(error) {
                    expect(error).toBeDefined();
                    expect(error).toBeFileError(FileError.QUOTA_EXCEEDED_ERR);
                    done();
                });
            });

            it("file.spec.7 should error out if you request a file system that does not exist", function(done) {
                var win = createWin('window.requestFileSystem', done);

                // Request the file system
                window.requestFileSystem(-1, 0, win, function(error) {
                    expect(error).toBeDefined();
                    expect(error).toBeFileError(FileError.SYNTAX_ERR);
                    done();
                });
            });
        });

        describe('window.resolveLocalFileSystemURI', function() {
            it("file.spec.8 should be defined", function() {
                expect(window.resolveLocalFileSystemURI).toBeDefined();
            });

            it("file.spec.9 should resolve a valid file name", function(done) {
                var fileName = "resolve.file.uri",
                    fail = createFail('window.resolveLocalFileSystemURI', done);

                // create a new file entry
                window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                    createFile(fs.root, fileName, function(entry) {
                        // lookup file system entry
                        window.resolveLocalFileSystemURI(entry.toURL(), function(fileEntry) {
                            expect(fileEntry).toBeDefined();
                            expect(fileEntry.name).toCanonicallyMatch(fileName);

                            // cleanup
                            deleteEntry(fileEntry,done,done);
                        }, fail);
                    }, fail);
                });
            });

            it("file.spec.10 resolve valid file name with parameters", function(done) {
                var fileName = "resolve.file.uri.params",
                    fail = createFail('window.resolveLocalFileSystemURI', done);

                // create a new file entry
                window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                    createFile(fs.root, fileName, function(entry) {
                        // lookup file system entry
                        window.resolveLocalFileSystemURI(entry.toURL() + "?1234567890", function(fileEntry) {
                            expect(fileEntry).toBeDefined();
                            expect(fileEntry.name).toBe(fileName);

                            // cleanup
                            deleteEntry(fileEntry,done,done);
                        }, fail);
                    }, fail);
                });
            });
            it("file.spec.11 should error (NOT_FOUND_ERR) when resolving (non-existent) invalid file name", function(done) {
                var win = createWin('window.resolveLocalFileSystemURI', done);

                // lookup file system entry
                window.resolveLocalFileSystemURI("file:///this.is.not.a.valid.file.txt", win, function(error) {
                    expect(error).toBeDefined();
                    expect(error).toBeFileError(FileError.NOT_FOUND_ERR);
                    done();
                });
            });
            it("file.spec.12 should error (ENCODING_ERR) when resolving invalid URI with leading /", function(done) {
                var win = createWin('window.resolveLocalFileSystemURI', done);

                // lookup file system entry
                window.resolveLocalFileSystemURI("/this.is.not.a.valid.url", win, function(error) {
                    expect(error).toBeDefined();
                    expect(error).toBeFileError(FileError.ENCODING_ERR);
                    done();
                });
            });
        });
    });

    describe('Metadata interface', function() {
        it("file.spec.13 should exist and have the right properties", function() {
            var metadata = new Metadata();
            expect(metadata).toBeDefined();
            expect(metadata.modificationTime).toBeDefined();
        });
    });

    describe('Flags interface', function() {
        it("file.spec.14 should exist and have the right properties", function() {
            var flags = new Flags(false, true);
            expect(flags).toBeDefined();
            expect(flags.create).toBeDefined();
            expect(flags.create).toBe(false);
            expect(flags.exclusive).toBeDefined();
            expect(flags.exclusive).toBe(true);
        });
    });

    describe('FileSystem interface', function() {
        it("file.spec.15 should have a root that is a DirectoryEntry", function(done) {
            var fail = createFail('FileSystem', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                window.resolveLocalFileSystemURI(fs.root.toURL(), function(entry) {
                    expect(entry).toBeDefined();
                    expect(entry.isFile).toBe(false);
                    expect(entry.isDirectory).toBe(true);
                    expect(entry.name).toBeDefined();
                    expect(entry.fullPath).toBeDefined();
                    expect(entry.getMetadata).toBeDefined();
                    expect(entry.moveTo).toBeDefined();
                    expect(entry.copyTo).toBeDefined();
                    expect(entry.toURL).toBeDefined();
                    expect(entry.remove).toBeDefined();
                    expect(entry.getParent).toBeDefined();
                    expect(entry.createReader).toBeDefined();
                    expect(entry.getFile).toBeDefined();
                    expect(entry.getDirectory).toBeDefined();
                    expect(entry.removeRecursively).toBeDefined();
                    done();
                }, fail);
            });
        });
    });

    describe('DirectoryEntry', function() {
        it("file.spec.16 getFile: get Entry for file that does not exist", function(done) {
            var fileName = "de.no.file",
                win = createWin('DirectoryEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                fs.root.getFile(fileName, {create:false}, win, function(error) {
                    expect(error).toBeDefined();
                    expect(error).toBeFileError(FileError.NOT_FOUND_ERR);
                    done();
                });
            });
        });
        it("file.spec.17 getFile: create new file", function(done) {
            var fileName = "de.create.file",
                fail = createFail('DirectoryEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var filePath = fs.root.fullPath + '/' + fileName;
                // create:true, exclusive:false, file does not exist
                fs.root.getFile(fileName, {create: true}, function(entry) {
                    expect(entry).toBeDefined();
                    expect(entry.isFile).toBe(true);
                    expect(entry.isDirectory).toBe(false);
                    expect(entry.name).toCanonicallyMatch(fileName);
                    expect(entry.fullPath).toBe(filePath);
                    // cleanup
                    entry.remove(done, done);
                }, fail);
            });
        });
        it("file.spec.18 getFile: create new file (exclusive)", function(done) {
            var fileName = "de.create.exclusive.file",
                fail = createFail('DirectoryEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var filePath = fs.root.fullPath + '/' + fileName;
                // create:true, exclusive:true, file does not exist
                fs.root.getFile(fileName, {create: true, exclusive:true}, function(entry) {
                    expect(entry).toBeDefined();
                    expect(entry.isFile).toBe(true);
                    expect(entry.isDirectory).toBe(false);
                    expect(entry.name).toBe(fileName);
                    expect(entry.fullPath).toBe(filePath);
    
                    // cleanup
                    entry.remove(done, done);
                }, fail);
            });
        });
        it("file.spec.19 getFile: create file that already exists", function(done) {
            var fileName = "de.create.existing.file",
                fail = createFail('DirectoryEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var filePath = fs.root.fullPath + '/' + fileName;

                // create file to kick off test
                fs.root.getFile(fileName, {create:true}, function(file) {
                    // Back to fs to try to get the new file
                    // create:true, exclusive:false, file exists
                    fs.root.getFile(fileName, {create:true}, function(entry) {
                        expect(entry).toBeDefined();
                        expect(entry.isFile).toBe(true);
                        expect(entry.isDirectory).toBe(false);
                        expect(entry.name).toCanonicallyMatch(fileName);
                        expect(entry.fullPath).toBe(filePath);
    
                        // cleanup
                        entry.remove(done, fail);
                    }, fail);
                },
                fail);
            });
        });
        it("file.spec.20 getFile: create file that already exists (exclusive)", function(done) {
            var fileName = "de.create.exclusive.existing.file",
                win = createWin('DirectoryEntry', done),
                fail = createFail('DirectoryEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // create file to kick off test
                fs.root.getFile(fileName, {create:true}, function(file) {
                    // create:true, exclusive:true, file exists
                    fs.root.getFile(fileName, {create:true, exclusive:true}, win, function(error) {
                        expect(error).toBeDefined();
                        expect(error).toBeFileError(FileError.PATH_EXISTS_ERR);

                        // cleanup
                        file.remove(done, fail);
                    });
                }, fail);
            });
        });
        it("file.spec.21 getFile: get Entry for existing file", function(done) {
            var fileName = "de.get.file",
                fail = createFail('DirectoryEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var filePath = fs.root.fullPath + '/' + fileName;
                // create file to kick off test
                fs.root.getFile(fileName, {create:true}, function(file) {
                    // create:false, exclusive:false, file exists
                    fs.root.getFile(fileName, {create:false}, function(entry) {
                    expect(entry).toBeDefined();
                    expect(entry.isFile).toBe(true);
                    expect(entry.isDirectory).toBe(false);
                    expect(entry.name).toCanonicallyMatch(fileName);
                    expect(entry.fullPath).toCanonicallyMatch(filePath);

                    entry.remove(done, fail); //clean up
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.22 DirectoryEntry.getFile: get FileEntry for invalid path", function(done) {
            var fileName = "de:invalid:path",
                win = createWin('DirectoryEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // create:false, exclusive:false, invalid path
                fs.root.getFile(fileName, {create:false}, win, function(error) {
                    expect(error).toBeDefined();
                    expect(error).toBeFileError(FileError.ENCODING_ERR);
                    done();
                });
            });
        });
        it("file.spec.23 DirectoryEntry.getDirectory: get Entry for directory that does not exist", function(done) {
            var dirName = "de.no.dir",
                win = createWin('DirectoryEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // create:false, exclusive:false, directory does not exist
                fs.root.getDirectory(dirName, {create:false}, win, function(error) {
                    expect(error).toBeDefined();
                    expect(error).toBeFileError(FileError.NOT_FOUND_ERR);
                    done();
                });
            });
        });
        it("file.spec.24 DirectoryEntry.getDirectory: create new dir with space then resolveFileSystemURI", function(done) {
            var dirName = "de create dir",
                fail = createFail('DirectoryEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var dirPath = fs.root.fullPath + '/' + dirName;
                // create:true, exclusive:false, directory does not exist
                fs.root.getDirectory(dirName, {create: true}, function(dirEntry) {
                    var dirURI = dirEntry.toURL();
                    // now encode URI and try to resolve
                    window.resolveLocalFileSystemURI(dirURI, function(directory) {
                        expect(directory).toBeDefined();
                        expect(directory.isFile).toBe(false);
                        expect(directory.isDirectory).toBe(true);
                        expect(directory.name).toCanonicallyMatch(dirName);
                        expect(directory.fullPath).toCanonicallyMatch(dirPath);

                        // cleanup
                        directory.remove(done, fail);
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.25 DirectoryEntry.getDirectory: create new dir with space resolveFileSystemURI with encoded URI", function(done) {
            var dirName = "de create dir",
                fail = createFail('DirectoryEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var dirPath = fs.root.fullPath + '/' + dirName;
                // create:true, exclusive:false, directory does not exist
                fs.root.getDirectory(dirName, {create: true}, function(dirEntry) {
                    var dirURI = dirEntry.toURL();
                    // now encode URI and try to resolve
                    window.resolveLocalFileSystemURI(encodeURI(dirURI), function(directory) {
                        expect(directory).toBeDefined();
                        expect(directory.isFile).toBe(false);
                        expect(directory.isDirectory).toBe(true);
                        expect(directory.name).toCanonicallyMatch(dirName);
                        expect(directory.fullPath).toCanonicallyMatch(dirPath);
                        // cleanup
                        directory.remove(done, fail);
                    }, fail);
                }, fail);
            });
        });

        it("file.spec.26 DirectoryEntry.getDirectory: create new directory", function(done) {
            var dirName = "de.create.dir",
                fail = createFail('DirectoryEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var dirPath = fs.root.fullPath + '/' + dirName;
                // create:true, exclusive:false, directory does not exist
                fs.root.getDirectory(dirName, {create: true}, function(directory) {
                    expect(directory).toBeDefined();
                    expect(directory.isFile).toBe(false);
                    expect(directory.isDirectory).toBe(true);
                    expect(directory.name).toCanonicallyMatch(dirName);
                    expect(directory.fullPath).toCanonicallyMatch(dirPath);

                    // cleanup
                    directory.remove(done, fail);
                }, fail);
            });
        });

        it("file.spec.27 DirectoryEntry.getDirectory: create new directory (exclusive)", function(done) {
            var dirName = "de.create.exclusive.dir",
                fail = createFail('DirectoryEntry', done);
            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var dirPath = fs.root.fullPath + '/' + dirName;
                // create:true, exclusive:true, directory does not exist
                fs.root.getDirectory(dirName, {create: true, exclusive:true}, function(directory) {
                    expect(directory).toBeDefined();
                    expect(directory.isFile).toBe(false);
                    expect(directory.isDirectory).toBe(true);
                    expect(directory.name).toCanonicallyMatch(dirName);
                    expect(directory.fullPath).toCanonicallyMatch(dirPath);

                    // cleanup
                    directory.remove(done, fail);
                }, fail);
            });
        });
        it("file.spec.28 DirectoryEntry.getDirectory: create directory that already exists", function(done) {
            var dirName = "de.create.existing.dir",
                fail = createFail('DirectoryEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var dirPath = fs.root.fullPath + '/' + dirName;
                // create directory to kick off test
                fs.root.getDirectory(dirName, {create:true}, function(directory) {
                    // create:true, exclusive:false, directory exists
                    fs.root.getDirectory(dirName, {create:true}, function(directory) {
                        expect(directory).toBeDefined();
                        expect(directory.isFile).toBe(false);
                        expect(directory.isDirectory).toBe(true);
                        expect(directory.name).toCanonicallyMatch(dirName);
                        expect(directory.fullPath).toCanonicallyMatch(dirPath);

                        // cleanup
                        directory.remove(done, fail);
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.29 DirectoryEntry.getDirectory: create directory that already exists (exclusive)", function(done) {
            var dirName = "de.create.exclusive.existing.dir",
                win = createWin('DirectoryEntry', done),
                fail = createFail('DirectoryEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // create directory to kick off test
                fs.root.getDirectory(dirName, {create:true}, function(directory) {
                    var existingDir = directory;
                    // create:true, exclusive:true, directory exists
                    fs.root.getDirectory(dirName, {create:true, exclusive:true}, win, function(error) {
                        expect(error).toBeDefined();
                        expect(error).toBeFileError(FileError.PATH_EXISTS_ERR);

                        // cleanup
                        existingDir.remove(done, fail);
                    });
                }, fail);
            });
        });
        it("file.spec.30 DirectoryEntry.getDirectory: get Entry for existing directory", function(done) {
            var dirName = "de.get.dir",
                fail = createFail('DirectoryEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var dirPath = fs.root.fullPath + '/' + dirName;
                // create directory to kick off test
                fs.root.getDirectory(dirName, {create:true}, function(directory) {
                    // create:false, exclusive:false, directory exists
                    fs.root.getDirectory(dirName, {create:false}, function(directory) {
                        expect(directory).toBeDefined();
                        expect(directory.isFile).toBe(false);
                        expect(directory.isDirectory).toBe(true);
                        expect(directory.name).toCanonicallyMatch(dirName);
                        expect(directory.fullPath).toCanonicallyMatch(dirPath);

                        // cleanup
                        directory.remove(done, fail);
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.31 DirectoryEntry.getDirectory: get DirectoryEntry for invalid path", function(done) {
            var dirName = "de:invalid:path",
                win = createWin('DirectoryEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // create:false, exclusive:false, invalid path
                fs.root.getDirectory(dirName, {create:false}, win, function(error) {
                    expect(error).toBeDefined();
                    expect(error).toBeFileError(FileError.ENCODING_ERR);
                    done();
                });
            });
        });
        it("file.spec.32 DirectoryEntry.getDirectory: get DirectoryEntry for existing file", function(done) {
            var fileName = "de.existing.file",
                win = createWin('DirectoryEntry', done),
                fail = createFail('DirectoryEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // create file to kick off test
                fs.root.getFile(fileName, {create:true}, function(file) {
                    var existingFile = file;
                    // create:false, exclusive:false, existing file
                    fs.root.getDirectory(fileName, {create:false}, win, function(error) {
                        expect(error).toBeDefined();
                        expect(error).toBeFileError(FileError.TYPE_MISMATCH_ERR);

                        // cleanup
                        existingFile.remove(done, done);
                    });
                }, fail);
            });
        });
        it("file.spec.33 DirectoryEntry.getFile: get FileEntry for existing directory", function(done) {
            var dirName = "de.existing.dir",
                fail = createFail('DirectoryEntry', done),
                win = createWin('DirectoryEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // create directory to kick off test
                fs.root.getDirectory(dirName, {create:true}, function(directory) {
                    var existingDir = directory;
                    // create:false, exclusive:false, existing directory
                    fs.root.getFile(dirName, {create:false}, win, function(error) {
                        expect(error).toBeDefined();
                        expect(error).toBeFileError(FileError.TYPE_MISMATCH_ERR);

                        // cleanup
                        existingDir.remove(done, done);
                    });
                }, fail);
            });

        });
        it("file.spec.34 DirectoryEntry.removeRecursively on directory", function(done) {
            var dirName = "de.removeRecursively",
                subDirName = "dir",
                fail = createFail('DirectoryEntry', done),
                win = createWin('DirectoryEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // create a new directory entry to kick off test
                fs.root.getDirectory(dirName, {create:true}, function(entry) {
                    // create a sub-directory within directory
                    entry.getDirectory(subDirName, {create: true}, function(directory) {
                        // delete directory
                        entry.removeRecursively(function() {
                            // test that removed directory no longer exists
                            fs.root.getDirectory(dirName, {create:false}, win, function(error) {
                                expect(error).toBeDefined();
                                expect(error).toBeFileError(FileError.NOT_FOUND_ERR);
                                done();
                            });
                        }, fail);
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.35 createReader: create reader on existing directory", function(done) {
            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // create reader for root directory
                var reader = fs.root.createReader();
                expect(reader).toBeDefined();
                expect(typeof reader.readEntries).toBe('function');
                done();
            });
        });
        it("file.spec.36 removeRecursively on root file system", function(done) {
            var win = createWin('DirectoryEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // remove root file system
                fs.root.removeRecursively(win, function(error) {
                    expect(error).toBeDefined();
                    expect(error).toBeFileError(FileError.NO_MODIFICATION_ALLOWED_ERR);
                    done();
                });
            });
        });
    });

    describe('DirectoryReader interface', function() {
        describe("readEntries", function() {
            it("file.spec.37 should read contents of existing directory", function(done) {
                var fail = createFail('DirectoryReader', done);

                window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                    // create reader for root directory
                    var reader = fs.root.createReader();
                    // read entries
                    reader.readEntries(function(entries) {
                        expect(entries).toBeDefined();
                        expect(entries instanceof Array).toBe(true);
                        done();
                    }, fail);
                });
            });
            it("file.spec.38 should read contents of directory that has been removed", function(done) {
                var dirName = "de.createReader.notfound",
                    fail = createFail('DirectoryReader', done),
                    win = createWin('DirectoryReader', done);

                window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                    // create a new directory entry to kick off test
                    fs.root.getDirectory(dirName, {create:true}, function(directory) {
                        // delete directory
                        directory.removeRecursively(function() {
                            // read entries
                            var reader = directory.createReader();
                            reader.readEntries(win, function(error) {
                                expect(error).toBeDefined();
                                expect(error).toBeFileError(FileError.NOT_FOUND_ERR);

                                fs.root.getDirectory(dirName, {create:false}, win, function(error) {
                                    expect(error).toBeDefined();
                                    expect(error).toBeFileError(FileError.NOT_FOUND_ERR);
                                    done();
                                });
                            });
                        }, fail);
                    }, fail);
                });
            });
        });
    });

    describe('File', function() {
        it("file.spec.39 constructor should be defined", function() {
            expect(File).toBeDefined();
            expect(typeof File).toBe('function');
        });
        it("file.spec.40 should be define File attributes", function() {
            var file = new File();
            expect(file.name).toBeDefined();
            expect(file.fullPath).toBeDefined();
            expect(file.type).toBeDefined();
            expect(file.lastModifiedDate).toBeDefined();
            expect(file.size).toBeDefined();
        });
    });

    describe('FileEntry', function() {
        it("file.spec.41 should be define FileEntry methods", function(done) {
            var fileName = "fe.methods",
                fail = createFail('FileEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // create a new file entry to kick off test
                fs.root.getFile(fileName, {create:true}, function(fileEntry) {
                    expect(fileEntry).toBeDefined();
                    expect(typeof fileEntry.createWriter).toBe('function');
                    expect(typeof fileEntry.file).toBe('function');

                    // cleanup
                    fileEntry.remove(done, fail);
                }, fail);
            });
        });
        it("file.spec.42 createWriter should return a FileWriter object", function(done) {
            var fileName = "fe.createWriter",
                fail = createFail('FileEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // create a new file entry to kick off test
                fs.root.getFile(fileName, {create:true}, function(fileEntry) {
                    var testFile = fileEntry;
                    fileEntry.createWriter(function(writer) {
                        expect(writer).toBeDefined();
                        expect(writer instanceof FileWriter).toBe(true);

                        // cleanup
                        testFile.remove(done, fail);
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.43 file should return a File object", function(done) {
            var fileName = "fe.file",
                fail = createFail('FileEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // create a new file entry to kick off test
                fs.root.getFile(fileName, {create:true}, function(fileEntry) {
                    var newFile = fileEntry;
                    fileEntry.file(function(file) {
                        expect(file).toBeDefined();
                        expect(file instanceof File).toBe(true);

                        // cleanup
                        newFile.remove(done, fail);
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.44 file: on File that has been removed", function(done) {
            var fileName = "fe.no.file",
                fail = createFail('FileEntry', done),
                win = createWin('FileEntry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // create a new file entry to kick off test
                fs.root.getFile(fileName, {create:true}, function(fileEntry) {
                    // delete file
                    fileEntry.remove(function() {
                        // create File object
                        fileEntry.file(win, function(error) {
                            expect(error).toBeDefined();
                            expect(error).toBeFileError(FileError.NOT_FOUND_ERR);
                            done();
                        });
                    }, fail);
                }, fail);
            });
        });
    });
    describe('Entry', function() {
        it("file.spec.45 Entry object", function(done) {
            var fileName = "entry",
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var fullPath = fs.root.fullPath + '/' + fileName;
                // create a new file entry
                createFile(fs.root, fileName, function(entry) {
                    expect(entry).toBeDefined();
                    expect(entry.isFile).toBe(true);
                    expect(entry.isDirectory).toBe(false);
                    expect(entry.name).toCanonicallyMatch(fileName);
                    expect(entry.fullPath).toCanonicallyMatch(fullPath);
                    expect(typeof entry.getMetadata).toBe('function');
                    expect(typeof entry.setMetadata).toBe('function');
                    expect(typeof entry.moveTo).toBe('function');
                    expect(typeof entry.copyTo).toBe('function');
                    expect(typeof entry.toURL).toBe('function');
                    expect(typeof entry.remove).toBe('function');
                    expect(typeof entry.getParent).toBe('function');
                    expect(typeof entry.createWriter).toBe('function');
                    expect(typeof entry.file).toBe('function');

                    // cleanup
                    entry.remove(done, done);
                }, fail);
            });
        });
        it("file.spec.46 Entry.getMetadata on file", function(done) {
            var fileName = "entry.metadata.file",
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // create a new file entry
                createFile(fs.root, fileName, function(entry) {
                    entry.getMetadata(function(metadata) {
                        expect(metadata).toBeDefined();
                        expect(metadata.modificationTime instanceof Date).toBe(true);

                        // cleanup
                        deleteEntry(entry, done, done);
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.47 Entry.getMetadata on directory", function(done) {
            var dirName = "entry.metadata.dir",
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // create a new directory entry
                createDirectory(fs.root, dirName, function(entry) {
                    entry.getMetadata(function(metadata) {
                        expect(metadata).toBeDefined();
                        expect(metadata.modificationTime instanceof Date).toBe(true);

                        // cleanup
                        deleteEntry(entry, done, done);
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.48 Entry.getParent on file in root file system", function(done) {
            var fileName = "entry.parent.file",
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var rootPath = fs.root.fullPath;
                // create a new file entry
                createFile(fs.root, fileName, function(entry) {
                    entry.getParent(function(parent) {
                        expect(parent).toBeDefined();
                        expect(parent.fullPath).toCanonicallyMatch(rootPath);

                        // cleanup
                        deleteEntry(entry, done, done);
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.49 Entry.getParent on directory in root file system", function(done) {
            var dirName = "entry.parent.dir",
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var rootPath = fs.root.fullPath;
                // create a new directory entry
                createDirectory(fs.root, dirName, function(entry) {
                    entry.getParent(function(parent) {
                        expect(parent).toBeDefined();
                        expect(parent.fullPath).toCanonicallyMatch(rootPath);

                        // cleanup
                        deleteEntry(entry, done, done);
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.50 Entry.getParent on root file system", function(done) {
            var fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var rootPath = fs.root.fullPath;
                // create a new directory entry
                fs.root.getParent(function(parent) {
                    expect(parent).toBeDefined();
                    expect(parent.fullPath).toCanonicallyMatch(rootPath);
                    done();
                }, fail);
            });
        });
        it("file.spec.51 Entry.toURL on file", function(done) {
            var fileName = "entry.uri.file",
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var rootPath = fs.root.fullPath;
                // create a new file entry
                createFile(fs.root, fileName, function(entry) {
                    var uri = entry.toURL();
                    expect(uri).toBeDefined();
                    expect(uri.indexOf(rootPath)).not.toBe(-1);

                    // cleanup
                    deleteEntry(entry, done, done);
                }, fail);
            });
        });
        it("file.spec.52 Entry.toURL on directory", function(done) {
            var dirName = "entry.uri.dir",
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var rootPath = fs.root.fullPath;
                // create a new directory entry
                createDirectory(fs.root, dirName, function(entry) {
                    var uri = entry.toURL();
                    expect(uri).toBeDefined();
                    expect(uri.indexOf(rootPath)).not.toBe(-1);

                    // cleanup
                    deleteEntry(entry, done, done);
                }, fail);
            });
        });
        it("file.spec.53 Entry.remove on file", function(done) {
            var fileName = "entry.rm.file",
                win = createWin('Entry', done),
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // create a new file entry
                createFile(fs.root, fileName, function(entry) {
                    expect(entry).toBeDefined();
                    entry.remove(function() {
                        fs.root.getFile(fileName, null, win, function(error) {
                            expect(error).toBeDefined();
                            expect(error).toBeFileError(FileError.NOT_FOUND_ERR);
                            // cleanup
                            deleteEntry(entry, done, done);
                        });
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.54 remove on empty directory", function(done) {
            var dirName = "entry.rm.dir",
                win = createWin('Entry', done),
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // create a new directory entry
                createDirectory(fs.root, dirName, function(entry) {
                    expect(entry).toBeDefined();
                    entry.remove(function() {
                        fs.root.getDirectory(dirName, null, win, function(error) {
                            expect(error).toBeDefined();
                            expect(error).toBeFileError(FileError.NOT_FOUND_ERR);
                            // cleanup
                            deleteEntry(entry, done, done);
                        });
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.55 remove on non-empty directory", function(done) {
            var dirName = "entry.rm.dir.not.empty",
                fileName = "remove.txt",
                win = createWin('Entry', done),
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var fullPath = fs.root.fullPath + '/' + dirName;
                // create a new directory entry
                createDirectory(fs.root, dirName, function(entry) {
                    // create a file within directory, then try to delete directory
                    entry.getFile(fileName, {create: true}, function(fileEntry) {
                        // delete directory
                        entry.remove(win, function(error) {
                            expect(error).toBeDefined();
                            expect(error).toBeFileError(FileError.INVALID_MODIFICATION_ERR);
                            // verify that dir still exists
                            fs.root.getDirectory(dirName, null, function(entry) {
                                expect(entry).toBeDefined();
                                expect(entry.fullPath).toCanonicallyMatch(fullPath);
                                // cleanup
                                deleteEntry(entry, done, done);
                            }, fail);
                        });
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.56 remove on root file system", function(done) {
            var win = createWin('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // remove entry that doesn't exist
                fs.root.remove(win, function(error) {
                    expect(error).toBeDefined();
                    expect(error).toBeFileError(FileError.NO_MODIFICATION_ALLOWED_ERR);
                    done();
                });
            });
        });
        it("file.spec.57 copyTo: file", function(done) {
            var file1 = "entry.copy.file1",
                file2 = "entry.copy.file2",
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var fullPath = fs.root.fullPath + '/' + file2;
                // create a new file entry to kick off test
                createFile(fs.root, file1, function(entry) {
                    // copy file1 to file2
                    entry.copyTo(fs.root, file2, function(entry) {
                        expect(entry).toBeDefined();
                        expect(entry.isFile).toBe(true);
                        expect(entry.isDirectory).toBe(false);
                        expect(entry.fullPath).toCanonicallyMatch(fullPath);
                        expect(entry.name).toCanonicallyMatch(file2);
                        fs.root.getFile(file2, {create:false}, function(entry2) {
                            // a bit redundant since copy returned this entry already
                            expect(entry2).toBeDefined();
                            expect(entry2.isFile).toBe(true);
                            expect(entry2.isDirectory).toBe(false);
                            expect(entry2.fullPath).toCanonicallyMatch(fullPath);
                            expect(entry2.name).toCanonicallyMatch(file2);

                            // cleanup
                            deleteEntry(entry, function() {
                                deleteEntry(entry2, done);
                            });
                        }, fail);
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.58 copyTo: file onto itself", function(done) {
            var file1 = "entry.copy.fos.file1",
                fail = createFail('Entry', done),
                win = createWin('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // create a new file entry to kick off test
                createFile(fs.root, file1, function(entry) {
                    // copy file1 onto itself
                    entry.copyTo(fs.root, null, win, function(error) {
                        expect(error).toBeDefined();
                        expect(error).toBeFileError(FileError.INVALID_MODIFICATION_ERR);

                        // cleanup
                        deleteEntry(entry, done, done);
                    });
                }, fail);
            });
        });
        it("file.spec.59 copyTo: directory", function(done) {
            var file1 = "file1",
                srcDir = "entry.copy.srcDir",
                dstDir = "entry.copy.dstDir",
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var dstPath = fs.root.fullPath + '/' + dstDir,
                    filePath = dstPath + '/' + file1;
                // create a new directory entry to kick off test
                createDirectory(fs.root, srcDir, function(srcDirEntry) {
                    // create a file within new directory
                    srcDirEntry.getFile(file1, {create: true}, function(fileEntry) {
                        // copy srcDir to dstDir
                        srcDirEntry.copyTo(fs.root, dstDir, function(directory) {
                            expect(directory).toBeDefined();
                            expect(directory.isFile).toBe(false);
                            expect(directory.isDirectory).toBe(true);
                            expect(directory.fullPath).toCanonicallyMatch(dstPath);
                            expect(directory.name).toCanonicallyMatch(dstDir);

                            fs.root.getDirectory(dstDir, {create:false}, function(dstDirEntry) {
                                 expect(dstDirEntry).toBeDefined();
                                 expect(dstDirEntry.isFile).toBe(false);
                                 expect(dstDirEntry.isDirectory).toBe(true);
                                 expect(dstDirEntry.fullPath).toCanonicallyMatch(dstPath);
                                 expect(dstDirEntry.name).toCanonicallyMatch(dstDir);

                                 dstDirEntry.getFile(file1, {create:false}, function(fileEntry) {
                                    expect(fileEntry).toBeDefined();
                                    expect(fileEntry.isFile).toBe(true);
                                    expect(fileEntry.isDirectory).toBe(false);
                                    expect(fileEntry.fullPath).toCanonicallyMatch(filePath);
                                    expect(fileEntry.name).toCanonicallyMatch(file1);

                                    // cleanup
                                    deleteEntry(srcDirEntry, function() {
                                        deleteEntry(dstDirEntry, done);
                                    });
                                 }, fail);
                            }, fail);
                        }, fail);
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.60 copyTo: directory to backup at same root directory", function(done) {
            var file1 = "file1",
                srcDir = "entry.copy.srcDirSame",
                dstDir = "entry.copy.srcDirSame-backup",
                failWith = createMessageFail('Entry copyTo: directory to backup at same root', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var dstPath = fs.root.fullPath + '/' + dstDir,
                    filePath = dstPath + '/' + file1;
                // create a new directory entry to kick off test
                createDirectory(fs.root, srcDir, function(srcDirEntry) {
                    // create a file within new directory
                    srcDirEntry.getFile(file1, {create: true}, function(fileEntry) {
                        // copy srcDir to dstDir
                        srcDirEntry.copyTo(fs.root, dstDir, function(directory) {
                            expect(directory).toBeDefined();
                            expect(directory.isFile).toBe(false);
                            expect(directory.isDirectory).toBe(true);
                            expect(directory.fullPath).toCanonicallyMatch(dstPath);
                            expect(directory.name).toCanonicallyMatch(dstDir);

                            fs.root.getDirectory(dstDir, {create:false}, function(dstDirEntry) {
                                 expect(dstDirEntry).toBeDefined();
                                 expect(dstDirEntry.isFile).toBe(false);
                                 expect(dstDirEntry.isDirectory).toBe(true);
                                 expect(dstDirEntry.fullPath).toCanonicallyMatch(dstPath);
                                 expect(dstDirEntry.name).toCanonicallyMatch(dstDir);

                                 dstDirEntry.getFile(file1, {create:false}, function(fileEntry) {
                                    expect(fileEntry).toBeDefined();
                                    expect(fileEntry.isFile).toBe(true);
                                    expect(fileEntry.isDirectory).toBe(false);
                                    expect(fileEntry.fullPath).toCanonicallyMatch(filePath);
                                    expect(fileEntry.name).toCanonicallyMatch(file1);

                                    // cleanup
                                    deleteEntry(srcDirEntry, function() {
                                        deleteEntry(dstDirEntry, done);
                                    });
                                 }, failWith("final getFile failed"));
                            }, failWith("final getDirectory failed"));
                        }, failWith("srcDirEntry.copyTo failed"));
                    }, failWith("initial getFile failed"));
                }, failWith("createDirectory failed"));
            });
        });
        it("file.spec.61 copyTo: directory onto itself", function(done) {
            var file1 = "file1",
                srcDir = "entry.copy.dos.srcDir",
                win = createWin('Entry', done),
                fail = createFail('Entry copyTo: directory onto itself', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var srcPath = fs.root.fullPath + '/' + srcDir,
                    filePath = srcPath + '/' + file1;
                // create a new directory entry to kick off test
                createDirectory(fs.root, srcDir, function(directory) {
                    // create a file within new directory
                    directory.getFile(file1, {create: true}, function(fileEntry) {
                        // copy srcDir onto itself
                        directory.copyTo(fs.root, null, win, function(error) {
                            expect(error).toBeDefined();
                            expect(error).toBeFileError(FileError.INVALID_MODIFICATION_ERR);
                            fs.root.getDirectory(srcDir, {create:false}, function(dirEntry) {
                                // returning confirms existence so just check fullPath entry
                                expect(dirEntry).toBeDefined();
                                expect(dirEntry.fullPath).toCanonicallyMatch(srcPath);
                                dirEntry.getFile(file1, {create:false}, function(fileEntry) {
                                    expect(fileEntry).toBeDefined();
                                    expect(fileEntry.fullPath).toCanonicallyMatch(filePath);
                                    // cleanup
                                    deleteEntry(directory, done);
                                }, fail);
                            }, fail);
                        });
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.62 copyTo: directory into itself", function(done) {
            var srcDir = "entry.copy.dis.srcDir",
                dstDir = "entry.copy.dis.dstDir",
                fail = createFail('Entry', done),
                win = createWin('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var srcPath = fs.root.fullPath + '/' + srcDir;
                // create a new directory entry to kick off test
                createDirectory(fs.root, srcDir, function(directory) {
                    // copy source directory into itself
                    directory.copyTo(directory, dstDir, win, function(error) {
                        expect(error).toBeDefined();
                        expect(error).toBeFileError(FileError.INVALID_MODIFICATION_ERR);
                        fs.root.getDirectory(srcDir, {create:false}, function(dirEntry) {
                            // returning confirms existence so just check fullPath entry
                            expect(dirEntry).toBeDefined();
                            expect(dirEntry.fullPath).toCanonicallyMatch(srcPath);

                            // cleanup
                            deleteEntry(directory, done);
                        }, fail);
                    });
                }, fail);
            });
        });
        it("file.spec.63 copyTo: directory that does not exist", function(done) {
            var file1 = "entry.copy.dnf.file1",
                dstDir = "entry.copy.dnf.dstDir",
                win = createWin('Entry', done),
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var filePath = fs.root.fullPath + '/' + file1,
                    dstPath = fs.root.fullPath + '/' + dstDir;
                // create a new file entry to kick off test
                createFile(fs.root, file1, function(entry) {
                    // copy file to target directory that does not exist
                    var directory = new DirectoryEntry();
                    directory.fullPath = dstPath;
                    entry.copyTo(directory, null, win, function(error) {
                        expect(error).toBeDefined();
                        expect(error).toBeFileError(FileError.NOT_FOUND_ERR);
                        fs.root.getFile(file1, {create: false}, function(fileEntry) {
                            expect(fileEntry).toBeDefined();
                            expect(fileEntry.fullPath).toCanonicallyMatch(filePath);

                            // cleanup
                            deleteEntry(entry, done);
                        }, fail);
                    });
                }, fail);
            });
        });
        it("file.spec.64 copyTo: invalid target name", function(done) {
            var file1 = "entry.copy.itn.file1",
                file2 = "bad:file:name",
                fail = createFail('Entry', done),
                win = createWin('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var filePath = fs.root.fullPath + '/' + file1;
                // create a new file entry
                createFile(fs.root, file1, function(entry) {
                    // copy file1 to file2
                    entry.copyTo(fs.root, file2, win, function(error) {
                        expect(error).toBeDefined();
                        expect(error).toBeFileError(FileError.ENCODING_ERR);
                        // cleanup
                        deleteEntry(entry, done);
                    });
                }, fail);
            });
        });
        it("file.spec.65 moveTo: file to same parent", function(done) {
            var file1 = "entry.move.fsp.file1",
                file2 = "entry.move.fsp.file2",
                fail = createFail('Entry', done),
                win = createWin('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var srcPath = fs.root.fullPath + '/' + file1,
                    dstPath = fs.root.fullPath + '/' + file2;
                // create a new file entry to kick off test
                createFile(fs.root, file1, function(firstEntry) {
                    // move file1 to file2
                    firstEntry.moveTo(fs.root, file2, function(secondEntry) {
                        expect(secondEntry).toBeDefined();
                        expect(secondEntry.isFile).toBe(true);
                        expect(secondEntry.isDirectory).toBe(false);
                        expect(secondEntry.fullPath).toCanonicallyMatch(dstPath);
                        expect(secondEntry.name).toCanonicallyMatch(file2);

                        fs.root.getFile(file2, {create:false}, function(fileEntry) {
                            expect(fileEntry).toBeDefined();
                            expect(fileEntry.fullPath).toCanonicallyMatch(dstPath);

                            fs.root.getFile(file1, {create:false}, win, function(error) {
                                expect(error).toBeDefined();
                                expect(error).toBeFileError(FileError.NOT_FOUND_ERR);

                                // cleanup
                                deleteEntry(firstEntry, function() {
                                    deleteEntry(secondEntry, done);
                                });
                            });
                        }, fail);
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.66 moveTo: file to new parent", function(done) {
            var file1 = "entry.move.fnp.file1",
                dir = "entry.move.fnp.dir",
                win = createWin('Entry', done),
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var dstPath = fs.root.fullPath + '/' + dir + '/' + file1;
                // ensure destination directory is cleaned up first
                deleteFile(fs.root, dir, function() {
                    // create a new file entry to kick off test
                    createFile(fs.root, file1, function(srcEntry) {
                        // move file1 to new directory
                        // create a parent directory to move file to
                        fs.root.getDirectory(dir, {create: true}, function(directory) {
                            // move the file
                            srcEntry.moveTo(directory, null, function(entry) {
                                expect(entry).toBeDefined();
                                expect(entry.isFile).toBe(true);
                                expect(entry.isDirectory).toBe(false);
                                expect(entry.fullPath).toCanonicallyMatch(dstPath);
                                expect(entry.name).toCanonicallyMatch(file1);
                                // test the moved file exists
                                directory.getFile(file1, {create:false}, function(fileEntry) {
                                    expect(fileEntry).toBeDefined();
                                    expect(fileEntry.fullPath).toCanonicallyMatch(dstPath);
                                    // test that the file has moved
                                    fs.root.getFile(file1, {create:false}, win, function(error) {
                                        expect(error).toBeDefined();
                                        expect(error).toBeFileError(FileError.NOT_FOUND_ERR);

                                        // cleanup
                                        deleteEntry(srcEntry, function() {
                                            deleteEntry(directory, done);
                                        });
                                    });
                                }, fail);
                            }, fail);
                        }, fail);
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.67 moveTo: directory to same parent", function(done) {
            var file1 = "file1",
                srcDir = "entry.move.dsp.srcDir",
                dstDir = "entry.move.dsp.dstDir",
                win = createWin('Entry', done),
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var srcPath = fs.root.fullPath + '/' + srcDir,
                    dstPath = fs.root.fullPath + '/' + dstDir,
                    filePath = dstPath + '/' + file1;
                // ensure destination directory is cleaned up before test
                deleteFile(fs.root, dstDir, function() {
                    // create a new directory entry to kick off test
                    createDirectory(fs.root, srcDir, function(srcDirectory) {
                        // create a file within directory
                        srcDirectory.getFile(file1, {create: true}, function(fileEntry) {
                            // move srcDir to dstDir
                            srcDirectory.moveTo(fs.root, dstDir, function(dstDirectory) {
                                expect(dstDirectory).toBeDefined();
                                expect(dstDirectory.isFile).toBe(false);
                                expect(dstDirectory.isDirectory).toBe(true);
                                expect(dstDirectory.fullPath).toCanonicallyMatch(dstPath);
                                expect(dstDirectory.name).toCanonicallyMatch(dstDir);
                                // test that moved file exists in destination dir
                                dstDirectory.getFile(file1, {create:false}, function(fileEntry) {
                                    expect(fileEntry).toBeDefined();
                                    expect(fileEntry.fullPath).toCanonicallyMatch(filePath);
                                    // check that the moved file no longer exists in original dir
                                    fs.root.getFile(file1, {create:false}, win, function(error) {
                                        expect(error).toBeDefined();
                                        expect(error).toBeFileError(FileError.NOT_FOUND_ERR);

                                        // cleanup
                                        deleteEntry(srcDirectory, function() {
                                            deleteEntry(dstDirectory, done);
                                        });
                                    });
                                }, fail);
                            }, fail);
                        }, fail);
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.68 moveTo: directory to same parent with same name", function(done) {
            var file1 = "file1",
                srcDir = "entry.move.dsp.srcDir",
                dstDir = "entry.move.dsp.srcDir-backup",
                win = createWin('Entry', done),
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var srcPath = fs.root.fullPath + '/' + srcDir,
                    dstPath = fs.root.fullPath + '/' + dstDir,
                    filePath = dstPath + '/' + file1;
                // ensure destination directory is cleaned up before test
                deleteFile(fs.root, dstDir, function() {
                    // create a new directory entry to kick off test
                    createDirectory(fs.root, srcDir, function(srcDirectory) {
                        // create a file within directory
                        srcDirectory.getFile(file1, {create: true}, function(fileEntry) {
                            // move srcDir to dstDir
                            srcDirectory.moveTo(fs.root, dstDir, function(dstDirectory) {
                                expect(dstDirectory).toBeDefined();
                                expect(dstDirectory.isFile).toBe(false);
                                expect(dstDirectory.isDirectory).toBe(true);
                                expect(dstDirectory.fullPath).toCanonicallyMatch(dstPath);
                                expect(dstDirectory.name).toCanonicallyMatch(dstDir);
                                // check that moved file exists in destination dir
                                dstDirectory.getFile(file1, {create:false}, function(fileEntry) {
                                    expect(fileEntry).toBeDefined();
                                    expect(fileEntry.fullPath).toCanonicallyMatch(filePath);
                                    // check that the moved file no longer exists in original dir
                                    fs.root.getFile(file1, {create:false}, win, function(error) {
                                        expect(error).toBeDefined();
                                        expect(error).toBeFileError(FileError.NOT_FOUND_ERR);

                                        // cleanup
                                        deleteEntry(srcDirectory, function() {
                                            deleteEntry(dstDirectory, done);
                                        });
                                    });
                                }, fail);
                            }, fail);
                        }, fail);
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.69 moveTo: directory to new parent", function(done) {
            var file1 = "file1",
                srcDir = "entry.move.dnp.srcDir",
                dstDir = "entry.move.dnp.dstDir",
                win = createWin('Entry', done),
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var srcPath = fs.root.fullPath + '/' + srcDir,
                    dstPath = fs.root.fullPath + '/' + dstDir;
                    filePath = dstPath + '/' + file1;
                // ensure destination directory is cleaned up before test
                deleteFile(fs.root, dstDir, function() {
                    // create a new directory entry to kick off test
                    createDirectory(fs.root, srcDir, function(srcDirectory) {
                        // create a file within directory
                        srcDirectory.getFile(file1, {create: true}, function(fileEntry) {
                            // move srcDir to dstDir
                            srcDirectory.moveTo(fs.root, dstDir, function(dstDirectory) {
                                expect(dstDirectory).toBeDefined();
                                expect(dstDirectory.isFile).toBe(false);
                                expect(dstDirectory.isDirectory).toBe(true);
                                expect(dstDirectory.fullPath).toCanonicallyMatch(dstPath);
                                expect(dstDirectory.name).toCanonicallyMatch(dstDir);
                                // test that moved file exists in destination dir
                                dstDirectory.getFile(file1, {create:false}, function(fileEntry) {
                                    expect(fileEntry).toBeDefined();
                                    expect(fileEntry.fullPath).toCanonicallyMatch(filePath);
                                    // test that the moved file no longer exists in original dir
                                    fs.root.getFile(file1, {create:false}, win, function(error) {
                                        expect(error).toBeDefined();
                                        expect(error).toBeFileError(FileError.NOT_FOUND_ERR);

                                        // cleanup
                                        deleteEntry(srcDirectory, function() {
                                            deleteEntry(dstDirectory, done);
                                        });
                                    });
                                }, fail);
                            }, fail);
                        }, fail);
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.70 moveTo: directory onto itself", function(done) {
            var file1 = "file1",
                srcDir = "entry.move.dos.srcDir",
                fail = createFail('Entry', done),
                win = createWin('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var srcPath = fs.root.fullPath + '/' + srcDir,
                    filePath = srcPath + '/' + file1;
                // create a new directory entry to kick off test
                createDirectory(fs.root, srcDir, function(directory) {
                    // create a file within new directory
                    directory.getFile(file1, {create: true}, function(fileEntry) {
                        // move srcDir onto itself
                        directory.moveTo(fs.root, null, win, function(error) {
                            expect(error).toBeDefined();
                            expect(error).toBeFileError(FileError.INVALID_MODIFICATION_ERR);
                            // test that original dir still exists
                            fs.root.getDirectory(srcDir, {create:false}, function(dirEntry) {
                                // returning confirms existence so just check fullPath entry
                                expect(dirEntry).toBeDefined();
                                expect(dirEntry.fullPath).toCanonicallyMatch(srcPath);
                                dirEntry.getFile(file1, {create:false}, function(fileEntry) {
                                    expect(fileEntry).toBeDefined();
                                    expect(fileEntry.fullPath).toCanonicallyMatch(filePath);

                                    // cleanup
                                    deleteEntry(directory, done);
                                }, fail);
                            }, fail);
                        });
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.71 moveTo: directory into itself", function(done) {
            var srcDir = "entry.move.dis.srcDir",
                dstDir = "entry.move.dis.dstDir",
                win = createWin('Entry', done),
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var srcPath = fs.root.fullPath + '/' + srcDir;
                // create a new directory entry to kick off test
                createDirectory(fs.root, srcDir, function(directory) {
                    // move source directory into itself
                    directory.moveTo(directory, dstDir, win, function(error) {
                        expect(error).toBeDefined();
                        expect(error).toBeFileError(FileError.INVALID_MODIFICATION_ERR);
                        // make sure original directory still exists
                        fs.root.getDirectory(srcDir, {create:false}, function(entry) {
                            expect(entry).toBeDefined();
                            expect(entry.fullPath).toCanonicallyMatch(srcPath);

                            // cleanup
                            deleteEntry(directory, done);
                        }, fail);
                    });
                }, fail);
            });
        });
        it("file.spec.72 moveTo: file onto itself", function(done) {
            var file1 = "entry.move.fos.file1",
                win = createWin('Entry', done),
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var filePath = fs.root.fullPath + '/' + file1;
                // create a new file entry to kick off test
                createFile(fs.root, file1, function(entry) {
                    // move file1 onto itself
                    entry.moveTo(fs.root, null, win, function(error) {
                        expect(error).toBeDefined();
                        expect(error).toBeFileError(FileError.INVALID_MODIFICATION_ERR);

                        //test that original file still exists
                        fs.root.getFile(file1, {create:false}, function(fileEntry) {
                            expect(fileEntry).toBeDefined();
                            expect(fileEntry.fullPath).toCanonicallyMatch(filePath);

                            // cleanup
                            deleteEntry(entry, done);
                        }, fail);
                    });
                }, fail);
            });
        });
        it("file.spec.73 moveTo: file onto existing directory", function(done) {
            var file1 = "entry.move.fod.file1",
                dstDir = "entry.move.fod.dstDir",
                subDir = "subDir",
                win = createWin('Entry', done),
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var dirPath = fs.root.fullPath + '/' + dstDir + '/' + subDir,
                    filePath = fs.root.fullPath + '/' + file1;
                // ensure destination directory is cleaned up before it
                deleteFile(fs.root, dstDir, function() {
                    // create a new file entry to kick off it
                    createFile(fs.root, file1, function(entry) {
                        // create top level directory
                        fs.root.getDirectory(dstDir, {create: true}, function(directory) {
                            // create sub-directory
                            directory.getDirectory(subDir, {create: true}, function(subdirectory) {
                                // move file1 onto sub-directory
                                entry.moveTo(directory, subDir, win, function(error) {
                                    expect(error).toBeDefined();
                                    expect(error).toBeFileError(FileError.INVALID_MODIFICATION_ERR);
                                    // check that original dir still exists
                                    directory.getDirectory(subDir, {create:false}, function(dirEntry) {
                                        expect(dirEntry).toBeDefined();
                                        expect(dirEntry.fullPath).toCanonicallyMatch(dirPath);
                                        // check that original file still exists
                                        fs.root.getFile(file1, {create:false}, function(fileEntry) {
                                            expect(fileEntry).toBeDefined();
                                            expect(fileEntry.fullPath).toCanonicallyMatch(filePath);

                                            // cleanup
                                            deleteEntry(entry, function() {
                                                deleteEntry(directory, done);
                                            });
                                        }, fail);
                                    }, fail);
                                });
                            }, fail);
                        }, fail);
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.74 moveTo: directory onto existing file", function(done) {
            var file1 = "entry.move.dof.file1",
                srcDir = "entry.move.dof.srcDir",
                win = createWin('Entry', done),
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var dirPath = fs.root.fullPath + '/' + srcDir,
                    filePath = fs.root.fullPath + '/' + file1;
                // create a new directory entry to kick off test
                createDirectory(fs.root, srcDir, function(entry) {
                    // create file
                    fs.root.getFile(file1, {create: true}, function(fileEntry) {
                        // move directory onto file
                        entry.moveTo(fs.root, file1, win, function(error) {
                            expect(error).toBeDefined();
                            expect(error).toBeFileError(FileError.INVALID_MODIFICATION_ERR);
                            // test that original directory exists
                            fs.root.getDirectory(srcDir, {create:false}, function(dirEntry) {
                                // returning confirms existence so just check fullPath entry
                                expect(dirEntry).toBeDefined();
                                expect(dirEntry.fullPath).toCanonicallyMatch(dirPath);
                                // test that original file exists
                                fs.root.getFile(file1, {create:false}, function(fileEntry) {
                                    expect(fileEntry).toBeDefined();
                                    expect(fileEntry.fullPath).toCanonicallyMatch(filePath);

                                    // cleanup
                                    deleteEntry(fileEntry, function() {
                                        deleteEntry(entry, done);
                                    });
                                }, fail);
                            }, fail);
                        });
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.75 copyTo: directory onto existing file", function(done) {
            var file1 = "entry.copy.dof.file1",
                srcDir = "entry.copy.dof.srcDir",
                win = createWin('Entry', done),
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var dirPath = fs.root.fullPath + '/' + srcDir,
                    filePath = fs.root.fullPath + '/' + file1;
                // create a new directory entry to kick off it
                createDirectory(fs.root, srcDir, function(entry) {
                    // create file
                    fs.root.getFile(file1, {create: true}, function(fileEntry) {
                        // move directory onto file
                        entry.copyTo(fs.root, file1, win, function(error) {
                            expect(error).toBeDefined();
                            expect(error).toBeFileError(FileError.INVALID_MODIFICATION_ERR);
                            //check that original dir still exists
                            fs.root.getDirectory(srcDir, {create:false}, function(dirEntry) {
                                // returning confirms existence so just check fullPath entry
                                expect(dirEntry).toBeDefined();
                                expect(dirEntry.fullPath).toCanonicallyMatch(dirPath);
                                // it that original file still exists
                                fs.root.getFile(file1, {create:false}, function(fileEntry) {
                                    expect(fileEntry).toBeDefined();
                                    expect(fileEntry.fullPath).toCanonicallyMatch(filePath);

                                    // cleanup
                                    deleteEntry(fileEntry, function() {
                                        deleteEntry(dirEntry, done);
                                    });
                                }, fail);
                            }, fail);
                        });
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.76 moveTo: directory onto directory that is not empty", function(done) {
            var srcDir = "entry.move.dod.srcDir",
                dstDir = "entry.move.dod.dstDir",
                subDir = "subDir",
                win = createWin('Entry', done),
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var srcPath = fs.root.fullPath + '/' + srcDir,
                    dstPath = fs.root.fullPath + '/' + dstDir + '/' + subDir;
                // ensure destination directory is cleaned up before it
                deleteFile(fs.root, dstDir, function() {
                    // create a new file entry to kick off it
                    createDirectory(fs.root, srcDir, function(entry) {
                        // create top level directory
                        fs.root.getDirectory(dstDir, {create: true}, function(directory) {
                            // create sub-directory
                            directory.getDirectory(subDir, {create: true}, function(subDirectory) {
                                // move srcDir onto dstDir (not empty)
                                entry.moveTo(fs.root, dstDir, win, function(error) {
                                    expect(error).toBeDefined();
                                    expect(error).toBeFileError(FileError.INVALID_MODIFICATION_ERR);

                                    // test that destination directory still exists
                                    directory.getDirectory(subDir, {create:false}, function(dirEntry) {
                                        // returning confirms existence so just check fullPath entry
                                        expect(dirEntry).toBeDefined();
                                        expect(dirEntry.fullPath).toCanonicallyMatch(dstPath);
                                        // test that source directory exists
                                        fs.root.getDirectory(srcDir,{create:false}, function(srcEntry) {
                                            expect(srcEntry).toBeDefined();
                                            expect(srcEntry.fullPath).toCanonicallyMatch(srcPath);
                                            // cleanup
                                            deleteEntry(entry, function() {
                                                deleteEntry(directory, done);
                                            });
                                        }, fail);
                                    }, fail);
                                });
                            }, fail);
                        }, fail);
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.77 moveTo: file replace existing file", function(done) {
            var file1 = "entry.move.frf.file1",
                file2 = "entry.move.frf.file2",
                win = createWin('Entry', done),
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var file1Path = fs.root.fullPath + '/' + file1,
                    file2Path = fs.root.fullPath + '/' + file2;
                // create a new directory entry to kick off it
                createFile(fs.root, file1, function(entry) {
                    // create file
                    fs.root.getFile(file2, {create: true}, function(fileEntry) {
                        // replace file2 with file1
                        entry.moveTo(fs.root, file2, function(entry) {
                            expect(entry).toBeDefined();
                            expect(entry.isFile).toBe(true);
                            expect(entry.isDirectory).toBe(false);
                            expect(entry.fullPath).toCanonicallyMatch(file2Path);
                            expect(entry.name).toCanonicallyMatch(file2);

                            // test that old file does not exists
                            fs.root.getFile(file1, {create:false}, win, function(error) {
                                expect(error).toBeDefined();
                                expect(error).toBeFileError(FileError.NOT_FOUND_ERR);
                                // test that new file exists
                                fs.root.getFile(file2, {create:false}, function(fileEntry) {
                                    expect(fileEntry).toBeDefined();
                                    expect(fileEntry.fullPath).toCanonicallyMatch(file2Path);

                                    // cleanup
                                    deleteEntry(entry, function() {
                                        deleteEntry(fileEntry, done);
                                    });
                                }, fail);
                            });
                        }, fail);
                    },fail);
                }, fail);
            });
        });
        it("file.spec.78 moveTo: directory replace empty directory", function(done) {
            var file1 = "file1",
                srcDir = "entry.move.drd.srcDir",
                dstDir = "entry.move.drd.dstDir",
                win = createWin('Entry', done),
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var srcPath = fs.root.fullPath + '/' + srcDir,
                    dstPath = fs.root.fullPath + '/' + dstDir,
                    filePath = dstPath + '/' + file1;
                // ensure destination directory is cleaned up before test
                deleteFile(fs.root, dstDir, function() {
                    // create a new directory entry to kick off test
                    createDirectory(fs.root, srcDir, function(srcDirectoryEntry) {
                        // create a file within source directory
                        srcDirectoryEntry.getFile(file1, {create: true}, function(fileEntry) {
                            // create destination directory
                            fs.root.getDirectory(dstDir, {create: true}, function(dstDirectoryEntry) {
                                // move srcDir to dstDir
                                srcDirectoryEntry.moveTo(fs.root, dstDir, function(directory) {
                                    expect(directory).toBeDefined();
                                    expect(directory.isFile).toBe(false);
                                    expect(directory.isDirectory).toBe(true);
                                    expect(directory.fullPath).toCanonicallyMatch(dstPath);
                                    expect(directory.name).toCanonicallyMatch(dstDir);
                                    // check that old directory contents have been moved
                                    directory.getFile(file1, {create:false}, function(fileEntry) {
                                        expect(fileEntry).toBeDefined();
                                        expect(fileEntry.fullPath).toCanonicallyMatch(filePath);

                                        // check that old directory no longer exists
                                        fs.root.getDirectory(srcDir, {create:false}, win, function(error) {
                                            expect(error).toBeDefined();
                                            expect(error).toBeFileError(FileError.NOT_FOUND_ERR);

                                            // cleanup
                                            deleteEntry(srcDirectoryEntry, function() {
                                                deleteEntry(dstDirectoryEntry, done);
                                            });
                                        });
                                    }, fail);
                                }, fail);
                            }, fail);
                        }, fail);
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.79 moveTo: directory that does not exist", function(done) {
            var file1 = "entry.move.dnf.file1",
                dstDir = "entry.move.dnf.dstDir",
                win = createWin('Entry', done),
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var filePath = fs.root.fullPath + '/' + file1,
                    dstPath = fs.root.fullPath + '/' + dstDir;
                // create a new file entry to kick off test
                createFile(fs.root, file1, function(entry) {
                    // move file to directory that does not exist
                    directory = new DirectoryEntry();
                    directory.fullPath = dstPath;
                    entry.moveTo(directory, null, win, function(error) {
                        expect(error).toBeDefined();
                        expect(error).toBeFileError(FileError.NOT_FOUND_ERR);

                        // cleanup
                        deleteEntry(entry, done);
                    });
                }, fail);
            });
        });
        it("file.spec.80 moveTo: invalid target name", function(done) {
            var file1 = "entry.move.itn.file1",
                file2 = "bad:file:name",
                win = createWin('Entry', done),
                fail = createFail('Entry', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // create a new file entry to kick off it
                createFile(fs.root, file1, function(entry) {
                    // move file1 to file2
                    entry.moveTo(fs.root, file2, win, function(error) {
                        expect(error).toBeDefined();
                        expect(error).toBeFileError(FileError.ENCODING_ERR);

                        // cleanup
                        deleteEntry(entry, done);
                    });
                }, fail);
            });
        });
    });

    describe('FileReader', function() {
        it("file.spec.81 should have correct methods", function() {
            var reader = new FileReader();
            expect(reader).toBeDefined();
            expect(typeof reader.readAsBinaryString).toBe('function');
            expect(typeof reader.readAsDataURL).toBe('function');
            expect(typeof reader.readAsText).toBe('function');
            expect(typeof reader.readAsArrayBuffer).toBe('function');
            expect(typeof reader.abort).toBe('function');
        });
    });

    describe('read method', function(){
        it("file.spec.82 should error out on non-existent file", function(done) {
            var verifier = function(evt) {
                expect(evt).toBeDefined();
                expect(evt.target.error).toBeFileError(FileError.NOT_FOUND_ERR);
                done();
            };
            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var reader = new FileReader();
                var myFile = new File();
                reader.onerror = verifier;
                myFile.fullPath = fs.root.fullPath + '/' + "doesnotexist.err";
                reader.readAsText(myFile);
            });
        });
        it("file.spec.83 should be able to read native blob objects", function(done) {
            // Skip test if blobs are not supported (e.g.: Android 2.3).
            if (typeof window.Blob == 'undefined' || typeof window.Uint8Array == 'undefined') {
                done();
            }
            var contents = 'asdf';
            var uint8Array = new Uint8Array(contents.length);
            for (var i = 0; i < contents.length; ++i) {
              uint8Array[i] = contents.charCodeAt(i);
            }
            var Builder = window.BlobBuilder || window.WebKitBlobBuilder;
            var blob;
            if (Builder) {
                var builder = new Builder();
                builder.append(uint8Array.buffer);
                builder.append(contents);
                blob = builder.getBlob("text/plain");
            } else {
                try {
                    // iOS 6 does not support Views, so pass in the buffer.
                    blob = new Blob([uint8Array.buffer, contents]);
                } catch (e) {
                    // Skip the test if we can't create a blob (e.g.: iOS 5).
                    if (e instanceof TypeError) {
                        return;
                    }
                    throw e;
                }
            }
            var verifier = function(evt) {
                expect(evt).toBeDefined();
                expect(evt.target.result).toBe('asdfasdf');
                done();
            };
            var reader = new FileReader();
            reader.onloadend = verifier;
            reader.readAsText(blob);
        });

        function writeDummyFile(root, writeBinary, callback, done) {
            var fileName = "dummy.txt",
                fileEntry = null,
                writerFail = createFail('createWriter', done),
                getFileFail = createFail('getFile', done),
                fileFail = createFail('file', done),
                fileData = '\u20AC\xEB - There is an exception to every rule.  Except this one.',
                fileDataAsBinaryString = '\xe2\x82\xac\xc3\xab - There is an exception to every rule.  Except this one.',
                // writes file and reads it back in
                writeFile = function(writer) {
                    writer.onwriteend = function() {
                        fileEntry.file(function(f) {
                            callback(fileEntry, f, fileData, fileDataAsBinaryString);
                        }, fileFail);
                    };
                    writer.write(fileData);
                };
            fileData += writeBinary ? 'bin:\x01\x00' : '';
            fileDataAsBinaryString += writeBinary ? 'bin:\x01\x00' : '';
            // create a file, write to it, and read it in again
            root.getFile(fileName, {create: true}, function(fe) {
                fileEntry = fe;
                fileEntry.createWriter(writeFile, writerFail);
            }, getFileFail);
        }

        function runReaderTest(root, funcName, writeBinary, verifierFunc, done, sliceStart, sliceEnd) {
            writeDummyFile(root, writeBinary, function(fileEntry, file, fileData, fileDataAsBinaryString) {
                var readWin = function(evt) {
                    expect(evt).toBeDefined();
                    verifierFunc(evt, fileData, fileDataAsBinaryString);
                };

                var reader = new FileReader();
                var readFail = createFail(funcName, done);
                reader.onload = readWin;
                reader.onerror = readFail;
                if (sliceEnd !== undefined) {
                    file = file.slice(sliceStart, sliceEnd);
                } else if (sliceStart !== undefined) {
                    file = file.slice(sliceStart);
                }
                reader[funcName](file);
            }, done);
        }

        function arrayBufferEqualsString(ab, str) {
            var buf = new Uint8Array(ab);
            var match = buf.length == str.length;

            for (var i = 0; match && i < buf.length; i++) {
                match = buf[i] == str.charCodeAt(i);
            }
            return match;
        }

        it("file.spec.84 should read file properly, readAsText", function(done) {
            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                runReaderTest(fs.root, 'readAsText', false, function(evt, fileData, fileDataAsBinaryString) {
                    expect(evt.target.result).toBe(fileData);
                    done();
                }, done);
            });
        });
        it("file.spec.85 should read file properly, Data URI", function(done) {
            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                runReaderTest(fs.root,'readAsDataURL', true, function(evt, fileData, fileDataAsBinaryString) {
                    expect(evt.target.result.substr(0,23)).toBe("data:text/plain;base64,");
                    // btoa is not suitable for Unicode strings. See:
                    // https://developer.mozilla.org/en-US/docs/Web/API/Window.btoa#Unicode_Strings
                    // This comparison target was generated with the following Python code instead:
                    //
                    // fd = '\xe2\x82\xac\xc3\xab - There is an exception to every rule.  Except this one.' + 'bin:\x01\x00'
                    // print fd.encode('base64').replace('\n','')
                    expect(evt.target.result.slice(23)).toBe('4oKsw6sgLSBUaGVyZSBpcyBhbiBleGNlcHRpb24gdG8gZXZlcnkgcnVsZS4gIEV4Y2VwdCB0aGlzIG9uZS5iaW46AQA=');
                    done();
                }, done);
            });
        });
        it("file.spec.86 should read file properly, readAsBinaryString", function(done) {
            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                runReaderTest(fs.root,'readAsBinaryString', true, function(evt, fileData, fileDataAsBinaryString) {
                    expect(evt.target.result).toBe(fileDataAsBinaryString);
                    done();
                }, done);
            });
        });
        it("file.spec.87 should read file properly, readAsArrayBuffer", function(done) {
            // Skip test if ArrayBuffers are not supported (e.g.: Android 2.3).
            if (typeof window.ArrayBuffer == 'undefined') {
                done();
            }
            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                runReaderTest(fs.root, 'readAsArrayBuffer', true, function(evt, fileData, fileDataAsBinaryString) {
                    expect(arrayBufferEqualsString(evt.target.result, fileDataAsBinaryString)).toBe(true);
                    done();
                }, done);
            });
        });
        it("file.spec.88 should read sliced file: readAsText", function(done) {
            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                runReaderTest(fs.root, 'readAsText', false, function(evt, fileData, fileDataAsBinaryString) {
                    expect(evt.target.result).toBe(fileDataAsBinaryString.slice(10, 40));
                    done();
                }, done, 10, 40);
            });
        });
        it("file.spec.89 should read sliced file: slice past eof", function(done) {
            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                runReaderTest(fs.root, 'readAsText', false, function(evt, fileData, fileDataAsBinaryString) {
                    expect(evt.target.result).toBe(fileData.slice(-5, 9999));
                    done();
                }, done, -5, 9999);
            });
        });
        it("file.spec.90 should read sliced file: slice to eof", function(done) {
            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                runReaderTest(fs.root, 'readAsText', false, function(evt, fileData, fileDataAsBinaryString) {
                    expect(evt.target.result).toBe(fileData.slice(-5));
                    done();
                }, done, -5);
            });
        });
        it("file.spec.91 should read empty slice", function(done) {
            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                runReaderTest(fs.root, 'readAsText', false, function(evt, fileData, fileDataAsBinaryString) {
                    expect(evt.target.result).toBe('');
                    done();
                }, done, 0, 0);
            });
        });
        it("file.spec.92 should read sliced file properly, readAsDataURL", function(done) {
            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                runReaderTest(fs.root, 'readAsDataURL', true, function(evt, fileData, fileDataAsBinaryString) {
                    expect(evt.target.result.slice(0, 23)).toBe("data:text/plain;base64,");
                    // btoa is not suitable for Unicode strings. See:
                    // https://developer.mozilla.org/en-US/docs/Web/API/Window.btoa#Unicode_Strings
                    // This comparison target was generated with the following Python code instead:
                    //
                    // fd = '\xe2\x82\xac\xc3\xab - There is an exception to every rule.  Except this one.' + 'bin:\x01\x00'
                    // print fd[10,-3].encode('base64').strip()
                    expect(evt.target.result.slice(23)).toBe('ZXJlIGlzIGFuIGV4Y2VwdGlvbiB0byBldmVyeSBydWxlLiAgRXhjZXB0IHRoaXMgb25lLmJpbg==');
                    done();
                }, done, 10, -3);
            });
        });
        it("file.spec.93 should read sliced file properly, readAsBinaryString", function(done) {
            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                runReaderTest(fs.root, 'readAsBinaryString', true, function(evt, fileData, fileDataAsBinaryString) {
                    expect(evt.target.result).toBe(fileDataAsBinaryString.slice(-10, -5));
                    done();
                }, done, -10, -5);
            });
        });
        it("file.spec.94 should read sliced file properly, readAsArrayBuffer", function(done) {
            // Skip test if ArrayBuffers are not supported (e.g.: Android 2.3).
            if (typeof window.ArrayBuffer == 'undefined') {
                done();
            }
            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                runReaderTest(fs.root, 'readAsArrayBuffer', true, function(evt, fileData, fileDataAsBinaryString) {
                    expect(arrayBufferEqualsString(evt.target.result, fileDataAsBinaryString.slice(0, -1))).toBe(true);
                    done();
                }, done, 0, -1);
            });
        });
    });

    describe('FileWriter', function(){
        // Previously labelled as file.spec.81
        it("file.spec.95 should have correct methods", function(done) {
            // retrieve a FileWriter object
            var fileName = "writer.methods",
                fail = createFail('FileWriter', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // test FileWriter
                fs.root.getFile(fileName, {create: true}, function(fileEntry) {
                    fileEntry.createWriter(function(writer) {
                        expect(writer).toBeDefined();
                        expect(typeof writer.write).toBe('function');
                        expect(typeof writer.seek).toBe('function');
                        expect(typeof writer.truncate).toBe('function');
                        expect(typeof writer.abort).toBe('function');

                        // cleanup
                        deleteEntry(fileEntry, done);
                    }, fail);
                }, fail);
            });
        });
        it("file.spec.96 should be able to write and append to file, createWriter", function(done) {
            var fileName = "writer.append",
                // file content
                rule = "There is an exception to every rule.",
                // for checkin file length
                length = rule.length,
                fail = createFail('FileWriter', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var filePath = fs.root.fullPath + '/' + fileName;
                // create file, then write and append to it
                createFile(fs.root, fileName, function(fileEntry) {
                    // writes initial file content
                    fileEntry.createWriter(function(writer) {
                        writer.onwriteend = verifier;
                        writer.write(rule);
                        function verifier(evt) {
                            expect(writer.length).toBe(length);
                            expect(writer.position).toBe(length);

                            // append some more stuff
                            var exception = "  Except this one.";
                            writer.onwriteend = anotherVerifier;
                            length += exception.length;
                            writer.seek(writer.length);
                            writer.write(exception);
                        }
                        function anotherVerifier(evt) {
                            expect(writer.length).toBe(length);
                            expect(writer.position).toBe(length);

                            // cleanup
                            deleteEntry(fileEntry, done);
                        }
                    }, fail);
                });
            });
        });
        it("file.spec.97 should be able to write and append to file, File object", function(done) {
            var fileName = "writer.append",
                // file content
                rule = "There is an exception to every rule.",
                // for checking file length
                length = rule.length;

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var filePath = fs.root.fullPath + '/' + fileName;
                // create file, then write and append to it
                var file = new File();
                file.fullPath = filePath;

                // writes initial file content
                var theWriter = new FileWriter(file);
                theWriter.onwriteend = verifier;
                theWriter.write(rule);

                function verifier(evt) {
                    expect(theWriter.length).toBe(length);
                    expect(theWriter.position).toBe(length);

                    // append some more stuff
                    var exception = "  Except this one.";
                    theWriter.onwriteend = anotherVerifier;
                    length += exception.length;
                    theWriter.seek(theWriter.length);
                    theWriter.write(exception);
                }

                function anotherVerifier(evt) {
                    expect(theWriter.length).toBe(length);
                    expect(theWriter.position).toBe(length);

                    // cleanup
                    deleteFile(fs.root, fileName, done);
                }
            });
        });
        it("file.spec.98 should be able to seek to the middle of the file and write more data than file.length", function(done) {
            var fileName = "writer.seek.write",
                // file content
                rule = "This is our sentence.",
                // for iting file length
                length = rule.length,
                fail = createFail('FileWriter', done);

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var filePath = fs.root.fullPath + '/' + fileName;
                // create file, then write and append to it
                createFile(fs.root, fileName, function(fileEntry) {
                    // write initial file content
                    fileEntry.createWriter(function(writer) {
                        writer.onwriteend = verifier;
                        writer.write(rule);

                        function verifier(evt) {
                            expect(writer.length).toBe(length);
                            expect(writer.position).toBe(length);

                            // append some more stuff
                            var exception = "newer sentence.";
                            writer.onwriteend = anotherVerifier;
                            length = 12 + exception.length;
                            writer.seek(12);
                            writer.write(exception);
                        }

                        function anotherVerifier(evt) {
                            expect(writer.length).toBe(length);
                            expect(writer.position).toBe(length);

                            // cleanup
                            deleteFile(fs.root, fileName, done);
                        }
                    }, fail);
                });
            });
        });
        it("file.spec.99 should be able to seek to the middle of the file and write less data than file.length", function(done) {
            var fileName = "writer.seek.write2",
                // file content
                rule = "This is our sentence.",
                fail = createFail('FileWriter', done),
                // for testing file length
                length = rule.length;

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var filePath = fs.root.fullPath + '/' + fileName;
                // create file, then write and append to it
                createFile(fs.root, fileName, function(fileEntry) {
                    // write initial file content
                    fileEntry.createWriter(function(writer) {
                        writer.onwriteend = verifier;
                        writer.write(rule);

                        function verifier(evt) {
                            expect(writer.length).toBe(length);
                            expect(writer.position).toBe(length);

                            // append some more stuff
                            var exception = "new.";
                            writer.onwriteend = anotherVerifier;
                            length = 8 + exception.length;
                            writer.seek(8);
                            writer.write(exception);
                        }

                        function anotherVerifier(evt) {
                            expect(writer.length).toBe(length);
                            expect(writer.position).toBe(length);

                            // cleanup
                            deleteFile(fs.root, fileName, done);
                        }
                    }, fail);
                });
            });
        });
        it("file.spec.100 should be able to write XML data", function(done) {
            var fileName = "writer.xml",
                fail = createFail('FileWriter', done),
                // file content
                rule = '<?xml version="1.0" encoding="UTF-8"?>\n<test prop="ack">\nData\n</test>\n',
                // for testing file length
                length = rule.length;

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var filePath = fs.root.fullPath + '/' + fileName;
                // creates file, then write XML data
                createFile(fs.root, fileName, function(fileEntry) {
                    // write file content
                    fileEntry.createWriter(function(writer) {
                        writer.onwriteend = verifier;
                        writer.write(rule);

                        function verifier(evt) {
                            expect(writer.length).toBe(length);
                            expect(writer.position).toBe(length);

                            // cleanup
                            deleteFile(fs.root, fileName, done);
                        }
                    }, fail);
                });
            });
        });
        it("file.spec.101 should be able to write JSON data", function(done) {
            var fileName = "writer.json",
                fail = createFail('FileWriter', done),
                // file content
                rule = '{ "name": "Guy Incognito", "email": "here@there.com" }',
                // for testing file length
                length = rule.length;

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                var filePath = fs.root.fullPath + '/' + fileName;
                // creates file, then write JSON content
                createFile(fs.root, fileName, function(fileEntry) {
                    // write file content
                    fileEntry.createWriter(function(writer) {
                        writer.onwriteend = verifier;
                        writer.write(rule);

                        function verifier(evt) {
                            expect(writer.length).toBe(length);
                            expect(writer.position).toBe(length);

                            // cleanup
                            deleteFile(fs.root, fileName, done);
                        }
                    }, fail);
                });
            });
        });
        it("file.spec.102 should be able to seek", function(done) {
            var fileName = "writer.seek",
                // file content
                rule = "There is an exception to every rule.  Except this one.",
                // for iting file length
                length = rule.length,
                fail = createFail('FileWriter');

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // creates file, then write JSON content
                createFile(fs.root, fileName, function(fileEntry) {
                    fileEntry.createWriter(function(writer) {
                        writer.onwriteend = verifier;
                        writer.seek(-100);
                        expect(writer.position).toBe(0);
                        writer.write(rule);

                        function verifier(evt) {
                            expect(writer.position).toBe(length);
                            writer.seek(-5);
                            expect(writer.position).toBe(length-5);
                            writer.seek(length + 100);
                            expect(writer.position).toBe(length);
                            writer.seek(10);
                            expect(writer.position).toBe(10);

                            // cleanup
                            deleteFile(fs.root, fileName, done);
                        }
                    }, fail);
                });
            });
        });
        it("file.spec.103 should be able to truncate", function(done) {
            var fileName = "writer.truncate",
                rule = "There is an exception to every rule.  Except this one.",
                fail = createFail('FileWriter');

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // creates file, writes to it, then truncates it
                createFile(fs.root, fileName, function(fileEntry) {
                    fileEntry.createWriter(function(writer) {
                        writer.onwriteend = truncate_file;
                        writer.write(rule);

                        function truncate_file(evt) {
                            writer.onwriteend = verifier;
                            writer.truncate(36);
                        }

                        function verifier(evt) {
                            expect(writer.length).toBe(36);
                            expect(writer.position).toBe(36);

                            // cleanup
                            deleteFile(fs.root, fileName, done);
                        }
                    }, fail);
                });
            });
        });
        it("file.spec.104 should be able to write binary data from an ArrayBuffer", function(done) {
            // Skip test if ArrayBuffers are not supported (e.g.: Android 2.3).
            if (typeof window.ArrayBuffer == 'undefined') {
                done();
            }
            var fileName = "bufferwriter.bin",
                // file content
                data = new ArrayBuffer(32),
                dataView = new Int8Array(data),
                fail = createFail('FileWriter', done),
                // for verifying file length
                length = 32;

            for (i=0; i < dataView.length; i++) {
                dataView[i] = i;
            }

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // creates file, then write content
                createFile(fs.root, fileName, function(fileEntry) {
                    fileEntry.createWriter(function(writer) {
                        writer.onwriteend = verifier;
                        writer.write(data);

                        function verifier(evt) {
                            expect(writer.length).toBe(length);
                            expect(writer.position).toBe(length);

                            // cleanup
                            deleteFile(fs.root, fileName, done);
                        }
                    }, fail);
                });
            });
        });
        it("file.spec.105 should be able to write binary data from a Blob", function(done) {
            // Skip test if Blobs are not supported (e.g.: Android 2.3).
            if (typeof window.Blob == 'undefined' || typeof window.ArrayBuffer == 'undefined') {
                done();
            }
            var fileName = "blobwriter.bin",
                fail = createFail('FileWriter', done),
                // file content
                data = new ArrayBuffer(32),
                dataView = new Int8Array(data),
                blob,
                // for verifying file length
                length = 32;

            for (i=0; i < dataView.length; i++) {
                dataView[i] = i;
            }
            try {
                // Mobile Safari: Use Blob constructor
                blob = new Blob([data], {"type": "application/octet-stream"});
            } catch(e) {
                if (window.WebKitBlobBuilder) {
                    // Android Browser: Use deprecated BlobBuilder
                    var builder = new WebKitBlobBuilder();
                    builder.append(data);
                    blob = builder.getBlob('application/octet-stream');
                } else {
                    // We have no way defined to create a Blob, so fail
                    fail();
                }
            }

            window.requestFileSystem(window.PERSISTENT, 0, function(fs) {
                // creates file, then write content
                createFile(fs.root, fileName, function(fileEntry) {
                    fileEntry.createWriter(function(writer) {
                        writer.onwriteend = verifier;
                        writer.write(blob);

                        function verifier(evt) {
                            expect(writer.length).toBe(length);
                            expect(writer.position).toBe(length);

                            // cleanup
                            deleteFile(fs.root, fileName, done);
                        }
                    }, fail);
                });
            });
        });
    });
});

};
