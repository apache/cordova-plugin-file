package org.apache.cordova.file;

import java.io.IOException;

import org.json.JSONObject;

public interface Filesystem {

	JSONObject getEntryForLocalURL(LocalFilesystemURL inputURL) throws IOException;

}
