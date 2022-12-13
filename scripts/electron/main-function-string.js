
/*Beginning of Main function additions for cordova.plugin.file*/

ipcMain.on('paths-prefix', (event) => {
    const path = require('path');
    event.returnValue = {
        applicationDirectory: path.dirname(app.getAppPath()) + path.sep,
        dataDirectory: app.getPath('userData') + path.sep,
        cacheDirectory: app.getPath('cache') + path.sep,
        tempDirectory: app.getPath('temp') + path.sep,
        documentsDirectory: app.getPath('documents') + path.sep
    };
});

/*End of Main function additions for cordova.plugin.file*/