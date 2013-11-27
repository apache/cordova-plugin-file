package org.apache.cordova.file;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;

import org.apache.cordova.CordovaInterface;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.database.Cursor;
import android.provider.MediaStore;

public class ContentFilesystem implements Filesystem {

	private CordovaInterface cordova;
	
	public ContentFilesystem(CordovaInterface cordova) {
		this.cordova = cordova;
	}
	
	@Override
    @SuppressWarnings("deprecation")
	public JSONObject getEntryForLocalURL(LocalFilesystemURL inputURL) throws IOException {
      File fp = null;

          Cursor cursor = this.cordova.getActivity().managedQuery(inputURL.URL, new String[] { MediaStore.Images.Media.DATA }, null, null, null);
          // Note: MediaStore.Images/Audio/Video.Media.DATA is always "_data"
          int column_index = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATA);
          cursor.moveToFirst();
          fp = new File(cursor.getString(column_index));

      if (!fp.exists()) {
          throw new FileNotFoundException();
      }
      if (!fp.canRead()) {
          throw new IOException();
      }
      try {
    	  JSONObject entry = new JSONObject();
    	  entry.put("isFile", fp.isFile());
    	  entry.put("isDirectory", fp.isDirectory());
    	  entry.put("name", fp.getName());
    	  entry.put("fullPath", "file://" + fp.getAbsolutePath());
    	  // The file system can't be specified, as it would lead to an infinite loop.
    	  entry.put("filesystem", FileUtils.APPLICATION);
          return entry;
      } catch (JSONException e) {
    	  throw new IOException();
      }
	}
	@Override
	public JSONObject getFileForLocalURL(LocalFilesystemURL inputURL,
			String fileName, JSONObject options, boolean directory) throws IOException {
		throw new IOException("Cannot create content url");
	}
	@Override
	public boolean removeFileAtLocalURL(LocalFilesystemURL inputURL)
			throws NoModificationAllowedException {
		throw new NoModificationAllowedException("Cannot remove content url");
	}
	@Override
	public boolean recursiveRemoveFileAtLocalURL(LocalFilesystemURL inputURL)
			throws NoModificationAllowedException {
		throw new NoModificationAllowedException("Cannot remove content url");
	}
	@Override
	public JSONArray readEntriesAtLocalURL(LocalFilesystemURL inputURL)
			throws FileNotFoundException {
		// TODO Auto-generated method stub
		return null;
	}

}
