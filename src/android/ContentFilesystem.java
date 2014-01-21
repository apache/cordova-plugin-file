package org.apache.cordova.file;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.OutputStream;

import org.apache.cordova.CordovaInterface;
import org.apache.cordova.CordovaResourceApi;
import org.apache.cordova.CordovaWebView;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.provider.MediaStore;

public class ContentFilesystem extends Filesystem {

	private CordovaInterface cordova;
	private CordovaResourceApi resourceApi;
	
	public ContentFilesystem(String name, CordovaInterface cordova, CordovaWebView webView) {
		this.name = name;
		this.cordova = cordova;
		this.resourceApi = new CordovaResourceApi(webView.getContext(), webView.pluginManager);
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
    	  return makeEntryForPath(inputURL.fullPath, inputURL.filesystemName, fp.isDirectory());
      } catch (JSONException e) {
    	  throw new IOException();
      }
	}
	
    @Override
	public JSONObject getFileForLocalURL(LocalFilesystemURL inputURL,
			String fileName, JSONObject options, boolean directory) throws IOException, TypeMismatchException, JSONException {
        if (options != null) {
            if (options.optBoolean("create")) {
        		throw new IOException("Cannot create content url");
            }
        }
        LocalFilesystemURL requestedURL = new LocalFilesystemURL(Uri.withAppendedPath(inputURL.URL, fileName));
        File fp = new File(this.filesystemPathForURL(requestedURL));
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
        // Return the directory
        return makeEntryForPath(requestedURL.fullPath, requestedURL.filesystemName, directory);

	}

	@Override
	public boolean removeFileAtLocalURL(LocalFilesystemURL inputURL)
			throws NoModificationAllowedException {

		String filePath = filesystemPathForURL(inputURL);
		File file = new File(filePath);
		try {
			this.cordova.getActivity().getContentResolver().delete(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
					MediaStore.Images.Media.DATA + " = ?",
					new String[] { filePath });
		} catch (UnsupportedOperationException t) {
			// Was seeing this on the File mobile-spec tests on 4.0.3 x86 emulator.
			// The ContentResolver applies only when the file was registered in the
			// first case, which is generally only the case with images.
		}
		return file.delete();
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

	@Override
	public JSONObject getFileMetadataForLocalURL(LocalFilesystemURL inputURL) throws FileNotFoundException {
		String path = filesystemPathForURL(inputURL);
		if (path == null) {
			throw new FileNotFoundException();
		}	
		File file = new File(path);
        JSONObject metadata = new JSONObject();
        try {
        	metadata.put("size", file.length());
        	metadata.put("type", resourceApi.getMimeType(inputURL.URL));
        	metadata.put("name", file.getName());
        	metadata.put("fullPath", inputURL.fullPath);
        	metadata.put("lastModifiedDate", file.lastModified());
        } catch (JSONException e) {
        	return null;
        }
        return metadata;
	}

	@Override
	public JSONObject copyFileToURL(LocalFilesystemURL destURL, String newName,
			Filesystem srcFs, LocalFilesystemURL srcURL, boolean move)
                    throws IOException, InvalidModificationException, JSONException,
                    NoModificationAllowedException, FileExistsException {
        if (LocalFilesystem.class.isInstance(srcFs)) {
            /* Same FS, we can shortcut with CordovaResourceApi operations */
            // Figure out where we should be copying to
            final LocalFilesystemURL destinationURL = makeDestinationURL(newName, srcURL, destURL);

            OutputStream os = resourceApi.openOutputStream(destURL.URL);
            CordovaResourceApi.OpenForReadResult ofrr = resourceApi.openForRead(srcURL.URL);
            if (move && !srcFs.canRemoveFileAtLocalURL(srcURL)) {
                throw new NoModificationAllowedException("Cannot move file at source URL");
            }
            try {
                resourceApi.copyResource(ofrr, os);
            } catch (IOException e) {
                throw new IOException("Cannot read file at source URL");
            }
            if (move) {
                srcFs.removeFileAtLocalURL(srcURL);
            }
            return makeEntryForURL(destinationURL, false);
        } else {
            // Need to copy the hard way
            return super.copyFileToURL(destURL, newName, srcFs, srcURL, move);
		}
	}

    
	@Override
    public void readFileAtURL(LocalFilesystemURL inputURL, long start, long end,
			ReadFileCallback readFileCallback) throws IOException {
		CordovaResourceApi.OpenForReadResult ofrr = resourceApi.openForRead(inputURL.URL);
        if (end < 0) {
            end = ofrr.length;
        }
        long numBytesToRead = end - start;
		try {
			if (start > 0) {
                ofrr.inputStream.skip(start);
			}
            LimitedInputStream inputStream = new LimitedInputStream(ofrr.inputStream, numBytesToRead);
            readFileCallback.handleData(inputStream, ofrr.mimeType);
		} finally {
            ofrr.inputStream.close();
		}
	}

	@Override
	public long writeToFileAtURL(LocalFilesystemURL inputURL, String data,
			int offset, boolean isBinary) throws NoModificationAllowedException {
        throw new NoModificationAllowedException("Couldn't write to file given its content URI");
    }
	@Override
	public long truncateFileAtURL(LocalFilesystemURL inputURL, long size)
			throws NoModificationAllowedException {
        throw new NoModificationAllowedException("Couldn't truncate file given its content URI");
	}

    @Override
    public String filesystemPathForURL(LocalFilesystemURL url) {
        final String[] LOCAL_FILE_PROJECTION = { MediaStore.Images.Media.DATA };

        ContentResolver contentResolver = this.cordova.getActivity().getContentResolver();
        Cursor cursor = contentResolver.query(url.URL, LOCAL_FILE_PROJECTION, null, null, null);
        if (cursor != null) {
            try {
                int columnIndex = cursor.getColumnIndex(LOCAL_FILE_PROJECTION[0]);
                if (columnIndex != -1 && cursor.getCount() > 0) {
                    cursor.moveToFirst();
                    String path = cursor.getString(columnIndex);
                    return path;
                }
            } finally {
                cursor.close();
            }
        }
        return null;
    }

	@Override
	public LocalFilesystemURL URLforFilesystemPath(String path) {
		// Returns null as we don't support reverse mapping back to content:// URLs
		return null;
	}

	@Override
	public boolean canRemoveFileAtLocalURL(LocalFilesystemURL inputURL) {
		String path = filesystemPathForURL(inputURL);
		File file = new File(path);
		return file.exists();
	}

	@Override
	OutputStream getOutputStreamForURL(LocalFilesystemURL inputURL)
			throws IOException {
		OutputStream os = resourceApi.openOutputStream(inputURL.URL);
		return os;
    }
}