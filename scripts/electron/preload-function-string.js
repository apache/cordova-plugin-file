
/*Beginning of Main function additions for cordova.plugin.file*/
const fs = require('fs');
contextBridge.exposeInMainWorld('cordovaFilePlugin', {
    fs: require('fs'),
    path: require('path'),
    util: require('util'),
    appPaths: ipcRenderer.sendSync('paths-prefix'),
    copyFile: (srcPath, destPath, callback) => {
        fs.copyFile(srcPath, destPath, callback);
    },
    readFile: (path, callback) => {
        fs.readdir(path, {withFileTypes: true}, (err, files) => {
            if(files && files.length) {
                files.forEach(file => {
                    file.isDirectory = file.isDirectory();
                    file.isFile = file.isFile();
                });
            }
            callback(err, files);
        });
    },
    stat: (path, callback) => {
        fs.stat(path, (err, stats) => {
            if(stats) {
                stats.isDirectory = stats.isDirectory();
                stats.isFile = stats.isFile();
            }
            callback(err, stats);
        });
    },
    open: (path, flags, callback) => {
        fs.open(path, flags, callback);
    },
    close: (fd, errorCallback) => {
        fs.close(fd, errorCallback);
    },
    utimes: (path, atime, mtime, callback) => {
        fs.utimes(path, atime, mtime, callback);
    },
    rm: (path, callback) => {
        fs.rmSync(path, { recursive: true } ,callback);
    },
    truncate: (path, size, callback) => {
        fs.truncate(path, size, callback);
    },
    mkdir: (path, callback) => {
        fs.mkdir(path, callback);
    },
    write: (fd, data, position, callback) => {
        const buffer = Buffer.from(data);
        fs.write(fd, buffer, 0, buffer.length, position, callback );
    },
    bufferAlloc: (size) => {
        return Buffer.alloc(size);
    },
    read: (fd, buffer, position, callback) => {
        fs.read(fd, buffer, 0, buffer.length, position, callback)
    }
});

/*End of Main function additions for cordova.plugin.file*/