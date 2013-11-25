package org.apache.cordova.file;

import java.io.IOException;

import org.json.JSONException;
import org.json.JSONObject;

public interface Filesystem {

	JSONObject getEntryForLocalURL(LocalFilesystemURL inputURL) throws IOException;

	JSONObject getFileForLocalURL(LocalFilesystemURL inputURL, String fileName,
			JSONObject options, boolean directory) throws FileExistsException, IOException, TypeMismatchException, EncodingException, JSONException;

}
