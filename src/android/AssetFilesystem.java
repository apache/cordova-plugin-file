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

import android.content.res.AssetManager;
import android.net.Uri;

import org.apache.cordova.CordovaResourceApi;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;

public class AssetFilesystem extends Filesystem {

    private final AssetManager assetManager;

    public AssetFilesystem(AssetManager assetManager, CordovaResourceApi resourceApi) {
        super(Uri.parse("file:///android_asset/"), "assets", resourceApi);
        this.assetManager = assetManager;
	}

    @Override
    public Uri toNativeUri(LocalFilesystemURL inputURL) {
        return nativeUriForFullPath(inputURL.path);
    }

    @Override
    public LocalFilesystemURL toLocalUri(Uri inputURL) {
        if (!"file".equals(inputURL.getScheme())) {
            return null;
        }
        File f = new File(inputURL.getPath());
        // Removes and duplicate /s (e.g. file:///a//b/c)
        Uri resolvedUri = Uri.fromFile(f);
        String rootUriNoTrailingSlash = rootUri.getEncodedPath();
        rootUriNoTrailingSlash = rootUriNoTrailingSlash.substring(0, rootUriNoTrailingSlash.length() - 1);
        if (!resolvedUri.getEncodedPath().startsWith(rootUriNoTrailingSlash)) {
            return null;
        }
        String subPath = resolvedUri.getEncodedPath().substring(rootUriNoTrailingSlash.length());
        // Strip leading slash
        if (!subPath.isEmpty()) {
            subPath = subPath.substring(1);
        }
        Uri.Builder b = new Uri.Builder()
            .scheme(LocalFilesystemURL.FILESYSTEM_PROTOCOL)
            .authority("localhost")
            .path(name);
        if (!subPath.isEmpty()) {
            b.appendEncodedPath(subPath);
        }
        if (isDirectory(subPath) || inputURL.getPath().endsWith("/")) {
            // Add trailing / for directories.
            b.appendEncodedPath("");
        }
        return LocalFilesystemURL.parse(b.build());
    }

    private Boolean isDirectory(String assetPath) {
        if (assetPath.startsWith("/")) {
            assetPath = assetPath.substring(1);
        }
        try {
            return assetManager.list(assetPath).length != 0;
        } catch (IOException e) {
        }
        return false;
    }

    private LocalFilesystemURL URLforFullPath(String fullPath) {
        Uri nativeUri = nativeUriForFullPath(fullPath);
        if (nativeUri != null) {
            return toLocalUri(nativeUri);
        }
        return null;
    }


    @Override
    public LocalFilesystemURL[] listChildren(LocalFilesystemURL inputURL) throws FileNotFoundException {
        String pathNoSlashes = inputURL.path.substring(1);
        if (pathNoSlashes.endsWith("/")) {
            pathNoSlashes = pathNoSlashes.substring(0, pathNoSlashes.length() - 1);
        }

        String[] files;
        try {
            files = assetManager.list(pathNoSlashes);
        } catch (IOException e) {
            throw new FileNotFoundException();
        }

        LocalFilesystemURL[] entries = new LocalFilesystemURL[files.length];
        for (int i = 0; i < files.length; ++i) {
            entries[i] = URLforFullPath(new File(inputURL.path, files[i]).getPath());
        }
        return entries;
	}

    @Override
    public JSONObject getFileForLocalURL(LocalFilesystemURL inputURL,
                                         String path, JSONObject options, boolean directory)
            throws FileExistsException, IOException, TypeMismatchException, EncodingException, JSONException {
        if (options != null && options.optBoolean("create")) {
            throw new UnsupportedOperationException("Assets are read-only");
        }

        // Check whether the supplied path is absolute or relative
        if (directory && !path.endsWith("/")) {
            path += "/";
        }

        LocalFilesystemURL requestedURL;
        if (path.startsWith("/")) {
            requestedURL = URLforFullPath(normalizePath(path));
        } else {
            requestedURL = URLforFullPath(normalizePath(inputURL.path + "/" + path));
        }

        // Throws a FileNotFoundException if it doesn't exist.
        getFileMetadataForLocalURL(requestedURL);

        boolean isDir = isDirectory(requestedURL.path);
        if (directory && !isDir) {
            throw new TypeMismatchException("path doesn't exist or is file");
        } else if (!directory && isDir) {
            throw new TypeMismatchException("path doesn't exist or is directory");
        }

        // Return the directory
        return makeEntryForURL(requestedURL);
    }


    @Override
	public JSONObject getFileMetadataForLocalURL(LocalFilesystemURL inputURL) throws FileNotFoundException {
        CordovaResourceApi.OpenForReadResult offr;
        try {
            offr = inputURL.isDirectory ? null : resourceApi.openForRead(toNativeUri(inputURL));
        } catch (IOException e) {
            throw new FileNotFoundException("File not found: " + inputURL);
        }
        JSONObject metadata = new JSONObject();
        try {
        	metadata.put("size", inputURL.isDirectory ? 0 : offr.length);
        	metadata.put("type", inputURL.isDirectory ? "text/directory" : offr.mimeType);
        	metadata.put("name", new File(inputURL.path).getName());
        	metadata.put("fullPath", inputURL.path);
        	metadata.put("lastModifiedDate", 0);
        } catch (JSONException e) {
            return null;
        } finally {
            if (offr != null) {
                try {
                    offr.inputStream.close();
                } catch (IOException e) {
                }
            }
        }
        return metadata;
	}

	@Override
	public boolean canRemoveFileAtLocalURL(LocalFilesystemURL inputURL) {
		return false;
	}

    @Override
    long writeToFileAtURL(LocalFilesystemURL inputURL, String data, int offset, boolean isBinary) throws NoModificationAllowedException, IOException {
        throw new NoModificationAllowedException("Assets are read-only");
    }

    @Override
    long truncateFileAtURL(LocalFilesystemURL inputURL, long size) throws IOException, NoModificationAllowedException {
        throw new NoModificationAllowedException("Assets are read-only");
    }

    @Override
    String filesystemPathForURL(LocalFilesystemURL url) {
        return null;
    }

    @Override
    LocalFilesystemURL URLforFilesystemPath(String path) {
        return null;
    }

    @Override
    boolean removeFileAtLocalURL(LocalFilesystemURL inputURL) throws InvalidModificationException, NoModificationAllowedException {
        throw new NoModificationAllowedException("Assets are read-only");
    }

    @Override
    boolean recursiveRemoveFileAtLocalURL(LocalFilesystemURL inputURL) throws FileExistsException, NoModificationAllowedException {
        throw new NoModificationAllowedException("Assets are read-only");
    }

}
