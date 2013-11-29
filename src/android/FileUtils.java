/*
       Licensed to the Apache Software Foundation (ASF) under one
       or more contributor license agreements.  See the NOTICE file
       distributed with this work for additional information
       regarding copyright ownership.  The ASF licenses this file
       to you under the Apache License, Version 2.0 (the
       "License"); you may not use this file except in compliance
       with the License.  You may obtain a copy of the License at

         http://www.apache.org/licenses/LICENSE-2.0

       Unless required by applicable law or agreed to in writing,
       software distributed under the License is distributed on an
       "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
       KIND, either express or implied.  See the License for the
       specific language governing permissions and limitations
       under the License.
 */
package org.apache.cordova.file;

import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaInterface;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CordovaWebView;
import org.apache.cordova.PluginResult;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.net.MalformedURLException;
import java.net.URLDecoder;
import java.nio.channels.FileChannel;
import java.util.ArrayList;

/**
 * This class provides SD card file and directory services to JavaScript.
 * Only files on the SD card can be accessed.
 */
public class FileUtils extends CordovaPlugin {
    private static final String LOG_TAG = "FileUtils";

    public static int NOT_FOUND_ERR = 1;
    public static int SECURITY_ERR = 2;
    public static int ABORT_ERR = 3;

    public static int NOT_READABLE_ERR = 4;
    public static int ENCODING_ERR = 5;
    public static int NO_MODIFICATION_ALLOWED_ERR = 6;
    public static int INVALID_STATE_ERR = 7;
    public static int SYNTAX_ERR = 8;
    public static int INVALID_MODIFICATION_ERR = 9;
    public static int QUOTA_EXCEEDED_ERR = 10;
    public static int TYPE_MISMATCH_ERR = 11;
    public static int PATH_EXISTS_ERR = 12;

    public static int TEMPORARY = 0;
    public static int PERSISTENT = 1;
    public static int RESOURCE = 2;
    public static int APPLICATION = 3;

    private interface FileOp {
        void run(  ) throws Exception;
    }
    
    private ArrayList<Filesystem> filesystems;

    @Override
    public void initialize(CordovaInterface cordova, CordovaWebView webView) {
    	super.initialize(cordova, webView);
    	this.filesystems = new ArrayList<Filesystem>();
    	
    	File fp;
    	String tempRoot;
    	String persistentRoot;
    	if (Environment.getExternalStorageState().equals(Environment.MEDIA_MOUNTED)) {
    		persistentRoot = Environment.getExternalStorageDirectory().getAbsolutePath();
    		tempRoot = Environment.getExternalStorageDirectory().getAbsolutePath() +
    				"/Android/data/" + cordova.getActivity().getPackageName() + "/cache/";
    	} else {
    		persistentRoot = "/data/data/" + cordova.getActivity().getPackageName();
    		tempRoot = "/data/data/" + cordova.getActivity().getPackageName() + "/cache/";
    	}
    	// Create the cache dir if it doesn't exist.
    	fp = new File(tempRoot);
    	fp.mkdirs();
    	this.filesystems.add(new LocalFilesystem(cordova, "temporary", tempRoot));
    	this.filesystems.add(new LocalFilesystem(cordova, "persistent", persistentRoot));
    	this.filesystems.add(new ContentFilesystem(cordova));
    }
    
    public Filesystem filesystemForURL(LocalFilesystemURL localURL) {
    	try {
    		return this.filesystems.get(localURL.filesystemType);
    	} catch (ArrayIndexOutOfBoundsException e) {
    		return null;
    	}
    }
    
