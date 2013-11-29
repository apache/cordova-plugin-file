package org.apache.cordova.file;

public interface ReadFileCallback {
	public void handleData(byte[] data, String contentType);
}
