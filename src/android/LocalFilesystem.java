package org.apache.cordova.file;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;

import org.apache.cordova.CordovaInterface;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.util.Base64;
import android.net.Uri;

public class LocalFilesystem implements Filesystem {

	private String name;
	private String fsRoot;
	private CordovaInterface cordova;

	public LocalFilesystem(CordovaInterface cordova, String name, String fsRoot) {
		this.name = name;
		this.fsRoot = fsRoot;
		this.cordova = cordova;
	}

	public String filesystemPathForURL(LocalFilesystemURL url) {
	    String path = this.fsRoot + url.fullPath;
	    if (path.endsWith("/")) {
	      path = path.substring(0, path.length()-1);
	    }
	    return path;
	}
	
    public static JSONObject makeEntryForPath(String path, int fsType, Boolean isDir) throws JSONException {
        JSONObject entry = new JSONObject();

        int end = path.endsWith("/") ? 1 : 0;
        String[] parts = path.substring(0,path.length()-end).split("/");
        String name = parts[parts.length-1];
        entry.put("isFile", !isDir);
        entry.put("isDirectory", isDir);
        entry.put("name", name);
        entry.put("fullPath", path);
        // The file system can't be specified, as it would lead to an infinite loop,
        // but the filesystem type can
        entry.put("filesystem", fsType);

        return entry;
    	
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
    	  entry.put("fullPath", inputURL.fullPath);
    	  // The file system can't be specified, as it would lead to an infinite loop.
    	  // But we can specify the type of FS, and the rest can be reconstructed in JS.
    	  entry.put("filesystem", inputURL.filesystemType);
          return entry;
      } catch (JSONException e) {
    	  throw new IOException();
      }
	}

    /**
     * If the path starts with a '/' just return that file object. If not construct the file
     * object from the path passed in and the file name.
     *
     * @param dirPath root directory
     * @param fileName new file name
     * @return
     */
    private File createFileObject(String dirPath, String fileName) {
        File fp = null;
        if (fileName.startsWith("/")) {
            fp = new File(this.fsRoot + fileName);
        } else {
            fp = new File(this.fsRoot + File.separator + dirPath + File.separator + fileName);
        }
        return fp;
    }


	@Override
	public JSONObject getFileForLocalURL(LocalFilesystemURL inputURL,
			String fileName, JSONObject options, boolean directory) throws FileExistsException, IOException, TypeMismatchException, EncodingException, JSONException {
        boolean create = false;
        boolean exclusive = false;

        if (options != null) {
            create = options.optBoolean("create");
            if (create) {
                exclusive = options.optBoolean("exclusive");
            }
        }

        // Check for a ":" character in the file to line up with BB and iOS
        if (fileName.contains(":")) {
            throw new EncodingException("This file has a : in it's name");
        }

        LocalFilesystemURL requestedURL = new LocalFilesystemURL(Uri.withAppendedPath(inputURL.URL, fileName));
        
        File fp = new File(this.filesystemPathForURL(requestedURL));

        if (create) {
            if (exclusive && fp.exists()) {
                throw new FileExistsException("create/exclusive fails");
            }
            if (directory) {
                fp.mkdir();
            } else {
                fp.createNewFile();
            }
            if (!fp.exists()) {
                throw new FileExistsException("create fails");
            }
        }
        else {
            if (!fp.exists()) {
                throw new FileNotFoundException("path does not exist");
            }
            if (directory) {
                if (fp.isFile()) {
                    throw new TypeMismatchException("path doesn't exist or is file");
                }
            } else {
                if (fp.isDirectory()) {
                    throw new TypeMismatchException("path doesn't exist or is directory");
                }
            }
        }

        // Return the directory
        return makeEntryForPath(requestedURL.fullPath, requestedURL.filesystemType, directory);
	}

	@Override
	public boolean removeFileAtLocalURL(LocalFilesystemURL inputURL) throws InvalidModificationException {

        File fp = new File(filesystemPathForURL(inputURL));

        // You can't delete a directory that is not empty
        if (fp.isDirectory() && fp.list().length > 0) {
            throw new InvalidModificationException("You can't delete a directory that is not empty.");
        }

        return fp.delete();
	}

	@Override
	public boolean recursiveRemoveFileAtLocalURL(LocalFilesystemURL inputURL) throws FileExistsException {
        File directory = new File(filesystemPathForURL(inputURL));
    	return removeDirRecursively(directory);
	}
	
	protected boolean removeDirRecursively(File directory) throws FileExistsException {
        if (directory.isDirectory()) {
            for (File file : directory.listFiles()) {
                removeDirRecursively(file);
            }
        }

        if (!directory.delete()) {
            throw new FileExistsException("could not delete: " + directory.getName());
        } else {
            return true;
        }
	}

	@Override
	public JSONArray readEntriesAtLocalURL(LocalFilesystemURL inputURL) throws FileNotFoundException {
        File fp = new File(filesystemPathForURL(inputURL));

        if (!fp.exists()) {
            // The directory we are listing doesn't exist so we should fail.
            throw new FileNotFoundException();
        }

        JSONArray entries = new JSONArray();

        if (fp.isDirectory()) {
            File[] files = fp.listFiles();
            for (int i = 0; i < files.length; i++) {
                if (files[i].canRead()) {
                    try {
						entries.put(makeEntryForPath(fullPathForFilesystemPath(files[i].getAbsolutePath()), inputURL.filesystemType, files[i].isDirectory()));
					} catch (JSONException e) {
					}
                }
            }
        }

        return entries;
	}

	private String fullPathForFilesystemPath(String absolutePath) {
		if (absolutePath != null && absolutePath.startsWith(this.fsRoot)) {
			return absolutePath.substring(this.fsRoot.length());
		}
		return null;
	}

	@Override
	public JSONObject getFileMetadataForLocalURL(LocalFilesystemURL inputURL) throws FileNotFoundException {
        File file = new File(filesystemPathForURL(inputURL));

        if (!file.exists()) {
            throw new FileNotFoundException("File at " + inputURL.URL + " does not exist.");
        }

        JSONObject metadata = new JSONObject();
        try {
        	metadata.put("size", file.length());
        	metadata.put("type", FileHelper.getMimeType(file.getAbsolutePath(), cordova));
        	metadata.put("name", file.getName());
        	metadata.put("fullPath", inputURL.fullPath);
        	metadata.put("lastModifiedDate", file.lastModified());
        } catch (JSONException e) {
        	return null;
        }
        return metadata;
	}

	@Override
	public JSONObject getParentForLocalURL(LocalFilesystemURL inputURL) throws IOException {
		LocalFilesystemURL newURL = new LocalFilesystemURL(inputURL.URL);

    	if (!("".equals(inputURL.fullPath) || "/".equals(inputURL.fullPath))) {
    		int end = inputURL.fullPath.endsWith("/") ? 1 : 0;
            int lastPathStartsAt = inputURL.fullPath.lastIndexOf('/', inputURL.fullPath.length()-end)+1;
    		newURL.fullPath = newURL.fullPath.substring(0,lastPathStartsAt);
    	}
    	return getEntryForLocalURL(newURL);
	}

}
