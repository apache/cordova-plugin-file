package org.apache.cordova.file;

import java.io.FileNotFoundException;
import java.io.IOException;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public interface Filesystem {

	JSONObject getEntryForLocalURL(LocalFilesystemURL inputURL) throws IOException;

	JSONObject getFileForLocalURL(LocalFilesystemURL inputURL, String fileName,
			JSONObject options, boolean directory) throws FileExistsException, IOException, TypeMismatchException, EncodingException, JSONException;

	boolean removeFileAtLocalURL(LocalFilesystemURL inputURL) throws InvalidModificationException, NoModificationAllowedException;

	boolean recursiveRemoveFileAtLocalURL(LocalFilesystemURL inputURL) throws FileExistsException, NoModificationAllowedException;

	JSONArray readEntriesAtLocalURL(LocalFilesystemURL inputURL) throws FileNotFoundException;

}