    /**
     * Executes the request and returns whether the action was valid.
     *
     * @param action 		The action to execute.
     * @param args 		JSONArray of arguments for the plugin.
     * @param callbackContext	The callback context used when calling back into JavaScript.
     * @return 			True if the action was valid, false otherwise.
     */
    public boolean execute(String action, final JSONArray args, final CallbackContext callbackContext) throws JSONException {
        if (action.equals("testSaveLocationExists")) {
            threadhelper( new FileOp( ){
                public void run() {
                    boolean b = DirectoryManager.testSaveLocationExists();
                    callbackContext.sendPluginResult(new PluginResult(PluginResult.Status.OK, b));
                }
            },callbackContext);
        }
        else if (action.equals("getFreeDiskSpace")) {
            threadhelper( new FileOp( ){
                public void run() {
                    long l = DirectoryManager.getFreeDiskSpace(false);
                    callbackContext.sendPluginResult(new PluginResult(PluginResult.Status.OK, l));
                }
            },callbackContext);
        }
        else if (action.equals("testFileExists")) {
            final String fname=args.getString(0);
            threadhelper( new FileOp( ){
                public void run() {
                    boolean b = DirectoryManager.testFileExists(fname);
                    callbackContext.sendPluginResult(new PluginResult(PluginResult.Status.OK, b));
                }
            }, callbackContext);
        }
        else if (action.equals("testDirectoryExists")) {
            final String fname=args.getString(0);
            threadhelper( new FileOp( ){
                public void run() {
                    boolean b = DirectoryManager.testFileExists(fname);
                    callbackContext.sendPluginResult(new PluginResult(PluginResult.Status.OK, b));
                }
            }, callbackContext);
        }
        else if (action.equals("readAsText")) {
            final String encoding = args.getString(1);
            final int start = args.getInt(2);
            final int end = args.getInt(3);
            final String fname=args.getString(0);
            threadhelper( new FileOp( ){
                public void run() throws MalformedURLException {
                    readFileAs(fname, start, end, callbackContext, encoding, PluginResult.MESSAGE_TYPE_STRING);
                }
            }, callbackContext);
        }
        else if (action.equals("readAsDataURL")) {
            final int start = args.getInt(1);
            final int end = args.getInt(2);
            final String fname=args.getString(0);
            threadhelper( new FileOp( ){
                public void run() throws MalformedURLException  {
                    readFileAs(fname, start, end, callbackContext, null, -1);
                }
            }, callbackContext);
        }
        else if (action.equals("readAsArrayBuffer")) {
            final int start = args.getInt(1);
            final int end = args.getInt(2);
            final String fname=args.getString(0);
            threadhelper( new FileOp( ){
                public void run() throws MalformedURLException  {
                    readFileAs(fname, start, end, callbackContext, null, PluginResult.MESSAGE_TYPE_ARRAYBUFFER);
                }
            },callbackContext);
        }
        else if (action.equals("readAsBinaryString")) {
            final int start = args.getInt(1);
            final int end = args.getInt(2);
            final String fname=args.getString(0);
            threadhelper( new FileOp( ){
                public void run() throws MalformedURLException  {
                    readFileAs(fname, start, end, callbackContext, null, PluginResult.MESSAGE_TYPE_BINARYSTRING);
                }
            }, callbackContext);
        }
        else if (action.equals("write")) {
            final String fname=args.getString(0);
            final String data=args.getString(1);
            final int offset=args.getInt(2);
            final Boolean isBinary=args.getBoolean(3);
            threadhelper( new FileOp( ){
                public void run() throws FileNotFoundException, IOException, NoModificationAllowedException {
                    long fileSize = write(fname, data, offset, isBinary);
                    callbackContext.sendPluginResult(new PluginResult(PluginResult.Status.OK, fileSize));
                }
            }, callbackContext);
        }
        else if (action.equals("truncate")) {
            final String fname=args.getString(0);
            final int offset=args.getInt(1);
            threadhelper( new FileOp( ){
                public void run( ) throws FileNotFoundException, IOException, NoModificationAllowedException {
                    long fileSize = truncateFile(fname, offset);
                    callbackContext.sendPluginResult(new PluginResult(PluginResult.Status.OK, fileSize));
                }
            }, callbackContext);
        }
        else if (action.equals("requestFileSystem")) {
            final int fstype=args.getInt(0);
            final long size = args.optLong(1);
            threadhelper( new FileOp( ){
                public void run() throws IOException, JSONException {
                    if (size != 0 && size > (DirectoryManager.getFreeDiskSpace(true) * 1024)) {
                        callbackContext.sendPluginResult(new PluginResult(PluginResult.Status.ERROR, FileUtils.QUOTA_EXCEEDED_ERR));
                    } else {
                        JSONObject obj = requestFileSystem(fstype);
                        callbackContext.success(obj);
                    }
                }
            }, callbackContext);
        }
        else if (action.equals("resolveLocalFileSystemURI")) {
            final String fname=args.getString(0);
            threadhelper( new FileOp( ){
                public void run() throws IOException, JSONException {
                    JSONObject obj = resolveLocalFileSystemURI(fname);
                    callbackContext.success(obj);
                }
            },callbackContext);
        }
        else if (action.equals("getMetadata")) {
            final String fname=args.getString(0);
            threadhelper( new FileOp( ){
                public void run() throws FileNotFoundException, JSONException, MalformedURLException {
                    JSONObject obj = getFileMetadata(fname);
                    callbackContext.sendPluginResult(new PluginResult(PluginResult.Status.OK, obj.getLong("lastModifiedDate")));
                }
            }, callbackContext);
        }
        else if (action.equals("getFileMetadata")) {
            final String fname=args.getString(0);
            threadhelper( new FileOp( ){
                public void run() throws FileNotFoundException, JSONException, MalformedURLException {
                    JSONObject obj = getFileMetadata(fname);
                    callbackContext.success(obj);
                }
            },callbackContext);
        }
        else if (action.equals("getParent")) {
            final String fname=args.getString(0);
            threadhelper( new FileOp( ){
                public void run() throws JSONException, IOException {
                    JSONObject obj = getParent(fname);
                    callbackContext.success(obj);
                }
            },callbackContext);
        }
        else if (action.equals("getDirectory")) {
            final String dirname=args.getString(0);
            final String fname=args.getString(1);
            threadhelper( new FileOp( ){
                public void run() throws FileExistsException, IOException, TypeMismatchException, EncodingException, JSONException {
                   JSONObject obj = getFile(dirname, fname, args.optJSONObject(2), true);
                   callbackContext.success(obj);
                }
            },callbackContext);
        }
        else if (action.equals("getFile")) {
            final String dirname=args.getString(0);
            final String fname=args.getString(1);
            threadhelper( new FileOp( ){
                public void run() throws FileExistsException, IOException, TypeMismatchException, EncodingException, JSONException {
                    JSONObject obj = getFile(dirname, fname, args.optJSONObject(2), false);
                    callbackContext.success(obj);
                }
            },callbackContext);
        }
        else if (action.equals("remove")) {
            final String fname=args.getString(0);
            threadhelper( new FileOp( ){
                public void run() throws NoModificationAllowedException, InvalidModificationException, MalformedURLException {
                    boolean success= remove(fname);
                    if (success) {
                        notifyDelete(fname);
                        callbackContext.success();
                    } else {
                        callbackContext.error(FileUtils.NO_MODIFICATION_ALLOWED_ERR);
                    }
                }
            },callbackContext);
        }
        else if (action.equals("removeRecursively")) {
            final String fname=args.getString(0);
            threadhelper( new FileOp( ){
                public void run() throws FileExistsException, MalformedURLException, NoModificationAllowedException {
                    boolean success = removeRecursively(fname);
                    if (success) {
                        callbackContext.success();
                    } else {
                        callbackContext.error(FileUtils.NO_MODIFICATION_ALLOWED_ERR);
                    }
                }
            },callbackContext);
        }
        else if (action.equals("moveTo")) {
            final String fname=args.getString(0);
            final String newParent=args.getString(1);
            final String newName=args.getString(2);
            threadhelper( new FileOp( ){
                public void run() throws JSONException, NoModificationAllowedException, IOException, InvalidModificationException, EncodingException, FileExistsException {
                    JSONObject entry = transferTo(fname, newParent, newName, true);
                    callbackContext.success(entry);
                }
            },callbackContext);
        }
        else if (action.equals("copyTo")) {
            final String fname=args.getString(0);
            final String newParent=args.getString(1);
            final String newName=args.getString(2);
            threadhelper( new FileOp( ){
                public void run() throws JSONException, NoModificationAllowedException, IOException, InvalidModificationException, EncodingException, FileExistsException {
                    JSONObject entry = transferTo(fname, newParent, newName, false);
                    callbackContext.success(entry);
                }
            },callbackContext);
        }
        else if (action.equals("readEntries")) {
            final String fname=args.getString(0);
            threadhelper( new FileOp( ){
                public void run() throws FileNotFoundException, JSONException, MalformedURLException {
                    JSONArray entries = readEntries(fname);
                    callbackContext.success(entries);
                }
            },callbackContext);
        }
        else {
            return false;
        }
        return true;
    }

