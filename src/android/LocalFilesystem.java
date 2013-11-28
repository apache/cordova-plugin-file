package org.apache.cordova.file;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.channels.FileChannel;

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
    
    public JSONObject makeEntryForFile(File file, int fsType) throws JSONException {
    	return makeEntryForPath(this.fullPathForFilesystemPath(file.getAbsolutePath()), fsType, file.isDirectory());
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

    /**
     * Check to see if the user attempted to copy an entry into its parent without changing its name,
     * or attempted to copy a directory into a directory that it contains directly or indirectly.
     *
     * @param srcDir
     * @param destinationDir
     * @return
     */
    private boolean isCopyOnItself(String src, String dest) {

        // This weird test is to determine if we are copying or moving a directory into itself.
        // Copy /sdcard/myDir to /sdcard/myDir-backup is okay but
        // Copy /sdcard/myDir to /sdcard/myDir/backup should throw an INVALID_MODIFICATION_ERR
        if (dest.startsWith(src) && dest.indexOf(File.separator, src.length() - 1) != -1) {
            return true;
        }

        return false;
    }


    /**
     * Creates the destination File object based on name passed in
     *
     * @param newName for the file directory to be called, if null use existing file name
     * @param fp represents the source file
     * @param destination represents the destination file
     * @return a File object that represents the destination
     */
    private File createDestination(String newName, File fp, File destination) {
        File destFile = null;

        // I know this looks weird but it is to work around a JSON bug.
        if ("null".equals(newName) || "".equals(newName)) {
            newName = null;
        }

        if (newName != null) {
            destFile = new File(destination.getAbsolutePath() + File.separator + newName);
        } else {
            destFile = new File(destination.getAbsolutePath() + File.separator + fp.getName());
        }
        return destFile;
    }

    /**
     * Copy a file
     *
     * @param srcFile file to be copied
     * @param destFile destination to be copied to
     * @return a FileEntry object
     * @throws IOException
     * @throws InvalidModificationException
     * @throws JSONException
     */
    private JSONObject copyFile(File srcFile, File destFile, int fsType) throws IOException, InvalidModificationException, JSONException {
        // Renaming a file to an existing directory should fail
        if (destFile.exists() && destFile.isDirectory()) {
            throw new InvalidModificationException("Can't rename a file to a directory");
        }

        copyAction(srcFile, destFile);

        return makeEntryForFile(destFile, fsType);
    }

    /**
     * Moved this code into it's own method so moveTo could use it when the move is across file systems
     */
    private void copyAction(File srcFile, File destFile)
            throws FileNotFoundException, IOException {
        FileInputStream istream = new FileInputStream(srcFile);
        FileOutputStream ostream = new FileOutputStream(destFile);
        FileChannel input = istream.getChannel();
        FileChannel output = ostream.getChannel();

        try {
            input.transferTo(0, input.size(), output);
        } finally {
            istream.close();
            ostream.close();
            input.close();
            output.close();
        }
    }

    /**
     * Copy a directory
     *
     * @param srcDir directory to be copied
     * @param destinationDir destination to be copied to
     * @return a DirectoryEntry object
     * @throws JSONException
     * @throws IOException
     * @throws NoModificationAllowedException
     * @throws InvalidModificationException
     */
    private JSONObject copyDirectory(File srcDir, File destinationDir, int fsType) throws JSONException, IOException, NoModificationAllowedException, InvalidModificationException {
        // Renaming a file to an existing directory should fail
        if (destinationDir.exists() && destinationDir.isFile()) {
            throw new InvalidModificationException("Can't rename a file to a directory");
        }

        // Check to make sure we are not copying the directory into itself
        if (isCopyOnItself(srcDir.getAbsolutePath(), destinationDir.getAbsolutePath())) {
            throw new InvalidModificationException("Can't copy itself into itself");
        }

        // See if the destination directory exists. If not create it.
        if (!destinationDir.exists()) {
            if (!destinationDir.mkdir()) {
                // If we can't create the directory then fail
                throw new NoModificationAllowedException("Couldn't create the destination directory");
            }
        }
        

        for (File file : srcDir.listFiles()) {
            File destination = new File(destinationDir.getAbsoluteFile() + File.separator + file.getName());
            if (file.isDirectory()) {
                copyDirectory(file, destination, fsType);
            } else {
                copyFile(file, destination, fsType);
            }
        }

        return makeEntryForFile(destinationDir, fsType);
    }

    /**
     * Move a file
     *
     * @param srcFile file to be copied
     * @param destFile destination to be copied to
     * @return a FileEntry object
     * @throws IOException
     * @throws InvalidModificationException
     * @throws JSONException
     */
    private JSONObject moveFile(File srcFile, File destFile, int fsType) throws IOException, JSONException, InvalidModificationException {
        // Renaming a file to an existing directory should fail
        if (destFile.exists() && destFile.isDirectory()) {
            throw new InvalidModificationException("Can't rename a file to a directory");
        }

        // Try to rename the file
        if (!srcFile.renameTo(destFile)) {
            // Trying to rename the file failed.  Possibly because we moved across file system on the device.
            // Now we have to do things the hard way
            // 1) Copy all the old file
            // 2) delete the src file
            copyAction(srcFile, destFile);
            if (destFile.exists()) {
                srcFile.delete();
            } else {
                throw new IOException("moved failed");
            }
        }

        return makeEntryForFile(destFile, fsType);
    }

    /**
     * Move a directory
     *
     * @param srcDir directory to be copied
     * @param destinationDir destination to be copied to
     * @return a DirectoryEntry object
     * @throws JSONException
     * @throws IOException
     * @throws InvalidModificationException
     * @throws NoModificationAllowedException
     * @throws FileExistsException
     */
    private JSONObject moveDirectory(File srcDir, File destinationDir, int fsType) throws IOException, JSONException, InvalidModificationException, NoModificationAllowedException, FileExistsException {
        // Renaming a file to an existing directory should fail
        if (destinationDir.exists() && destinationDir.isFile()) {
            throw new InvalidModificationException("Can't rename a file to a directory");
        }

        // Check to make sure we are not copying the directory into itself
        if (isCopyOnItself(srcDir.getAbsolutePath(), destinationDir.getAbsolutePath())) {
            throw new InvalidModificationException("Can't move itself into itself");
        }

        // If the destination directory already exists and is empty then delete it.  This is according to spec.
        if (destinationDir.exists()) {
            if (destinationDir.list().length > 0) {
                throw new InvalidModificationException("directory is not empty");
            }
        }

        // Try to rename the directory
        if (!srcDir.renameTo(destinationDir)) {
            // Trying to rename the directory failed.  Possibly because we moved across file system on the device.
            // Now we have to do things the hard way
            // 1) Copy all the old files
            // 2) delete the src directory
            copyDirectory(srcDir, destinationDir, fsType);
            if (destinationDir.exists()) {
                removeDirRecursively(srcDir);
            } else {
                throw new IOException("moved failed");
            }
        }

        return makeEntryForFile(destinationDir, fsType);
    }

	
	@Override
	public JSONObject copyFileToURL(LocalFilesystemURL destURL, String newName,
			Filesystem srcFs, LocalFilesystemURL srcURL, boolean move) throws IOException, InvalidModificationException, JSONException, NoModificationAllowedException, FileExistsException {
		

        String newFileName = this.filesystemPathForURL(srcURL);
        String newParent = this.filesystemPathForURL(destURL);

	    
        File destinationDir = new File(newParent);
        if (!destinationDir.exists()) {
            // The destination does not exist so we should fail.
            throw new FileNotFoundException("The source does not exist");
        }


	    if (LocalFilesystem.class.isInstance(srcFs)) {
	    	
	        /* Same FS, we can shortcut with NSFileManager operations */
	    	

	        File source = new File(newFileName);

	        if (!source.exists()) {
	            // The file/directory we are copying doesn't exist so we should fail.
	            throw new FileNotFoundException("The source does not exist");
	        }

	        // Figure out where we should be copying to
	        File destination = createDestination(newName, source, destinationDir);

	        //Log.d(LOG_TAG, "Source: " + source.getAbsolutePath());
	        //Log.d(LOG_TAG, "Destin: " + destination.getAbsolutePath());

	        // Check to see if source and destination are the same file
	        if (source.getAbsolutePath().equals(destination.getAbsolutePath())) {
	            throw new InvalidModificationException("Can't copy a file onto itself");
	        }

	        if (source.isDirectory()) {
	            if (move) {
	                return moveDirectory(source, destination, destURL.filesystemType);
	            } else {
	                return copyDirectory(source, destination, destURL.filesystemType);
	            }
	        } else {
	            if (move) {
	                JSONObject newFileEntry = moveFile(source, destination, destURL.filesystemType);

/*	                // If we've moved a file given its content URI, we need to clean up.
	                // TODO: Move this to where it belongs, in cross-fs mv code below.
	                if (srcURL.URL.getScheme().equals("content")) {
	                    notifyDelete(fileName);
	                }
*/
	                return newFileEntry;
	            } else {
	                return copyFile(source, destination, destURL.filesystemType);
	            }
	        }

	    	
	    } else {
/*	        // Need to copy the hard way
	    	srcFs.readFileAtURL(srcURL, 0, -1, new ReadFileCallback() {
	    		void run(data, mimetype, errorcode) {
	    			if (data != null) {
	    				//write data to file
	    				// send success message -- call original callback?
	    			}
	    			// error
	    		}
    		});
	    	return null; // Async, will return later
*/
    	}
		return null;	    
	}


}
