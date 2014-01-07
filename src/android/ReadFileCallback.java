package org.apache.cordova.file;

import java.io.IOException;

public interface ReadFileCallback {
	public void handleData(byte[] data, String contentType) throws IOException;
}
