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

var cordova = require('cordova');
var Entry = require('./Entry'),
    File = require('./File'),
    FileEntry = require('./FileEntry'),
    FileError = require('./FileError'),
    DirectoryEntry = require('./DirectoryEntry'),
    Flags = require('./Flags'),
    FileSystem = require('./FileSystem'),
    LocalFileSystem = require('./LocalFileSystem');

module.exports = {

    getFileMetadata:function(win,fail,args) {
        var fullPath = args[0];

        Windows.Storage.StorageFile.getFileFromPathAsync(fullPath).done(
            function (storageFile) {
                storageFile.getBasicPropertiesAsync().then(
                    function (basicProperties) {
                        win(new File(storageFile.name, storageFile.path, storageFile.fileType, basicProperties.dateModified, basicProperties.size));
                    }, function () {
                        fail && fail(FileError.NOT_READABLE_ERR);
                    }
                );
            }, function () {
                fail && fail(FileError.NOT_FOUND_ERR);
            }
        );
    },

    getMetadata:function(success,fail,args) {
        var fullPath = args[0];

        var dealFile = function (sFile) {
            Windows.Storage.StorageFile.getFileFromPathAsync(fullPath).then(
                function (storageFile) {
                    return storageFile.getBasicPropertiesAsync();
                },
                function () {
                    fail && fail(FileError.NOT_READABLE_ERR);
                }
            // get the basic properties of the file.
            ).then(
                function (basicProperties) {
                    success(basicProperties.dateModified);
                },
                function () {
                    fail && fail(FileError.NOT_READABLE_ERR);
                }
            );
        };

        var dealFolder = function (sFolder) {
            Windows.Storage.StorageFolder.getFolderFromPathAsync(fullPath).then(
                function (storageFolder) {
                    return storageFolder.getBasicPropertiesAsync();
                },
                function () {
                    fail && fail(FileError.NOT_READABLE_ERR);
                }
            // get the basic properties of the folder.
            ).then(
                function (basicProperties) {
                    success(basicProperties.dateModified);
                },
                function () {
                    fail && fail(FileError.NOT_FOUND_ERR);
                }
            );
        };

        Windows.Storage.StorageFile.getFileFromPathAsync(fullPath).then(
            // the path is file.
            function (sFile) {
                dealFile(sFile);
            },
            // the path is folder
            function () {
                Windows.Storage.StorageFolder.getFolderFromPathAsync(fullPath).then(
                    function (sFolder) {
                        dealFolder(sFolder);
                    }, function () {
                        fail && fail(FileError.NOT_FOUND_ERR);
                    }
                );
            }
        );
    },

    getParent:function(win,fail,args) { // ["fullPath"]
        var fullPath = args[0];

        var storageFolderPer = Windows.Storage.ApplicationData.current.localFolder;
        var storageFolderTem = Windows.Storage.ApplicationData.current.temporaryFolder;

        if (fullPath == storageFolderPer.path) {
            win(new DirectoryEntry(storageFolderPer.name, storageFolderPer.path));
            return;
        } else if (fullPath == storageFolderTem.path) {
            win(new DirectoryEntry(storageFolderTem.name, storageFolderTem.path));
            return;
        }
        var splitArr = fullPath.split(new RegExp(/\/|\\/g));

        var popItem = splitArr.pop();

        var result = new DirectoryEntry(popItem, fullPath.substr(0, fullPath.length - popItem.length - 1));
        Windows.Storage.StorageFolder.getFolderFromPathAsync(result.fullPath).done(
            function () { win(result); },
            function () { fail && fail(FileError.INVALID_STATE_ERR); }
        );
    },

    readAsText:function(win,fail,args) {
        var fileName = args[0];
        var enc = args[1];

        Windows.Storage.StorageFile.getFileFromPathAsync(fileName).done(
            function (storageFile) {
                var value = Windows.Storage.Streams.UnicodeEncoding.utf8;
                if (enc == 'Utf16LE' || enc == 'utf16LE') {
                    value = Windows.Storage.Streams.UnicodeEncoding.utf16LE;
                }else if (enc == 'Utf16BE' || enc == 'utf16BE') {
                    value = Windows.Storage.Streams.UnicodeEncoding.utf16BE;
                }
                Windows.Storage.FileIO.readTextAsync(storageFile, value).done(
                    function (fileContent) {
                        win(fileContent);
                    },
                    function () {
                        fail && fail(FileError.ENCODING_ERR);
                    }
                );
            }, function () {
                fail && fail(FileError.NOT_FOUND_ERR);
            }
        );
    },

    readAsDataURL:function(win,fail,args) {
        var fileName = args[0];


        Windows.Storage.StorageFile.getFileFromPathAsync(fileName).then(
            function (storageFile) {
                Windows.Storage.FileIO.readBufferAsync(storageFile).done(
                    function (buffer) {
                        var strBase64 = Windows.Security.Cryptography.CryptographicBuffer.encodeToBase64String(buffer);
                        //the method encodeToBase64String will add "77u/" as a prefix, so we should remove it
                        if(String(strBase64).substr(0,4) == "77u/") {
                            strBase64 = strBase64.substr(4);
                        }
                        var mediaType = storageFile.contentType;
                        var result = "data:" + mediaType + ";base64," + strBase64;
                        win(result);
                    }
                );
            }, function () {
                fail && fail(FileError.NOT_FOUND_ERR);
            }
        );
    },

    getDirectory:function(win,fail,args) {
        var fullPath = args[0];
        var path = args[1];
        var options = args[2];

        var flag = "";
        if (options !== null) {
            flag = new Flags(options.create, options.exclusive);
        } else {
            flag = new Flags(false, false);
        }

        Windows.Storage.StorageFolder.getFolderFromPathAsync(fullPath).then(
            function (storageFolder) {
                if (flag.create === true && flag.exclusive === true) {
                    storageFolder.createFolderAsync(path, Windows.Storage.CreationCollisionOption.failIfExists).done(
                        function (storageFolder) {
                            win(new DirectoryEntry(storageFolder.name, storageFolder.path));
                        }, function () {
                            fail && fail(FileError.PATH_EXISTS_ERR);
                        }
                    );
                } else if (flag.create === true && flag.exclusive === false) {
                    storageFolder.createFolderAsync(path, Windows.Storage.CreationCollisionOption.openIfExists).done(
                        function (storageFolder) {
                            win(new DirectoryEntry(storageFolder.name, storageFolder.path));
                        }, function () {
                            fail && fail(FileError.INVALID_MODIFICATION_ERR);
                        }
                    );
                } else if (flag.create === false) {
                    if (/\?|\\|\*|\||\"|<|>|\:|\//g.test(path)) {
                        fail && fail(FileError.ENCODING_ERR);
                        return;
                    }

                    storageFolder.getFolderAsync(path).done(
                        function (storageFolder) {
                            win(new DirectoryEntry(storageFolder.name, storageFolder.path));
                        }, function () {
                            fail && fail(FileError.NOT_FOUND_ERR);
                        }
                    );
                }
            }, function () {
                fail && fail(FileError.NOT_FOUND_ERR);
            }
        );
    },

    remove:function(win,fail,args) {
        var fullPath = args[0];

        Windows.Storage.StorageFile.getFileFromPathAsync(fullPath).then(
            function (sFile) {
                Windows.Storage.StorageFile.getFileFromPathAsync(fullPath).done(function (storageFile) {
                    storageFile.deleteAsync().done(win, function () {
                        fail && fail(FileError.INVALID_MODIFICATION_ERR);

                    });
                });
            },
            function () {
                Windows.Storage.StorageFolder.getFolderFromPathAsync(fullPath).then(
                    function (sFolder) {
                        var removeEntry = function () {
                            var storageFolderTop = null;

                            Windows.Storage.StorageFolder.getFolderFromPathAsync(fullPath).then(
                                function (storageFolder) {
                                    // FileSystem root can't be removed!
                                    var storageFolderPer = Windows.Storage.ApplicationData.current.localFolder;
                                    var storageFolderTem = Windows.Storage.ApplicationData.current.temporaryFolder;
                                    if (fullPath == storageFolderPer.path || fullPath == storageFolderTem.path) {
                                        fail && fail(FileError.NO_MODIFICATION_ALLOWED_ERR);
                                        return;
                                    }
                                    storageFolderTop = storageFolder;
                                    return storageFolder.createFileQuery().getFilesAsync();
                                }, function () {
                                    fail && fail(FileError.INVALID_MODIFICATION_ERR);

                                }
                            // check sub-files.
                            ).then(function (fileList) {
                                if (fileList) {
                                    if (fileList.length === 0) {
                                        return storageFolderTop.createFolderQuery().getFoldersAsync();
                                    } else {
                                        fail && fail(FileError.INVALID_MODIFICATION_ERR);
                                    }
                                }
                            // check sub-folders.
                            }).then(function (folderList) {
                                if (folderList) {
                                    if (folderList.length === 0) {
                                        storageFolderTop.deleteAsync().done(win, function () {
                                            fail && fail(FileError.INVALID_MODIFICATION_ERR);

                                        });
                                    } else {
                                        fail && fail(FileError.INVALID_MODIFICATION_ERR);
                                    }
                                }

                            });
                        };
                        removeEntry();
                    }, function () {
                        fail && fail(FileError.NOT_FOUND_ERR);
                    }
                );
            }
        );
    },

    removeRecursively:function(successCallback,fail,args) {
        var fullPath = args[0];

        Windows.Storage.StorageFolder.getFolderFromPathAsync(fullPath).done(function (storageFolder) {
        var storageFolderPer = Windows.Storage.ApplicationData.current.localFolder;
        var storageFolderTem = Windows.Storage.ApplicationData.current.temporaryFolder;

        if (storageFolder.path == storageFolderPer.path || storageFolder.path == storageFolderTem.path) {
            fail && fail(FileError.NO_MODIFICATION_ALLOWED_ERR);
            return;
        }

        var removeFolders = function (path) {
            return new WinJS.Promise(function (complete) {
                var filePromiseArr = [];
                var storageFolderTop = null;
                Windows.Storage.StorageFolder.getFolderFromPathAsync(path).then(
                    function (storageFolder) {
                        var fileListPromise = storageFolder.createFileQuery().getFilesAsync();

                        storageFolderTop = storageFolder;
                        return fileListPromise;
                    }
                // remove all the files directly under the folder.
                ).then(function (fileList) {
                    if (fileList !== null) {
                        for (var i = 0; i < fileList.length; i++) {
                            var filePromise = fileList[i].deleteAsync();
                            filePromiseArr.push(filePromise);
                        }
                    }
                    WinJS.Promise.join(filePromiseArr).then(function () {
                        var folderListPromise = storageFolderTop.createFolderQuery().getFoldersAsync();
                        return folderListPromise;
                    // remove empty folders.
                    }).then(function (folderList) {
                        var folderPromiseArr = [];
                        if (folderList.length !== 0) {
                            for (var j = 0; j < folderList.length; j++) {

                                folderPromiseArr.push(removeFolders(folderList[j].path));
                            }
                            WinJS.Promise.join(folderPromiseArr).then(function () {
                                storageFolderTop.deleteAsync().then(complete);
                            });
                        } else {
                            storageFolderTop.deleteAsync().then(complete);
                        }
                    }, function () { });
                }, function () { });
            });
        };
        removeFolders(storageFolder.path).then(function () {
            Windows.Storage.StorageFolder.getFolderFromPathAsync(storageFolder.path).then(
                function () {},
                function () {
                    if (typeof successCallback !== 'undefined' && successCallback !== null) { successCallback(); }
                });
            });
        });
    },

    getFile:function(win,fail,args) {
        var fullPath = args[0];
        var path = args[1];
        var options = args[2];

        var flag = "";
        if (options !== null) {
            flag = new Flags(options.create, options.exclusive);
        } else {
            flag = new Flags(false, false);
        }

        Windows.Storage.StorageFolder.getFolderFromPathAsync(fullPath).then(
            function (storageFolder) {
                if (flag.create === true && flag.exclusive === true) {
                    storageFolder.createFileAsync(path, Windows.Storage.CreationCollisionOption.failIfExists).done(
                        function (storageFile) {
                            win(new FileEntry(storageFile.name, storageFile.path));
                        }, function () {
                            fail && fail(FileError.PATH_EXISTS_ERR);
                        }
                    );
                } else if (flag.create === true && flag.exclusive === false) {
                    storageFolder.createFileAsync(path, Windows.Storage.CreationCollisionOption.openIfExists).done(
                        function (storageFile) {
                            win(new FileEntry(storageFile.name, storageFile.path));
                        }, function () {
                            fail && fail(FileError.INVALID_MODIFICATION_ERR);
                        }
                    );
                } else if (flag.create === false) {
                    if (/\?|\\|\*|\||\"|<|>|\:|\//g.test(path)) {
                        fail && fail(FileError.ENCODING_ERR);
                        return;
                    }
                    storageFolder.getFileAsync(path).done(
                        function (storageFile) {
                            win(new FileEntry(storageFile.name, storageFile.path));
                        }, function () {
                            fail && fail(FileError.NOT_FOUND_ERR);
                        }
                    );
                }
            }, function () {
                fail && fail(FileError.NOT_FOUND_ERR);
            }
        );
    },

    readEntries:function(win,fail,args) { // ["fullPath"]
        var path = args[0];

        var result = [];

        Windows.Storage.StorageFolder.getFolderFromPathAsync(path).then(function (storageFolder) {
            var promiseArr = [];
            var index = 0;
            promiseArr[index++] = storageFolder.createFileQuery().getFilesAsync().then(function (fileList) {
                if (fileList !== null) {
                    for (var i = 0; i < fileList.length; i++) {
                        result.push(new FileEntry(fileList[i].name, fileList[i].path));
                    }
                }
            });
            promiseArr[index++] = storageFolder.createFolderQuery().getFoldersAsync().then(function (folderList) {
                if (folderList !== null) {
                    for (var j = 0; j < folderList.length; j++) {
                        result.push(new FileEntry(folderList[j].name, folderList[j].path));
                    }
                }
            });
            WinJS.Promise.join(promiseArr).then(function () {
                win(result);
            });

        }, function () { fail && fail(FileError.NOT_FOUND_ERR); });
    },

    write:function(win,fail,args) {
        var fileName = args[0];
        var text = args[1];
        var position = args[2];

        Windows.Storage.StorageFile.getFileFromPathAsync(fileName).done(
            function (storageFile) {
                Windows.Storage.FileIO.writeTextAsync(storageFile,text,Windows.Storage.Streams.UnicodeEncoding.utf8).done(
                    function() {
                        win(String(text).length);
                    }, function () {
                        fail && fail(FileError.INVALID_MODIFICATION_ERR);
                    }
                );
            }, function() {
                fail && fail(FileError.NOT_FOUND_ERR);
            }
        );
    },

    truncate:function(win,fail,args) { // ["fileName","size"]
        var fileName = args[0];
        var size = args[1];

        Windows.Storage.StorageFile.getFileFromPathAsync(fileName).done(function(storageFile){
            //the current length of the file.
            var leng = 0;

            storageFile.getBasicPropertiesAsync().then(function (basicProperties) {
                leng = basicProperties.size;
                if (Number(size) >= leng) {
                    win(this.length);
                    return;
                }
                if (Number(size) >= 0) {
                    Windows.Storage.FileIO.readTextAsync(storageFile, Windows.Storage.Streams.UnicodeEncoding.utf8).then(function (fileContent) {
                        fileContent = fileContent.substr(0, size);
                        var fullPath = storageFile.path;
                        var name = storageFile.name;
                        var entry = new Entry(true, false, name, fullPath);
                        var parentPath = "";
                        var successCallBack = function (entry) {
                            parentPath = entry.fullPath;
                            storageFile.deleteAsync().then(function () {
                                return Windows.Storage.StorageFolder.getFolderFromPathAsync(parentPath);
                            }).then(function (storageFolder) {
                                storageFolder.createFileAsync(name).then(function (newStorageFile) {
                                    Windows.Storage.FileIO.writeTextAsync(newStorageFile, fileContent).done(function () {
                                        win(String(fileContent).length);
                                    }, function () {
                                        fail && fail(FileError.NO_MODIFICATION_ALLOWED_ERR);
                                    });
                                });
                            });
                        };
                        entry.getParent(successCallBack, null);
                    }, function () { fail && fail(FileError.NOT_FOUND_ERR); });
                }
            });
        }, function () { fail && fail(FileError.NOT_FOUND_ERR); });
    },

    copyTo:function(success,fail,args) { // ["fullPath","parent", "newName"]
        var srcPath = args[0];
        var parentFullPath = args[1];
        var name = args[2];

        //name can't be invalid
        if (/\?|\\|\*|\||\"|<|>|\:|\//g.test(name)) {
            fail && fail(FileError.ENCODING_ERR);
            return;
        }
        // copy
        var copyFiles = "";
        Windows.Storage.StorageFile.getFileFromPathAsync(srcPath).then(
            function (sFile) {
                copyFiles = function (srcPath, parentPath) {
                    var storageFileTop = null;
                    Windows.Storage.StorageFile.getFileFromPathAsync(srcPath).then(function (storageFile) {
                        storageFileTop = storageFile;
                        return Windows.Storage.StorageFolder.getFolderFromPathAsync(parentPath);
                    }, function () {

                        fail && fail(FileError.NOT_FOUND_ERR);
                    }).then(function (storageFolder) {
                        storageFileTop.copyAsync(storageFolder, name, Windows.Storage.NameCollisionOption.failIfExists).then(function (storageFile) {

                            success(new FileEntry(storageFile.name, storageFile.path));
                        }, function () {

                            fail && fail(FileError.INVALID_MODIFICATION_ERR);
                        });
                    }, function () {

                        fail && fail(FileError.NOT_FOUND_ERR);
                    });
                };
                var copyFinish = function (srcPath, parentPath) {
                    copyFiles(srcPath, parentPath);
                };
                copyFinish(srcPath, parentFullPath);
            },
            function () {
                Windows.Storage.StorageFolder.getFolderFromPathAsync(srcPath).then(
                    function (sFolder) {
                        copyFiles = function (srcPath, parentPath) {
                            var coreCopy = function (storageFolderTop, complete) {
                                storageFolderTop.createFolderQuery().getFoldersAsync().then(function (folderList) {
                                    var folderPromiseArr = [];
                                    if (folderList.length === 0) { complete(); }
                                    else {
                                        Windows.Storage.StorageFolder.getFolderFromPathAsync(parentPath).then(function (storageFolderTarget) {
                                            var tempPromiseArr = [];
                                            var index = 0;
                                            for (var j = 0; j < folderList.length; j++) {
                                                tempPromiseArr[index++] = storageFolderTarget.createFolderAsync(folderList[j].name).then(function (targetFolder) {
                                                    folderPromiseArr.push(copyFiles(folderList[j].path, targetFolder.path));
                                                });
                                            }
                                            WinJS.Promise.join(tempPromiseArr).then(function () {
                                                WinJS.Promise.join(folderPromiseArr).then(complete);
                                            });
                                        });
                                    }
                                });
                            };

                            return new WinJS.Promise(function (complete) {
                                var storageFolderTop = null;
                                var filePromiseArr = [];
                                var fileListTop = null;
                                Windows.Storage.StorageFolder.getFolderFromPathAsync(srcPath).then(function (storageFolder) {
                                    storageFolderTop = storageFolder;
                                    return storageFolder.createFileQuery().getFilesAsync();
                                }).then(function (fileList) {
                                    fileListTop = fileList;
                                    if (fileList) {
                                        return Windows.Storage.StorageFolder.getFolderFromPathAsync(parentPath);
                                    }
                                }).then(function (targetStorageFolder) {
                                    for (var i = 0; i < fileListTop.length; i++) {
                                        filePromiseArr.push(fileListTop[i].copyAsync(targetStorageFolder));
                                    }
                                    WinJS.Promise.join(filePromiseArr).then(function () {
                                        coreCopy(storageFolderTop, complete);
                                    });
                                });
                            });
                        };
                        var copyFinish = function (srcPath, parentPath) {
                            Windows.Storage.StorageFolder.getFolderFromPathAsync(parentPath).then(function (storageFolder) {
                                storageFolder.createFolderAsync(name, Windows.Storage.CreationCollisionOption.openIfExists).then(function (newStorageFolder) {
                                    //can't copy onto itself
                                    if (srcPath == newStorageFolder.path) {
                                        fail && fail(FileError.INVALID_MODIFICATION_ERR);
                                        return;
                                    }
                                    //can't copy into itself
                                    if (srcPath == parentPath) {
                                        fail && fail(FileError.INVALID_MODIFICATION_ERR);
                                        return;
                                    }
                                    copyFiles(srcPath, newStorageFolder.path).then(function () {
                                        Windows.Storage.StorageFolder.getFolderFromPathAsync(newStorageFolder.path).done(
                                            function (storageFolder) {
                                                success(new DirectoryEntry(storageFolder.name, storageFolder.path));
                                            },
                                            function () { fail && fail(FileError.NOT_FOUND_ERR); }
                                        );
                                    });
                                }, function () { fail && fail(FileError.INVALID_MODIFICATION_ERR); });
                            }, function () { fail && fail(FileError.INVALID_MODIFICATION_ERR); });
                        };
                        copyFinish(srcPath, parentFullPath);
                    }, function () {
                        fail && fail(FileError.NOT_FOUND_ERR);
                    }
                );
            }
        );
    },

    moveTo:function(success,fail,args) {
        var srcPath = args[0];
        var parentFullPath = args[1];
        var name = args[2];


        //name can't be invalid
        if (/\?|\\|\*|\||\"|<|>|\:|\//g.test(name)) {
            fail && fail(FileError.ENCODING_ERR);
            return;
        }

        var moveFiles = "";
        Windows.Storage.StorageFile.getFileFromPathAsync(srcPath).then(
            function (sFile) {
                moveFiles = function (srcPath, parentPath) {
                    var storageFileTop = null;
                    Windows.Storage.StorageFile.getFileFromPathAsync(srcPath).then(function (storageFile) {
                        storageFileTop = storageFile;
                        return Windows.Storage.StorageFolder.getFolderFromPathAsync(parentPath);
                    }, function () {
                        fail && fail(FileError.NOT_FOUND_ERR);
                    }).then(function (storageFolder) {
                        storageFileTop.moveAsync(storageFolder, name, Windows.Storage.NameCollisionOption.replaceExisting).then(function () {
                            success(new FileEntry(name, storageFileTop.path));
                        }, function () {
                            fail && fail(FileError.INVALID_MODIFICATION_ERR);
                        });
                    }, function () {
                        fail && fail(FileError.NOT_FOUND_ERR);
                    });
                };
                var moveFinish = function (srcPath, parentPath) {
                    //can't copy onto itself
                    if (srcPath == parentPath + "\\" + name) {
                        fail && fail(FileError.INVALID_MODIFICATION_ERR);
                        return;
                    }
                    moveFiles(srcPath, parentFullPath);
                };
                moveFinish(srcPath, parentFullPath);
            },
            function () {
                Windows.Storage.StorageFolder.getFolderFromPathAsync(srcPath).then(
                    function (sFolder) {
                        moveFiles = function (srcPath, parentPath) {
                            var coreMove = function (storageFolderTop, complete) {
                                storageFolderTop.createFolderQuery().getFoldersAsync().then(function (folderList) {
                                    var folderPromiseArr = [];
                                    if (folderList.length === 0) {
                                        // If failed, we must cancel the deletion of folders & files.So here wo can't delete the folder.
                                        complete();
                                    }
                                    else {
                                        Windows.Storage.StorageFolder.getFolderFromPathAsync(parentPath).then(function (storageFolderTarget) {
                                            var tempPromiseArr = [];
                                            var index = 0;
                                            for (var j = 0; j < folderList.length; j++) {
                                                tempPromiseArr[index++] = storageFolderTarget.createFolderAsync(folderList[j].name).then(function (targetFolder) {
                                                    folderPromiseArr.push(moveFiles(folderList[j].path, targetFolder.path));
                                                });
                                            }
                                            WinJS.Promise.join(tempPromiseArr).then(function () {
                                                WinJS.Promise.join(folderPromiseArr).then(complete);
                                            });
                                        });
                                    }
                                });
                            };
                            return new WinJS.Promise(function (complete) {
                                var storageFolderTop = null;
                                Windows.Storage.StorageFolder.getFolderFromPathAsync(srcPath).then(function (storageFolder) {
                                    storageFolderTop = storageFolder;
                                    return storageFolder.createFileQuery().getFilesAsync();
                                }).then(function (fileList) {
                                    var filePromiseArr = [];
                                    Windows.Storage.StorageFolder.getFolderFromPathAsync(parentPath).then(function (dstStorageFolder) {
                                        if (fileList) {
                                            for (var i = 0; i < fileList.length; i++) {
                                                filePromiseArr.push(fileList[i].moveAsync(dstStorageFolder));
                                            }
                                        }
                                        WinJS.Promise.join(filePromiseArr).then(function () {
                                            coreMove(storageFolderTop, complete);
                                        }, function () { });
                                    });
                                });
                            });
                        };
                        var moveFinish = function (srcPath, parentPath) {
                            var originFolderTop = null;
                            Windows.Storage.StorageFolder.getFolderFromPathAsync(srcPath).then(function (originFolder) {
                                originFolderTop = originFolder;
                                return Windows.Storage.StorageFolder.getFolderFromPathAsync(parentPath);
                            }, function () {
                                fail && fail(FileError.INVALID_MODIFICATION_ERR);
                            }).then(function (storageFolder) {
                                return storageFolder.createFolderAsync(name, Windows.Storage.CreationCollisionOption.openIfExists);
                            }, function () {
                                fail && fail(FileError.INVALID_MODIFICATION_ERR);
                            }).then(function (newStorageFolder) {
                                //can't move onto directory that is not empty
                                newStorageFolder.createFileQuery().getFilesAsync().then(function (fileList) {
                                    newStorageFolder.createFolderQuery().getFoldersAsync().then(function (folderList) {
                                        if (fileList.length !== 0 || folderList.length !== 0) {
                                            fail && fail(FileError.INVALID_MODIFICATION_ERR);
                                            return;
                                        }
                                        //can't copy onto itself
                                        if (srcPath == newStorageFolder.path) {
                                            fail && fail(FileError.INVALID_MODIFICATION_ERR);
                                            return;
                                        }
                                        //can't copy into itself
                                        if (srcPath == parentPath) {
                                            fail && fail(FileError.INVALID_MODIFICATION_ERR);
                                            return;
                                        }
                                        moveFiles(srcPath, newStorageFolder.path).then(function () {
                                            var successCallback = function () {
                                                success(new DirectoryEntry(name, newStorageFolder.path));
                                            };
                                            var temp = new DirectoryEntry(originFolderTop.name, originFolderTop.path).removeRecursively(successCallback, fail);

                                        }, function () { console.log("error!"); });
                                    });
                                });
                            }, function () { fail && fail(FileError.INVALID_MODIFICATION_ERR); });

                        };
                        moveFinish(srcPath, parentFullPath);
                    }, function () {
                        fail && fail(FileError.NOT_FOUND_ERR);
                    }
                );
            }
        );
    },
    tempFileSystem:null,

    persistentFileSystem:null,

    requestFileSystem:function(win,fail,args) {
        var type = args[0];
        var size = args[1];

        var filePath = "";
        var result = null;
        var fsTypeName = "";

        switch (type) {
            case LocalFileSystem.TEMPORARY:
                filePath = Windows.Storage.ApplicationData.current.temporaryFolder.path;
                fsTypeName = "temporary";
                break;
            case LocalFileSystem.PERSISTENT:
                filePath = Windows.Storage.ApplicationData.current.localFolder.path;
                fsTypeName = "persistent";
                break;
        }

        var MAX_SIZE = 10000000000;
        if (size > MAX_SIZE) {
            fail && fail(FileError.QUOTA_EXCEEDED_ERR);
            return;
        }

        var fileSystem = new FileSystem(fsTypeName, new DirectoryEntry(fsTypeName, filePath));
        result = fileSystem;
        win(result);
    },

    resolveLocalFileSystemURI:function(success,fail,args) {
        var uri = args[0];

        var path = uri;

        // support for file name with parameters
        if (/\?/g.test(path)) {
            path = String(path).split("?")[0];
        }

        // support for encodeURI
        if (/\%5/g.test(path)) {
            path = decodeURI(path);
        }

        // support for special path start with file:///
        if (path.substr(0, 8) == "file:///") {
            path = Windows.Storage.ApplicationData.current.localFolder.path + "\\" + String(path).substr(8).split("/").join("\\");
            Windows.Storage.StorageFile.getFileFromPathAsync(path).then(
                function (storageFile) {
                    success(new FileEntry(storageFile.name, storageFile.path));
                }, function () {
                    Windows.Storage.StorageFolder.getFolderFromPathAsync(path).then(
                        function (storageFolder) {
                            success(new DirectoryEntry(storageFolder.name, storageFolder.path));
                        }, function () {
                            fail && fail(FileError.NOT_FOUND_ERR);
                        }
                    );
                }
            );
        } else {
            Windows.Storage.StorageFile.getFileFromPathAsync(path).then(
                function (storageFile) {
                    success(new FileEntry(storageFile.name, storageFile.path));
                }, function () {
                    Windows.Storage.StorageFolder.getFolderFromPathAsync(path).then(
                        function (storageFolder) {
                            success(new DirectoryEntry(storageFolder.name, storageFolder.path));
                        }, function () {
                            fail && fail(FileError.ENCODING_ERR);
                        }
                    );
                }
            );
        }
    }

};

require("cordova/windows8/commandProxy").add("File",module.exports);
