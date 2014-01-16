module.exports = {
    setSandbox : function (success, fail, args, env) {
        require("lib/webview").setSandbox(JSON.parse(decodeURIComponent(args[0])));
        new PluginResult(args, env).ok();
    },

    isSandboxed : function (success, fail, args, env) {
        new PluginResult(args, env).ok(require("lib/webview").getSandbox() === "1");
    },

    resolveLocalPath : function (success, fail, args, env) {
        var homeDir = window.qnx.webplatform.getApplication().getEnv("HOME").replace("/data", "/app/native/"),
            path = homeDir + JSON.parse(decodeURIComponent(args[0])).substring(9);
        require("lib/webview").setSandbox(false);
        new PluginResult(args, env).ok(path);
    }
};
