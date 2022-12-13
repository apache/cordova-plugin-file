const fs = require('fs');
const path = require('path');

module.exports = function (context) {
    const { projectRoot } = context.opts;

    // preload
    const preloadFunctionFileSource = path.resolve(projectRoot+'/plugins/cordova-plugin-file/scripts/electron/preload-function-string.js');
    const preloadFileSourceString = fs.readFileSync(preloadFunctionFileSource, {encoding: 'utf-8'});
    const preloadFunctionFileDest = path.resolve(projectRoot+'/platforms/electron/platform_www/cdv-electron-preload.js');
    let preloadFileDestString = fs.readFileSync(preloadFunctionFileDest, {encoding: 'utf-8'});
    preloadFileDestString += preloadFileSourceString;
    fs.writeFileSync(preloadFunctionFileDest, preloadFileDestString, {encoding: 'utf-8'});

    // main
    const mainFunctionFileSource = path.resolve(projectRoot+'/plugins/cordova-plugin-file/scripts/electron/main-function-string.js');
    const mainFileSourceString = fs.readFileSync(mainFunctionFileSource, {encoding: 'utf-8'});
    const mainFunctionFileDest = path.resolve(projectRoot+'/platforms/electron/platform_www/cdv-electron-main.js');
    let mainFileDestString = fs.readFileSync(mainFunctionFileDest, {encoding: 'utf-8'});
    mainFileDestString += mainFileSourceString;
    fs.writeFileSync(mainFunctionFileDest, mainFileDestString, {encoding: 'utf-8'});
}