    /* helper to execute functions async and handle the result codes
     *
     */
    private void threadhelper(final FileOp f, final CallbackContext callbackContext){
        cordova.getThreadPool().execute(new Runnable() {
            public void run() {
                try {
                    f.run();
                } catch ( Exception e) {
                    e.printStackTrace();
                    if( e instanceof EncodingException){
                        callbackContext.error(FileUtils.ENCODING_ERR);
                    } else if(e instanceof FileNotFoundException) {
                        callbackContext.error(FileUtils.NOT_FOUND_ERR);
                    } else if(e instanceof FileExistsException) {
                        callbackContext.error(FileUtils.PATH_EXISTS_ERR);
                    } else if(e instanceof NoModificationAllowedException ) {
                        callbackContext.error(FileUtils.NO_MODIFICATION_ALLOWED_ERR);
                    } else if(e instanceof InvalidModificationException ) {
                        callbackContext.error(FileUtils.INVALID_MODIFICATION_ERR);
                    } else if(e instanceof MalformedURLException ) {
                        callbackContext.error(FileUtils.ENCODING_ERR);
                    } else if(e instanceof IOException ) {
                        callbackContext.error(FileUtils.INVALID_MODIFICATION_ERR);
                    } else if(e instanceof EncodingException ) {
                        callbackContext.error(FileUtils.ENCODING_ERR);
                    } else if(e instanceof TypeMismatchException ) {
                        callbackContext.error(FileUtils.TYPE_MISMATCH_ERR);
                    }
                }
            }
        });
    }

