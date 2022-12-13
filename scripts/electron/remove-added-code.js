preloadCommentStartString = '/*Beginning of Main function additions for cordova.plugin.file*/';
preloadCommentEndString = '/*End of Main function additions for cordova.plugin.file*/';

mainCommentStartString = '/*Beginning of Main function additions for cordova.plugin.file*/';
mainCommentEndString = '/*End of Main function additions for cordova.plugin.file*/';

const fs = require('fs');
const path = require('path');


module.exports = function (context) {
    const { projectRoot } = context.opts;

    // preload
    const preloadFunctionFileDest = path.resolve(projectRoot+'/platforms/electron/platform_www/cdv-electron-preload.js');
    let fileDestString = fs.readFileSync(preloadFunctionFileDest, {encoding: 'utf-8'});
    const preloadStartIndex = fileDestString.indexOf(preloadCommentStartString);
    const preloadEndIndex = fileDestString.indexOf(preloadCommentEndString) + preloadCommentEndString.length;
    if(preloadStartIndex > 0) {
        fileDestString = fileDestString.substring(0, preloadStartIndex) + fileDestString.substring(preloadEndIndex);
        fs.writeFileSync(preloadFunctionFileDest, fileDestString.toString(), {encoding: 'utf-8'});
    }

    // main
    const mainFunctionFileDest = path.resolve(projectRoot+'/platforms/electron/platform_www/cdv-electron-main.js');
    let mainFileDestString = fs.readFileSync(mainFunctionFileDest, {encoding: 'utf-8'});
    const mainStartIndex = mainFileDestString.indexOf(mainCommentStartString);
    const mainEndIndex = mainFileDestString.indexOf(mainCommentEndString) + mainCommentEndString.length;
    if(mainStartIndex > 0) {
        mainFileDestString = mainFileDestString.substring(0, mainStartIndex) + mainFileDestString.substring(mainEndIndex);
        fs.writeFileSync(mainFunctionFileDest, mainFileDestString.toString(), {encoding: 'utf-8'});
    }
}
