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

import java.util.List;

import android.net.Uri;

public class LocalFilesystemURL {
	
	public static final String FILESYSTEM_PROTOCOL = "cdvfile";

    public final Uri uri;
    public final String fsName;
    public final String pathAndQuery;

	private LocalFilesystemURL(Uri uri, String fsName, String fsPath) {
		this.uri = uri;
        this.fsName = fsName;
        this.pathAndQuery = fsPath;
	}

    public static LocalFilesystemURL parse(Uri uri) {
        if (!FILESYSTEM_PROTOCOL.equals(uri.getScheme())) {
            return null;
        }
        List<String> pathComponents = uri.getPathSegments();
        if (pathComponents == null || pathComponents.size() == 0) {
            return null;
        }
        String fsName = pathComponents.get(0);
        String pathAndQuery = uri.getPath();
        pathAndQuery = pathAndQuery.substring(pathAndQuery.indexOf('/', 1));
        if (uri.getQuery() != null) {
            pathAndQuery = pathAndQuery + "?" + uri.getQuery();
        }
        return new LocalFilesystemURL(uri, fsName, pathAndQuery);
    }

    public static LocalFilesystemURL parse(String uri) {
        return parse(Uri.parse(uri));
    }

    public String toString() {
        return uri.toString();
    }
}
