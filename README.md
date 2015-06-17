<!--
# license: Licensed to the Apache Software Foundation (ASF) under one
#         or more contributor license agreements.  See the NOTICE file
#         distributed with this work for additional information
#         regarding copyright ownership.  The ASF licenses this file
#         to you under the Apache License, Version 2.0 (the
#         "License"); you may not use this file except in compliance
#         with the License.  You may obtain a copy of the License at
#
#           http://www.apache.org/licenses/LICENSE-2.0
#
#         Unless required by applicable law or agreed to in writing,
#         software distributed under the License is distributed on an
#         "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#         KIND, either express or implied.  See the License for the
#         specific language governing permissions and limitations
#         under the License.
-->

# cordova-plugin-file

[![Build Status](https://travis-ci.org/apache/cordova-plugin-file.svg)](https://travis-ci.org/apache/cordova-plugin-file)

This plugin implements a File API allowing read/write access to files residing on the device.

This plugin is based on several specs, including : 
The HTML5 File API
[http://www.w3.org/TR/FileAPI/](http://www.w3.org/TR/FileAPI/)

The (now-defunct) Directories and System extensions
Latest: 
[http://www.w3.org/TR/2012/WD-file-system-api-20120417/](http://www.w3.org/TR/2012/WD-file-system-api-20120417/)
Although most of the plugin code was written when an earlier spec was current:
[http://www.w3.org/TR/2011/WD-file-system-api-20110419/](http://www.w3.org/TR/2011/WD-file-system-api-20110419/)

It also implements the FileWriter spec :
[http://dev.w3.org/2009/dap/file-system/file-writer.html](http://dev.w3.org/2009/dap/file-system/file-writer.html)

For usage, please refer to HTML5 Rocks' excellent [FileSystem article.](http://www.html5rocks.com/en/tutorials/file/filesystem/)

For an overview of other storage options, refer to Cordova's
[storage guide](http://cordova.apache.org/docs/en/edge/cordova_storage_storage.md.html).

This plugin defines global `cordova.file` object.

Although in the global scope, it is not available until after the `deviceready` event.

    document.addEventListener("deviceready", onDeviceReady, false);
    function onDeviceReady() {
        console.log(cordova.file);
    }

## Installation

    cordova plugin add cordova-plugin-file

## Supported Platforms

- Amazon Fire OS
- Android
- BlackBerry 10
- Firefox OS
- iOS
- Windows Phone 7 and 8*
- Windows 8*
- Windows*
- Browser

\* _These platforms do not support `FileReader.readAsArrayBuffer` nor `FileWriter.write(blob)`._

## Where to Store Files

As of v1.2.0, URLs to important file-system directories are provided.
Each URL is in the form _file:///path/to/spot/_, and can be converted to a
`DirectoryEntry` using `window.resolveLocalFileSystemURL()`.

* `cordova.file.applicationDirectory` - Read-only directory where the application 
  is installed. (_iOS_, _Android_, _BlackBerry 10_)

* `cordova.file.applicationStorageDirectory` - Root directory of the application's 
  sandbox; on iOS this location is read-only (but specific subdirectories [like 
  `/Documents`] are read-write). All data contained within is private to the app. (
  _iOS_, _Android_, _BlackBerry 10_)

* `cordova.file.dataDirectory` - Persistent and private data storage within the 
  application's sandbox using internal memory (on Android, if you need to use 
  external memory, use `.externalDataDirectory`). On iOS, this directory is not 
  synced with iCloud (use `.syncedDataDirectory`). (_iOS_, _Android_, _BlackBerry 10_)

* `cordova.file.cacheDirectory` -  Directory for cached data files or any files 
  that your app can re-create easily. The OS may delete these files when the device 
  runs low on storage, nevertheless, apps should not rely on the OS to delete files 
  in here. (_iOS_, _Android_, _BlackBerry 10_)

* `cordova.file.externalApplicationStorageDirectory` - Application space on 
  external storage. (_Android_)

* `cordova.file.externalDataDirectory` - Where to put app-specific data files on 
  external storage. (_Android_)

* `cordova.file.externalCacheDirectory` - Application cache on external storage. 
  (_Android_)

* `cordova.file.externalRootDirectory` - External storage (SD card) root. (_Android_, _BlackBerry 10_)

* `cordova.file.tempDirectory` - Temp directory that the OS can clear at will. Do not 
  rely on the OS to clear this directory; your app should always remove files as 
  applicable. (_iOS_)

* `cordova.file.syncedDataDirectory` - Holds app-specific files that should be synced 
  (e.g. to iCloud). (_iOS_)

* `cordova.file.documentsDirectory` - Files private to the app, but that are meaningful 
  to other application (e.g. Office files). (_iOS_)

* `cordova.file.sharedDirectory` - Files globally available to all applications (_BlackBerry 10_)

## File System Layouts

Although technically an implementation detail, it can be very useful to know how 
the `cordova.file.*` properties map to physical paths on a real device.

### iOS File System Layout

| Device Path                                    | `cordova.file.*`            | `iosExtraFileSystems` | r/w? | persistent? | OS clears | sync | private |
|:-----------------------------------------------|:----------------------------|:----------------------|:----:|:-----------:|:---------:|:----:|:-------:|
| `/var/mobile/Applications/<UUID>/`             | applicationStorageDirectory | -                     | r    |     N/A     |     N/A   | N/A  |   Yes   |
| &nbsp;&nbsp;&nbsp;`appname.app/`               | applicationDirectory        | bundle                | r    |     N/A     |     N/A   | N/A  |   Yes   |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`www/`     | -                           | -                     | r    |     N/A     |     N/A   | N/A  |   Yes   |
| &nbsp;&nbsp;&nbsp;`Documents/`                 | documentsDirectory          | documents             | r/w  |     Yes     |     No    | Yes  |   Yes   |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`NoCloud/` | -                           | documents-nosync      | r/w  |     Yes     |     No    | No   |   Yes   |
| &nbsp;&nbsp;&nbsp;`Library`                    | -                           | library               | r/w  |     Yes     |     No    | Yes? |   Yes   |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`NoCloud/` | dataDirectory               | library-nosync        | r/w  |     Yes     |     No    | No   |   Yes   |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Cloud/`   | syncedDataDirectory         | -                     | r/w  |     Yes     |     No    | Yes  |   Yes   |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Caches/`  | cacheDirectory              | cache                 | r/w  |     Yes*    |  Yes\*\*\*| No   |   Yes   |
| &nbsp;&nbsp;&nbsp;`tmp/`                       | tempDirectory               | -                     | r/w  |     No\*\*  |  Yes\*\*\*| No   |   Yes   |


  \* Files persist across app restarts and upgrades, but this directory can 
     be cleared whenever the OS desires. Your app should be able to recreate any 
     content that might be deleted.

\*\* Files may persist across app restarts, but do not rely on this behavior. Files 
     are not guaranteed to persist across updates. Your app should remove files from 
     this directory when it is applicable, as the OS does not guarantee when (or even 
     if) these files are removed.

\*\*\* The OS may clear the contents of this directory whenever it feels it is 
     necessary, but do not rely on this. You should clear this directory as 
     appropriate for your application.

### Android File System Layout

| Device Path                                     | `cordova.file.*`            | `AndroidExtraFileSystems` | r/w? | persistent? | OS clears | private |
|:------------------------------------------------|:----------------------------|:--------------------------|:----:|:-----------:|:---------:|:-------:|
| `file:///android_asset/`                        | applicationDirectory        |                           | r    |     N/A     |     N/A   |   Yes   |
| `/data/data/<app-id>/`                          | applicationStorageDirectory | -                         | r/w  |     N/A     |     N/A   |   Yes   |
| &nbsp;&nbsp;&nbsp;`cache`                       | cacheDirectory              | cache                     | r/w  |     Yes     |     Yes\* |   Yes   |
| &nbsp;&nbsp;&nbsp;`files`                       | dataDirectory               | files                     | r/w  |     Yes     |     No    |   Yes   |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`Documents` |                             | documents                 | r/w  |     Yes     |     No    |   Yes   |
| `<sdcard>/`                                     | externalRootDirectory       | sdcard                    | r/w  |     Yes     |     No    |   No    |
| &nbsp;&nbsp;&nbsp;`Android/data/<app-id>/`      | externalApplicationStorageDirectory | -                 | r/w  |     Yes     |     No    |   No    |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`cache`     | externalCacheDirectry       | cache-external            | r/w  |     Yes     |     No\*\*|   No    |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`files`     | externalDataDirectory       | files-external            | r/w  |     Yes     |     No    |   No    |

\* The OS may periodically clear this directory, but do not rely on this behavior. Clear 
   the contents of this directory as appropriate for your application. Should a user 
   purge the cache manually, the contents of this directory are removed.

\*\* The OS does not clear this directory automatically; you are responsible for managing 
     the contents yourself. Should the user purge the cache manually, the contents of the 
     directory are removed.

**Note**: If external storage can't be mounted, the `cordova.file.external*` 
properties are `null`.

### BlackBerry 10 File System Layout

| Device Path                                                  | `cordova.file.*`            | r/w? | persistent? | OS clears | private |
|:-------------------------------------------------------------|:----------------------------|:----:|:-----------:|:---------:|:-------:|
| `file:///accounts/1000/appdata/<app id>/`                    | applicationStorageDirectory | r    |     N/A     |     N/A   |   Yes   |
| &nbsp;&nbsp;&nbsp;`app/native`                               | applicationDirectory        | r    |     N/A     |     N/A   |   Yes   |
| &nbsp;&nbsp;&nbsp;`data/webviews/webfs/temporary/local__0`   | cacheDirectory              | r/w  |     No      |     Yes   |   Yes   |
| &nbsp;&nbsp;&nbsp;`data/webviews/webfs/persistent/local__0`  | dataDirectory               | r/w  |     Yes     |     No    |   Yes   |
| `file:///accounts/1000/removable/sdcard`                     | externalRemovableDirectory  | r/w  |     Yes     |     No    |   No    |
| `file:///accounts/1000/shared`                               | sharedDirectory             | r/w  |     Yes     |     No    |   No    |

*Note*: When application is deployed to work perimeter, all paths are relative to /accounts/1000-enterprise.

## Android Quirks

### Android Persistent storage location

There are multiple valid locations to store persistent files on an Android
device. See [this page](http://developer.android.com/guide/topics/data/data-storage.html)
for an extensive discussion of the various possibilities.

Previous versions of the plugin would choose the location of the temporary and
persistent files on startup, based on whether the device claimed that the SD
Card (or equivalent storage partition) was mounted. If the SD Card was mounted,
or if a large internal storage partition was available (such as on Nexus
devices,) then the persistent files would be stored in the root of that space.
This meant that all Cordova apps could see all of the files available on the
card.

If the SD card was not available, then previous versions would store data under
`/data/data/<packageId>`, which isolates apps from each other, but may still
cause data to be shared between users.

It is now possible to choose whether to store files in the internal file
storage location, or using the previous logic, with a preference in your
application's `config.xml` file. To do this, add one of these two lines to
`config.xml`:

    <preference name="AndroidPersistentFileLocation" value="Internal" />

    <preference name="AndroidPersistentFileLocation" value="Compatibility" />

Without this line, the File plugin will use `Compatibility` as the default. If
a preference tag is present, and is not one of these values, the application
will not start.

If your application has previously been shipped to users, using an older (pre-
1.0) version of this plugin, and has stored files in the persistent filesystem,
then you should set the preference to `Compatibility`. Switching the location to
"Internal" would mean that existing users who upgrade their application may be
unable to access their previously-stored files, depending on their device.

If your application is new, or has never previously stored files in the
persistent filesystem, then the `Internal` setting is generally recommended.

### Slow recursive operations for /android_asset

Listing asset directories is really slow on Android. You can speed it up though, by
adding `src/android/build-extras.gradle` to the root of your android project (also
requires cordova-android@4.0.0 or greater).

## iOS Quirks

- `cordova.file.applicationStorageDirectory` is read-only; attempting to store 
  files within the root directory will fail. Use one of the other `cordova.file.*`
  properties defined for iOS (only `applicationDirectory` and `applicationStorageDirectory` are
  read-only).
- `FileReader.readAsText(blob, encoding)`
  - The `encoding` parameter is not supported, and UTF-8 encoding is always in effect.

### iOS Persistent storage location

There are two valid locations to store persistent files on an iOS device: the
Documents directory and the Library directory. Previous versions of the plugin
only ever stored persistent files in the Documents directory. This had the
side-effect of making all of an application's files visible in iTunes, which
was often unintended, especially for applications which handle lots of small
files, rather than producing complete documents for export, which is the
intended purpose of the directory.

It is now possible to choose whether to store files in the documents or library
directory, with a preference in your application's `config.xml` file. To do this,
add one of these two lines to `config.xml`:

    <preference name="iosPersistentFileLocation" value="Library" />

    <preference name="iosPersistentFileLocation" value="Compatibility" />

Without this line, the File plugin will use `Compatibility` as the default. If
a preference tag is present, and is not one of these values, the application
will not start.

If your application has previously been shipped to users, using an older (pre-
1.0) version of this plugin, and has stored files in the persistent filesystem,
then you should set the preference to `Compatibility`. Switching the location to
`Library` would mean that existing users who upgrade their application would be
unable to access their previously-stored files.

If your application is new, or has never previously stored files in the
persistent filesystem, then the `Library` setting is generally recommended.

## Firefox OS Quirks

The File System API is not natively supported by Firefox OS and is implemented
as a shim on top of indexedDB. 
 
* Does not fail when removing non-empty directories
* Does not support metadata for directories
* Methods `copyTo` and `moveTo` do not support directories

The following data paths are supported:
* `applicationDirectory` - Uses `xhr` to get local files that are packaged with the app.
* `dataDirectory` - For persistent app-specific data files.
* `cacheDirectory` - Cached files that should survive app restarts (Apps should not rely
on the OS to delete files in here).

## Browser Quirks

### Common quirks and remarks
- Each browser uses its own sandboxed filesystem. IE and Firefox use IndexedDB as a base.
All browsers use forward slash as directory separator in a path.
- Directory entries have to be created successively. 
For example, the call `fs.root.getDirectory('dir1/dir2', {create:true}, successCallback, errorCallback)` 
will fail if dir1 did not exist.
- The plugin requests user permission to use persistent storage at the application first start. 
- Plugin supports `cdvfile://localhost` (local resources) only. I.e. external resources are not supported via `cdvfile`.
- The plugin does not follow ["File System API 8.3 Naming restrictions"](http://www.w3.org/TR/2011/WD-file-system-api-20110419/#naming-restrictions).
- Blob and File' `close` function is not supported.
- `FileSaver` and `BlobBuilder` are not supported by this plugin and don't have stubs.
- The plugin does not support `requestAllFileSystems`. This function is also missing in the specifications.
- Entries in directory will not be removed if you use `create: true` flag for existing directory.
- Files created via constructor are not supported. You should use entry.file method instead.
- Each browser uses its own form for blob URL references.
- `readAsDataURL` function is supported, but the mediatype in Chrome depends on entry name extension, 
mediatype in IE is always empty (which is the same as `text-plain` according the specification), 
the mediatype in Firefox is always `application/octet-stream`. 
For example, if the content is `abcdefg` then Firefox returns `data:application/octet-stream;base64,YWJjZGVmZw==`,
IE returns `data:;base64,YWJjZGVmZw==`, Chrome returns `data:<mediatype depending on extension of entry name>;base64,YWJjZGVmZw==`.
- `toInternalURL` returns the path in the form `file:///persistent/path/to/entry` (Firefox, IE). 
Chrome returns the path in the form `cdvfile://localhost/persistent/file`.

### Chrome quirks
- Chrome filesystem is not immediately ready after device ready event. As a workaround you can subscribe to `filePluginIsReady` event.
Example: 
```javascript
window.addEventListener('filePluginIsReady', function(){ console.log('File plugin is ready');}, false);
```
You can use `window.isFilePluginReadyRaised` function to check whether event was already raised.
- window.requestFileSystem TEMPORARY and PERSISTENT filesystem quotas are not limited in Chrome.
- To increase persistent storage in Chrome you need to call `window.initPersistentFileSystem` method. Persistent storage quota is 5 MB by default.
- Chrome requires `--allow-file-access-from-files` run argument to support API via `file:///` protocol.
- `File` object will be not changed if you use flag `{create:true}` when getting an existing `Entry`.
- events `cancelable` property is set to true in Chrome. This is contrary to the [specification](http://dev.w3.org/2009/dap/file-system/file-writer.html).
- `toURL` function in Chrome returns `filesystem:`-prefixed path depending on application host. 
For example, `filesystem:file:///persistent/somefile.txt`, `filesystem:http://localhost:8080/persistent/somefile.txt`.
- `toURL` function result does not contain trailing slash in case of directory entry. 
Chrome resolves directories with slash-trailed urls correctly though.
- `resolveLocalFileSystemURL` method requires the inbound `url` to have `filesystem` prefix. For example, `url` parameter for `resolveLocalFileSystemURL`
should be in the form `filesystem:file:///persistent/somefile.txt` as opposed to the form `file:///persistent/somefile.txt` in Android.
- Deprecated `toNativeURL` function is not supported and does not have a stub.
- `setMetadata` function is not stated in the specifications and not supported.
- INVALID_MODIFICATION_ERR (code: 9) is thrown instead of SYNTAX_ERR(code: 8) on requesting of a non-existant filesystem.
- INVALID_MODIFICATION_ERR (code: 9) is thrown instead of PATH_EXISTS_ERR(code: 12) on trying to exclusively create a file or directory, which already exists.
- INVALID_MODIFICATION_ERR (code: 9) is thrown instead of  NO_MODIFICATION_ALLOWED_ERR(code: 6) on trying to call removeRecursively on the root file system.
- INVALID_MODIFICATION_ERR (code: 9) is thrown instead of NOT_FOUND_ERR(code: 1) on trying to moveTo directory that does not exist.

### IndexedDB-based impl quirks (Firefox and IE)
- `.` and `..` are not supported.
- IE does not support `file:///`-mode; only hosted mode is supported (http://localhost:xxxx).
- Firefox filesystem size is not limited but each 50MB extension will request a user permission.
IE10 allows up to 10mb of combined AppCache and IndexedDB used in implementation of filesystem without prompting, 
once you hit that level you will be asked if you want to allow it to be increased up to a max of 250mb per site.
So `size` parameter for `requestFileSystem` function does not affect filesystem in Firefox and IE.
- `readAsBinaryString` function is not stated in the Specs and not supported in IE and does not have a stub.
- `file.type` is always null.
- You should not create entry using DirectoryEntry instance callback result which was deleted. 
Otherwise, you will get a 'hanging entry'.
- Before you can read a file, which was just written you need to get a new instance of this file.
- `setMetadata` function, which is not stated in the Specs supports `modificationTime` field change only. 
- `copyTo` and `moveTo` functions do not support directories.
- Directories metadata is not supported.
- Both Entry.remove and directoryEntry.removeRecursively don't fail when removing 
non-empty directories - directories being removed are cleaned along with contents instead.
- `abort` and `truncate` functions are not supported.
- progress events are not fired. For example, this handler will be not executed:
```javascript
writer.onprogress = function() { /*commands*/ };
```

## Upgrading Notes

In v1.0.0 of this plugin, the `FileEntry` and `DirectoryEntry` structures have changed,
to be more in line with the published specification.

Previous (pre-1.0.0) versions of the plugin stored the device-absolute-file-location
in the `fullPath` property of `Entry` objects. These paths would typically look like

    /var/mobile/Applications/<application UUID>/Documents/path/to/file  (iOS)
    /storage/emulated/0/path/to/file                                    (Android)

These paths were also returned by the `toURL()` method of the `Entry` objects.

With v1.0.0, the `fullPath` attribute is the path to the file, _relative to the root of
the HTML filesystem_. So, the above paths would now both be represented by a `FileEntry`
object with a `fullPath` of

    /path/to/file

If your application works with device-absolute-paths, and you previously retrieved those
paths through the `fullPath` property of `Entry` objects, then you should update your code
to use `entry.toURL()` instead.

For backwards compatibility, the `resolveLocalFileSystemURL()` method will accept a
device-absolute-path, and will return an `Entry` object corresponding to it, as long as that
file exists within either the `TEMPORARY` or `PERSISTENT` filesystems.

This has particularly been an issue with the File-Transfer plugin, which previously used
device-absolute-paths (and can still accept them). It has been updated to work correctly
with FileSystem URLs, so replacing `entry.fullPath` with `entry.toURL()` should resolve any
issues getting that plugin to work with files on the device.

In v1.1.0 the return value of `toURL()` was changed (see [CB-6394] (https://issues.apache.org/jira/browse/CB-6394))
to return an absolute 'file://' URL. wherever possible. To ensure a 'cdvfile:'-URL you can use `toInternalURL()` now.
This method will now return filesystem URLs of the form

    cdvfile://localhost/persistent/path/to/file

which can be used to identify the file uniquely.

## List of Error Codes and Meanings
When an error is thrown, one of the following codes will be used. 

| Code | Constant                      |
|-----:|:------------------------------|
|    1 | `NOT_FOUND_ERR`               |
|    2 | `SECURITY_ERR`                |
|    3 | `ABORT_ERR`                   |
|    4 | `NOT_READABLE_ERR`            |
|    5 | `ENCODING_ERR`                |
|    6 | `NO_MODIFICATION_ALLOWED_ERR` |
|    7 | `INVALID_STATE_ERR`           |
|    8 | `SYNTAX_ERR`                  |
|    9 | `INVALID_MODIFICATION_ERR`    |
|   10 | `QUOTA_EXCEEDED_ERR`          |
|   11 | `TYPE_MISMATCH_ERR`           |
|   12 | `PATH_EXISTS_ERR`             |

## Configuring the Plugin (Optional)

The set of available filesystems can be configured per-platform. Both iOS and
Android recognize a <preference> tag in `config.xml` which names the
filesystems to be installed. By default, all file-system roots are enabled.

    <preference name="iosExtraFilesystems" value="library,library-nosync,documents,documents-nosync,cache,bundle,root" />
    <preference name="AndroidExtraFilesystems" value="files,files-external,documents,sdcard,cache,cache-external,root" />

### Android

* `files`: The application's internal file storage directory
* `files-external`: The application's external file storage directory
* `sdcard`: The global external file storage directory (this is the root of the SD card, if one is installed). You must have the `android.permission.WRITE_EXTERNAL_STORAGE` permission to use this.
* `cache`: The application's internal cache directory
* `cache-external`: The application's external cache directory
* `root`: The entire device filesystem

Android also supports a special filesystem named "documents", which represents a "/Documents/" subdirectory within the "files" filesystem.

### iOS

* `library`: The application's Library directory
* `documents`: The application's Documents directory
* `cache`: The application's Cache directory
* `bundle`: The application's bundle; the location of the app itself on disk (read-only)
* `root`: The entire device filesystem

By default, the library and documents directories can be synced to iCloud. You can also request two additional filesystems, `library-nosync` and `documents-nosync`, which represent a special non-synced directory within the `/Library` or `/Documents` filesystem.
