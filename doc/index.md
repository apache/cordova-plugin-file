<!---
 license: Licensed to the Apache Software Foundation (ASF) under one
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
-->

# org.apache.cordova.file

This plugin provides the [HTML5 Filesystem API](http://dev.w3.org/2009/dap/file-system/pub/FileSystem/). For usage, refer
to HTML5 Rocks' [FileSystem article](http://www.html5rocks.com/en/tutorials/file/filesystem/)
on the subject. For an overview of other storage options, refer to Cordova's
[storage guide](http://cordova.apache.org/docs/en/edge/cordova_storage_storage.md.html).

## Installation

    cordova plugin add org.apache.cordova.file

## Supported Platforms

- Amazon Fire OS
- Android
- BlackBerry 10*
- iOS
- Windows Phone 7 and 8*
- Windows 8*

\* _These platforms do not support `FileReader.readAsArrayBuffer` nor `FileWriter.write(blob)`._

## BlackBerry Quirks

`DirectoryEntry.removeRecursively()` may fail with a `ControlledAccessException` in the following cases:

- An app attempts to access a directory created by a previous installation of the app.

> Solution: ensure temporary directories are cleaned manually, or by the application prior to reinstallation.

- If the device is connected by USB.

> Solution: disconnect the USB cable from the device and run again.

## iOS Quirks
- `FileReader.readAsText(blob, encoding)`
  - The `encoding` parameter is not supported, and UTF-8 encoding is always in effect.

