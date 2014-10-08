package org.apache.cordova.file;
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

import android.content.res.AssetManager;
import org.apache.cordova.CordovaInterface;

import java.io.*;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

public class FileProxy extends File{

    private String path;
    private String assetsPath = "";
    private static final Random tempFileRandom = new Random();
    private Boolean inApplicationFolder = false;
    private CordovaInterface cordova;
    private AssetManager assetManager;
    public FileProxy(File dir, String name, CordovaInterface cordova) {
        super(dir, name);
        this.path = super.getPath();
        this.cordova = cordova;
        if (this.path.startsWith("/android_asset")) {
            inApplicationFolder = true;
            if (this.path.length() > 14)
                assetsPath = this.path.substring(15);
            assetManager = cordova.getActivity().getAssets();
        }
    }

    public FileProxy(String path, CordovaInterface cordova) {
        super(path);
        this.path = super.getPath();
        this.cordova = cordova;
        if (this.path.startsWith("/android_asset")) {
            inApplicationFolder = true;
            if (this.path.length() > 14)
                assetsPath = this.path.substring(15);
            assetManager = cordova.getActivity().getAssets();
        }
    }

    public FileProxy(String dirPath, String name, CordovaInterface cordova) {
        super(dirPath, name);
        this.path = super.getPath();
        this.cordova = cordova;
        if (this.path.startsWith("/android_asset")) {
            inApplicationFolder = true;
            if (this.path.length() > 14)
                assetsPath = this.path.substring(15);
            assetManager = cordova.getActivity().getAssets();
        }
    }

    public FileProxy(URI uri, CordovaInterface cordova) {
        super(uri);
        this.path = super.getPath();
        this.cordova = cordova;
        if (this.path.startsWith("/android_asset")) {
            inApplicationFolder = true;
            if (this.path.length() > 14)
                assetsPath = this.path.substring(15);
            assetManager = cordova.getActivity().getAssets();
        }
    }

    public boolean isInAssets(){
        return this.inApplicationFolder;
    }

    public String getAssetsPath(){
        return this.assetsPath;
    }

    @Override
    public boolean canExecute() {
        if (inApplicationFolder) {
            return  false;
        }
        else
            return super.canExecute();
    }

    @Override
    public boolean canRead() {
        if (this.inApplicationFolder)
            return this.exists();
        else
            return super.canRead();
    }

    public boolean canWrite() {
        return !this.inApplicationFolder && super.canWrite();
    }

    @Override
    public boolean delete() {
        return !this.inApplicationFolder && super.delete();
    }

    @Override
    public boolean equals(Object obj) {
        if (!((obj instanceof File)||(obj instanceof FileProxy))) {
            return false;
        }
        return path.equals(((File) obj).getPath());
    }

    @Override
    public boolean exists() {
        if (this.inApplicationFolder){
            return this.isFile() || this.isDirectory();
        } else
            return super.exists();
    }

    @Override
    public String getAbsolutePath() {
        if (this.inApplicationFolder)
            return "file:///" + this.path;
        else {
            if (isAbsolute()) {
                return path;
            }
            String userDir = System.getProperty("user.dir");
            return path.isEmpty() ? userDir : join(userDir, path);
        }
    }

    @Override
    public FileProxy getAbsoluteFile() {
        return new FileProxy(getAbsolutePath(), cordova);
    }

    private static String join(String prefix, String suffix) {
        int prefixLength = prefix.length();
        boolean haveSlash = (prefixLength > 0 && prefix.charAt(prefixLength - 1) == separatorChar);
        if (!haveSlash) {
            haveSlash = (suffix.length() > 0 && suffix.charAt(0) == separatorChar);
        }
        return haveSlash ? (prefix + suffix) : (prefix + separatorChar + suffix);
    }

    @Override
    public FileProxy getCanonicalFile() throws IOException {
        return new FileProxy(getCanonicalPath(), cordova);
    }

    @Override
    public FileProxy getParentFile() {
        String tempParent = getParent();
        if (tempParent == null) {
            return null;
        }
        return new FileProxy(tempParent, cordova);
    }

    @Override
    public boolean isDirectory() {
        if (this.inApplicationFolder){
            if (this.getPath().equals("/android_asset")) //return true if it is root
                return true;

            if (this.isFile()) //return false if it is file
                return false;

            FileProxy parentCatalog = this.getParentFile();
            return Arrays.asList(parentCatalog.list()).contains(this.getName());
        } else
            return super.isDirectory();
    }

    @Override
    public boolean isFile() {
        if (this.inApplicationFolder) {
            try {
                InputStream input = assetManager.open(this.assetsPath);
                input.close();
                return  true;
            } catch (IOException e) {
                e.printStackTrace();
                return false;
            }
        } else
            return super.isFile();
    }


    @Override
    public long length() {
        if (this.inApplicationFolder){
            try {
                InputStream input = assetManager.open(this.assetsPath);
                //crazy code
                byte[] buffer = new byte[1024];
                int bytesRead =0;
                int allBytes = 0;
                while((bytesRead = input.read(buffer))!=-1){
                    allBytes+=bytesRead;
                }
                return allBytes;
            } catch (IOException e){
               return  0;
            }
        } else
            return super.length();
    }

    //TODO там приватный метод вызывается
    @Override
    public String[] list() {
        if (this.inApplicationFolder){
            try {
                return assetManager.list(this.assetsPath);
            } catch (IOException e) {
                return null;
            }
        } else
            return super.list();
    }

    @Override
    public FileProxy[] listFiles() {
        return filenamesToFiles(list());
    }

    @Override
    public FileProxy[] listFiles(FilenameFilter filter) {
        return filenamesToFiles(list(filter));
    }

    @Override
    public FileProxy[] listFiles(FileFilter filter) {
        FileProxy[] files = listFiles();
        if (filter == null || files == null) {
            return files;
        }
        List<FileProxy> result = new ArrayList<FileProxy>(files.length);
        for (FileProxy file : files) {
            if (filter.accept(file)) {
                result.add(file);
            }
        }
        return result.toArray(new FileProxy[result.size()]);
    }

    private FileProxy[] filenamesToFiles(String[] filenames) {
        if (filenames == null) {
            return null;
        }
        int count = filenames.length;
        FileProxy[] result = new FileProxy[count];
        for (int i = 0; i < count; ++i) {
            result[i] = new FileProxy(this, filenames[i], cordova);
        }
        return result;
    }

}