    /**
     * Need to check to see if we need to clean up the content store
     *
     * @param filePath the path to check
     */
    private void notifyDelete(String filePath) {
        String newFilePath = FileHelper.getRealPath(filePath, cordova);
        try {
            this.cordova.getActivity().getContentResolver().delete(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    MediaStore.Images.Media.DATA + " = ?",
                    new String[] { newFilePath });
        } catch (UnsupportedOperationException t) {
            // Was seeing this on the File mobile-spec tests on 4.0.3 x86 emulator.
            // The ContentResolver applies only when the file was registered in the
            // first case, which is generally only the case with images.
        }
    }

    /**
     * Allows the user to look up the Entry for a file or directory referred to by a local URI.
     *
     * @param url of the file/directory to look up
     * @return a JSONObject representing a Entry from the filesystem
     * @throws MalformedURLException if the url is not valid
     * @throws FileNotFoundException if the file does not exist
     * @throws IOException if the user can't read the file
     * @throws JSONException
     */
    private JSONObject resolveLocalFileSystemURI(String url) throws IOException, JSONException {
        String decoded = URLDecoder.decode(url, "UTF-8");

        try {
        	LocalFilesystemURL inputURL = new LocalFilesystemURL(decoded);
        	Filesystem fs = this.filesystemForURL(inputURL);
        	if (fs == null) {
        		throw new MalformedURLException("No installed handlers for this URL");
        	}
        	return fs.getEntryForLocalURL(inputURL);
        } catch (IllegalArgumentException e) {
        	throw new MalformedURLException("Unrecognized filesystem URL");
        }
    }   
    
    /**
     * Read the list of files from this directory.
     *
     * @param fileName the directory to read from
     * @return a JSONArray containing JSONObjects that represent Entry objects.
     * @throws FileNotFoundException if the directory is not found.
     * @throws JSONException
     * @throws MalformedURLException 
     */
    private JSONArray readEntries(String baseURLstr) throws FileNotFoundException, JSONException, MalformedURLException {
        try {
        	LocalFilesystemURL inputURL = new LocalFilesystemURL(baseURLstr);
        	Filesystem fs = this.filesystemForURL(inputURL);
        	if (fs == null) {
        		throw new MalformedURLException("No installed handlers for this URL");
        	}
        	return fs.readEntriesAtLocalURL(inputURL);
        
        } catch (IllegalArgumentException e) {
        	throw new MalformedURLException("Unrecognized filesystem URL");
        }
    }

