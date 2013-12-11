package org.apache.cordova.file;

import java.io.FileNotFoundException;
import java.io.IOException;

import org.apache.cordova.CordovaInterface;
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

	JSONObject getFileMetadataForLocalURL(LocalFilesystemURL inputURL) throws FileNotFoundException;

	JSONObject getParentForLocalURL(LocalFilesystemURL inputURL) throws IOException;

	JSONObject copyFileToURL(LocalFilesystemURL destURL, String newName,
			Filesystem srcFs, LocalFilesystemURL srcURL, boolean move) throws IOException, InvalidModificationException, JSONException, NoModificationAllowedException, FileExistsException;

	void readFileAtURL(LocalFilesystemURL inputURL, int start, int end,
			ReadFileCallback readFileCallback) throws IOException;

	long writeToFileAtURL(LocalFilesystemURL inputURL, String data, int offset,
			boolean isBinary) throws NoModificationAllowedException, IOException;

	long truncateFileAtURL(LocalFilesystemURL inputURL, long size)
			throws IOException, NoModificationAllowedException;

}
