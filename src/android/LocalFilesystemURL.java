package org.apache.cordova.file;

import android.net.Uri;

public class LocalFilesystemURL {
	public static final int TEMPORARY = 0;
	public static final int PERSISTENT = 1;

	Uri URL;
	int filesystemType;
	String fullPath;

	public LocalFilesystemURL(Uri URL) {
		this.URL = URL;
		this.filesystemType = this.filesystemTypeForLocalURL(URL);
		this.fullPath = this.fullPathForLocalURL(URL);
	}
	
	private String fullPathForLocalURL(Uri URL) {
		int fsType = this.filesystemTypeForLocalURL(URL);
		if (fsType == FileUtils.TEMPORARY) {
			return URL.getPath().substring(10);
		}
		if (fsType == FileUtils.PERSISTENT) {
			return URL.getPath().substring(11);
		}
		if (fsType == FileUtils.CONTENT) {
			return '/' + URL.getHost() + URL.getPath();
		}
		return null;
	}

	private int filesystemTypeForLocalURL(Uri URL) {
		if ("filesystem".equals(URL.getScheme()) && "localhost".equals(URL.getHost())) {
			String path = URL.getPath();
			if (path != null) {
				if (path.startsWith("/temporary")) {
					return FileUtils.TEMPORARY;
				} else if (path.startsWith("/persistent")) {
					return FileUtils.PERSISTENT;
				}
			}
		} else if ("content".equals(URL.getScheme())) {
			return FileUtils.CONTENT;
		}
		return -1;
	}

	public LocalFilesystemURL(String strURL) {
		this(Uri.parse(strURL));
	}
	
}