    /**
     * A setup method that handles the move/copy of files/directories
     *
     * @param fileName to be copied/moved
     * @param newParent is the location where the file will be copied/moved to
     * @param newName for the file directory to be called, if null use existing file name
     * @param move if false do a copy, if true do a move
     * @return a Entry object
     * @throws NoModificationAllowedException
     * @throws IOException
     * @throws InvalidModificationException
     * @throws EncodingException
     * @throws JSONException
     * @throws FileExistsException
     */
    private JSONObject transferTo(String srcURLstr, String destURLstr, String newName, boolean move) throws JSONException, NoModificationAllowedException, IOException, InvalidModificationException, EncodingException, FileExistsException {
        if (srcURLstr == null || destURLstr == null) {
            // either no source or no destination provided
        	throw new FileNotFoundException();
        }

        LocalFilesystemURL srcURL = new LocalFilesystemURL(srcURLstr);
        LocalFilesystemURL destURL = new LocalFilesystemURL(destURLstr);

        Filesystem srcFs = this.filesystemForURL(srcURL);
        Filesystem destFs = this.filesystemForURL(destURL);

        // Check for invalid file name
        if (newName != null && newName.contains(":")) {
            throw new EncodingException("Bad file name");
        }

        return destFs.copyFileToURL(destURL, newName, srcFs, srcURL, move);
    }

    /**
     * Deletes a directory and all of its contents, if any. In the event of an error
     * [e.g. trying to delete a directory that contains a file that cannot be removed],
     * some of the contents of the directory may be deleted.
     * It is an error to attempt to delete the root directory of a filesystem.
     *
     * @param filePath the directory to be removed
     * @return a boolean representing success of failure
     * @throws FileExistsException
     * @throws NoModificationAllowedException 
     * @throws MalformedURLException 
     */
    private boolean removeRecursively(String baseURLstr) throws FileExistsException, NoModificationAllowedException, MalformedURLException {
        try {
        	LocalFilesystemURL inputURL = new LocalFilesystemURL(baseURLstr);
        	// You can't delete the root directory.
        	if ("".equals(inputURL.fullPath) || "/".equals(inputURL.fullPath)) {
        		throw new NoModificationAllowedException("You can't delete the root directory");
        	}

        	Filesystem fs = this.filesystemForURL(inputURL);
        	if (fs == null) {
        		throw new MalformedURLException("No installed handlers for this URL");
        	}
        	return fs.recursiveRemoveFileAtLocalURL(inputURL);
        
        } catch (IllegalArgumentException e) {
        	throw new MalformedURLException("Unrecognized filesystem URL");
        }
    }


    /**
     * Deletes a file or directory. It is an error to attempt to delete a directory that is not empty.
     * It is an error to attempt to delete the root directory of a filesystem.
     *
     * @param filePath file or directory to be removed
     * @return a boolean representing success of failure
     * @throws NoModificationAllowedException
     * @throws InvalidModificationException
     * @throws MalformedURLException 
     */
    private boolean remove(String baseURLstr) throws NoModificationAllowedException, InvalidModificationException, MalformedURLException {
        try {
        	LocalFilesystemURL inputURL = new LocalFilesystemURL(baseURLstr);
        	// You can't delete the root directory.
        	if ("".equals(inputURL.fullPath) || "/".equals(inputURL.fullPath)) {

        		throw new NoModificationAllowedException("You can't delete the root directory");
        	}

        	Filesystem fs = this.filesystemForURL(inputURL);
        	if (fs == null) {
        		throw new MalformedURLException("No installed handlers for this URL");
        	}
        	return fs.removeFileAtLocalURL(inputURL);
        
        } catch (IllegalArgumentException e) {
        	throw new MalformedURLException("Unrecognized filesystem URL");
        }
    }

    /**
     * Creates or looks up a file.
     *
     * @param baseURLstr base directory
     * @param fileName file/directory to lookup or create
     * @param options specify whether to create or not
     * @param directory if true look up directory, if false look up file
     * @return a Entry object
     * @throws FileExistsException
     * @throws IOException
     * @throws TypeMismatchException
     * @throws EncodingException
     * @throws JSONException
     */
    private JSONObject getFile(String baseURLstr, String fileName, JSONObject options, boolean directory) throws FileExistsException, IOException, TypeMismatchException, EncodingException, JSONException {
        try {
        	LocalFilesystemURL inputURL = new LocalFilesystemURL(baseURLstr);
        	Filesystem fs = this.filesystemForURL(inputURL);
        	if (fs == null) {
        		throw new MalformedURLException("No installed handlers for this URL");
        	}
        	return fs.getFileForLocalURL(inputURL, fileName, options, directory);
        
        } catch (IllegalArgumentException e) {
        	throw new MalformedURLException("Unrecognized filesystem URL");
        }

    }

