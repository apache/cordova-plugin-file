package org.apache.cordova.file;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;

import org.json.JSONException;
import org.json.JSONObject;

import android.util.Base64;

public class LocalFilesystem implements Filesystem {

	private String name;
	private String fsRoot;
	private CordovaInterface cordova;

	public LocalFilesystem(CordovaInterface cordova, String name, String fsRoot) {
		this.name = name;
		this.fsRoot = fsRoot;
		this.cordova = cordova;
	}

	@Override
	public JSONObject getEntryForLocalURL(LocalFilesystemURL inputURL) throws IOException {
      File fp = null;
              fp = new File(this.fsRoot + inputURL.fullPath); //TODO: Proper fs.join

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
    	  // But we can specify the type of FS, and the rest can be reconstructed in JS.
    	  entry.put("filesystem", inputURL.filesystemType);
          return entry;
      } catch (JSONException e) {
    	  throw new IOException();
      }
	}

}
