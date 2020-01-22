const fs = require('fs');

module.exports = ctx => {
  const cfgPath = ctx.opts.projectRoot + '/platforms/electron/platform_www/cdv-electron-settings.json';
  const cfg = require(cfgPath);
  cfg.browserWindow = cfg.browserWindow || {};
  cfg.browserWindow.webPreferences = cfg.browserWindow.webPreferences || {};
  cfg.browserWindow.webPreferences.nodeIntegration = true;
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 4), 'utf8');
}