    /**
     * Look up the parent DirectoryEntry containing this Entry.
     * If this Entry is the root of its filesystem, its parent is itself.
     *
     * @param filePath
     * @return
     * @throws JSONException
     * @throws IOException 
     */
    private JSONObject getParent(String baseURLstr) throws JSONException, IOException {
        try {
        	LocalFilesystemURL inputURL = new LocalFilesystemURL(baseURLstr);
        	Filesystem fs = this.filesystemForURL(inputURL);
        	if (fs == null) {
        		throw new MalformedURLException("No installed handlers for this URL");
        	}
        	return fs.getParentForLocalURL(inputURL);
        
        } catch (IllegalArgumentException e) {
        	throw new MalformedURLException("Unrecognized filesystem URL");
        }
    }

    /**
     * Returns a File that represents the current state of the file that this FileEntry represents.
     *
     * @param filePath to entry
     * @return returns a JSONObject represent a W3C File object
     * @throws FileNotFoundException
     * @throws JSONException
     * @throws MalformedURLException 
     */
    private JSONObject getFileMetadata(String baseURLstr) throws FileNotFoundException, JSONException, MalformedURLException {
        try {
        	LocalFilesystemURL inputURL = new LocalFilesystemURL(baseURLstr);
        	Filesystem fs = this.filesystemForURL(inputURL);
        	if (fs == null) {
        		throw new MalformedURLException("No installed handlers for this URL");
        	}
        	return fs.getFileMetadataForLocalURL(inputURL);
        
        } catch (IllegalArgumentException e) {
        	throw new MalformedURLException("Unrecognized filesystem URL");
        }
    }

    /**
     * Requests a filesystem in which to store application data.
     *
     * @param type of file system requested
     * @return a JSONObject representing the file system
     * @throws IOException
     * @throws JSONException
     */
    private JSONObject requestFileSystem(int type) throws IOException, JSONException {
        JSONObject fs = new JSONObject();
        if (type == TEMPORARY) {
            File fp;
            fs.put("name", "temporary");
            if (Environment.getExternalStorageState().equals(Environment.MEDIA_MOUNTED)) {
                fp = new File(Environment.getExternalStorageDirectory().getAbsolutePath() +
                        "/Android/data/" + cordova.getActivity().getPackageName() + "/cache/");
                // Create the cache dir if it doesn't exist.
                fp.mkdirs();
                fs.put("root", getEntry(Environment.getExternalStorageDirectory().getAbsolutePath() +
                        "/Android/data/" + cordova.getActivity().getPackageName() + "/cache/"));
            } else {
                fp = new File("/data/data/" + cordova.getActivity().getPackageName() + "/cache/");
                // Create the cache dir if it doesn't exist.
                fp.mkdirs();
                fs.put("root", getEntry("/data/data/" + cordova.getActivity().getPackageName() + "/cache/"));
            }
        }
        else if (type == PERSISTENT) {
            fs.put("name", "persistent");
            if (Environment.getExternalStorageState().equals(Environment.MEDIA_MOUNTED)) {
                fs.put("root", getEntry(Environment.getExternalStorageDirectory()));
            } else {
                fs.put("root", getEntry("/data/data/" + cordova.getActivity().getPackageName()));
            }
        }
        else {
            throw new IOException("No filesystem of type requested");
        }
        fs.put("root", makeEntryForPath("/", type, true));
        return fs;
    }

