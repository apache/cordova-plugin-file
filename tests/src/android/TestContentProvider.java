package org.apache.cordova.file.test;

import android.content.ContentProvider;
import android.net.Uri;
import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import android.content.ContentValues;
import android.database.Cursor;
import android.os.ParcelFileDescriptor;

import org.apache.cordova.CordovaResourceApi;

import java.io.IOException;
import java.util.HashMap;

public class TestContentProvider extends ContentProvider {

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        String fileName = uri.getQueryParameter("realPath");
        if (fileName == null) {
            fileName = uri.getPath();
        }
        if (fileName == null || fileName.length() < 1) {
            throw new FileNotFoundException();
        }
        CordovaResourceApi resourceApi = new CordovaResourceApi(getContext(), null);
        try {
            File f = File.createTempFile("test-content-provider", ".tmp");
            resourceApi.copyResource(Uri.parse("file:///android_asset" + fileName), Uri.fromFile(f));
            FileInputStream fis = new FileInputStream(f);
            String thisIsDumb = fis.getFD().toString();
            int fd = Integer.parseInt(thisIsDumb.substring("FileDescriptor[".length(), thisIsDumb.length() - 1));
            return ParcelFileDescriptor.adoptFd(fd);
        } catch (FileNotFoundException e) {
            throw e;
        } catch (IOException e) {
            e.printStackTrace();
            throw new FileNotFoundException("IO error: " + e.toString());
        }
    }

    @Override
    public boolean onCreate() {
        return false;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        throw new UnsupportedOperationException();
    }

    @Override
    public String getType(Uri uri) {
        return "text/html";
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException();
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException();
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException();
    }


}