    public static JSONObject makeEntryForPath(String path, int fsType, Boolean isDir) throws JSONException {
        JSONObject entry = new JSONObject();

        int end = path.endsWith("/") ? 1 : 0;
        String[] parts = path.substring(0,path.length()-end).split("/",1);
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
    /**
     * Returns a JSON object representing the given File.
     *
     * @param file the File to convert
     * @return a JSON representation of the given File
     * @throws JSONException
     */
    @Deprecated
    public static JSONObject getEntry(File file) throws JSONException {
        return makeEntryForPath(file.getAbsolutePath(), 0, file.isDirectory());
    }

    /**
     * Returns a JSON Object representing a directory on the device's file system
     *
     * @param path to the directory
     * @return
     * @throws JSONException
     */
    private JSONObject getEntry(String path) throws JSONException {
        return getEntry(new File(path));
    }

    /**
     * Read the contents of a file.
     * This is done in a background thread; the result is sent to the callback.
     *
     * @param filename          The name of the file.
     * @param start             Start position in the file.
     * @param end               End position to stop at (exclusive).
     * @param callbackContext   The context through which to send the result.
     * @param encoding          The encoding to return contents as.  Typical value is UTF-8. (see http://www.iana.org/assignments/character-sets)
     * @param resultType        The desired type of data to send to the callback.
     * @return                  Contents of file.
     * @throws MalformedURLException 
     */
    public void readFileAs(final String srcURLstr, final int start, final int end, final CallbackContext callbackContext, final String encoding, final int resultType) throws MalformedURLException {
        try {
        	LocalFilesystemURL inputURL = new LocalFilesystemURL(srcURLstr);
        	Filesystem fs = this.filesystemForURL(inputURL);
        	if (fs == null) {
        		throw new MalformedURLException("No installed handlers for this URL");
        	}
        
            fs.readFileAtURL(inputURL, start, end, new ReadFileCallback() {
            	public void handleData(byte[] bytes, String contentType) {
            		try {
            			PluginResult result;
            			switch (resultType) {
            			case PluginResult.MESSAGE_TYPE_STRING:
            				result = new PluginResult(PluginResult.Status.OK, new String(bytes, encoding));
            				break;
            			case PluginResult.MESSAGE_TYPE_ARRAYBUFFER:
            				result = new PluginResult(PluginResult.Status.OK, bytes);
            				break;
            			case PluginResult.MESSAGE_TYPE_BINARYSTRING:
            				result = new PluginResult(PluginResult.Status.OK, bytes, true);
            				break;
            			default: // Base64.
            			byte[] base64 = Base64.encode(bytes, Base64.NO_WRAP);
            			String s = "data:" + contentType + ";base64," + new String(base64, "US-ASCII");
            			result = new PluginResult(PluginResult.Status.OK, s);
            			}

            			callbackContext.sendPluginResult(result);
            		} catch (IOException e) {
            			Log.d(LOG_TAG, e.getLocalizedMessage());
            			callbackContext.sendPluginResult(new PluginResult(PluginResult.Status.IO_EXCEPTION, NOT_READABLE_ERR));
                    }
            	}
            });


        } catch (IllegalArgumentException e) {
        	throw new MalformedURLException("Unrecognized filesystem URL");
        } catch (FileNotFoundException e) {
        	callbackContext.sendPluginResult(new PluginResult(PluginResult.Status.IO_EXCEPTION, NOT_FOUND_ERR));
        } catch (IOException e) {
        	Log.d(LOG_TAG, e.getLocalizedMessage());
        	callbackContext.sendPluginResult(new PluginResult(PluginResult.Status.IO_EXCEPTION, NOT_READABLE_ERR));
        }
    }


    /**
     * Write contents of file.
     *
     * @param filename			The name of the file.
     * @param data				The contents of the file.
     * @param offset			The position to begin writing the file.
     * @param isBinary          True if the file contents are base64-encoded binary data
     * @throws FileNotFoundException, IOException
     * @throws NoModificationAllowedException
     */
    /**/
    public long write(String srcURLstr, String data, int offset, boolean isBinary) throws FileNotFoundException, IOException, NoModificationAllowedException {
        try {
        	LocalFilesystemURL inputURL = new LocalFilesystemURL(srcURLstr);
        	Filesystem fs = this.filesystemForURL(inputURL);
        	if (fs == null) {
        		throw new MalformedURLException("No installed handlers for this URL");
        	}
        
            long x = fs.writeToFileAtURL(inputURL, data, offset, isBinary); Log.d("TEST",srcURLstr + ": "+x); return x;
        } catch (IllegalArgumentException e) {
        	throw new MalformedURLException("Unrecognized filesystem URL");
        }
        
    }

    /**
     * Truncate the file to size
     *
     * @param filename
     * @param size
     * @throws FileNotFoundException, IOException
     * @throws NoModificationAllowedException
     */
    private long truncateFile(String srcURLstr, long size) throws FileNotFoundException, IOException, NoModificationAllowedException {
        try {
        	LocalFilesystemURL inputURL = new LocalFilesystemURL(srcURLstr);
        	Filesystem fs = this.filesystemForURL(inputURL);
        	if (fs == null) {
        		throw new MalformedURLException("No installed handlers for this URL");
        	}
        
            return fs.truncateFileAtURL(inputURL, size);
        } catch (IllegalArgumentException e) {
        	throw new MalformedURLException("Unrecognized filesystem URL");
        }
    }
}
