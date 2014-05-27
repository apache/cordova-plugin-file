<!---
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
-->

# org.apache.cordova.file

This plugin provides the [HTML5 Filesystem API][1]. For usage, refer to HTML5 Rocks' [FileSystem article][2] on the subject. For an overview of other storage options, refer to Cordova's [storage guide][3].

 [1]: http://dev.w3.org/2009/dap/file-system/pub/FileSystem/
 [2]: http://www.html5rocks.com/en/tutorials/file/filesystem/
 [3]: http://cordova.apache.org/docs/en/edge/cordova_storage_storage.md.html

## インストール

    cordova plugin add org.apache.cordova.file
    

## サポートされているプラットフォーム

*   アマゾン火 OS
*   アンドロイド
*   BlackBerry 10*
*   iOS
*   Windows Phone 7 and 8*
*   Windows 8*

* *These platforms do not support `FileReader.readAsArrayBuffer` nor `FileWriter.write(blob)`.*

## Configuring the Plugin

利用可能なファイルシステムのセットは構成されたプラットフォームをすることができます。IOS と Android の両方を認識します。 <preference> タグの `config.xml` をインストールするファイルシステムの名前します。既定では、すべてのファイル システムのルートが有効になります。

    <preference name="iosExtraFilesystems" value="library,library-nosync,documents,documents-nosync,cache,bundle,root" />
    <preference name="AndroidExtraFilesystems" value="files,files-external,documents,sdcard,cache,cache-external,root" />
    

### アンドロイド

*   ファイル： アプリケーションの内部ファイルのストレージ ディレクトリ
*   外部ファイル: アプリケーションの外部のファイルのストレージ ディレクトリ
*   sdcard: The global external file storage directory (this is the root of the SD card, if one is installed)
*   cache: The application's internal cache directory
*   cache-external: The application's external cache directory
*   root: The entire device filesystem

Android also supports a special filesystem named "documents", which represents a "/Documents/" subdirectory within the "files" filesystem.

### iOS

*   library: The application's Library directory
*   documents: The application's Documents directory
*   cache: The application's Cache directory
*   app-bundle: The application's bundle; the location of the app itself on disk
*   root: The entire device filesystem

By default, the library and documents directories can be synced to iCloud. You can also request two additional filesystems, "library-nosync" and "documents-nosync", which represent a special non-synced directory within the Library or Documents filesystem.

## Android の癖

### Android Persistent storage location

There are multiple valid locations to store persistent files on an Android device. See [this page][4] for an extensive discussion of the various possibilities.

 [4]: http://developer.android.com/guide/topics/data/data-storage.html

Previous versions of the plugin would choose the location of the temporary and persistent files on startup, based on whether the device claimed that the SD Card (or equivalent storage partition) was mounted. If the SD Card was mounted, or if a large internal storage partition was available (such as on Nexus devices,) then the persistent files would be stored in the root of that space. This meant that all Cordova apps could see all of the files available on the card.

If the SD card was not available, then previous versions would store data under /data/data/<packageid>, which isolates apps from each other, but may still cause data to be shared between users.

It is now possible to choose whether to store files in the internal file storage location, or using the previous logic, with a preference in your application's config.xml file. To do this, add one of these two lines to config.xml:

    <preference name="AndroidPersistentFileLocation" value="Internal" />
    
    <preference name="AndroidPersistentFileLocation" value="Compatibility" />
    

この行がなければファイル プラグインは既定値として「互換性」を使用します。優先タグが存在し、これらの値の 1 つではない場合、アプリケーションは起動しません。

アプリケーションは、ユーザーに以前出荷されている場合、古い (前 1.0） を使用して、このプラグインのバージョンし、永続的なファイルシステムに保存されているファイルには「互換性」を設定する必要があります。 自分のアプリケーションをアップグレードする既存のユーザーを彼らの装置によって、以前に保存されたファイルにアクセスすることができることがあることを意味する「内部」に場所をスイッチングします。

アプリケーション場合は、新しい、または永続的なファイルシステムにファイルが格納され以前は決して、「内部」の設定は推奨一般に。

## ブラックベリーの癖

`DirectoryEntry.removeRecursively()`失敗する可能性があります、 `ControlledAccessException` 、次の場合。

*   アプリは、アプリの以前のインストールによって作成されたディレクトリにアクセスしようとします。

> 解決策: 手動で、または再インストールする前にアプリケーションによって一時ディレクトリはきれいに確認してください。

*   場合は、デバイスは USB で接続されました。

> ソリューション: 再実行して、デバイスから USB ケーブルを外します。

## iOS の癖

*   `FileReader.readAsText(blob, encoding)` 
    *   `encoding`パラメーターはサポートされていませんし、utf-8 エンコーディングが常に有効です。

### iOS の永続的なストレージの場所

IOS デバイスに永続的なファイルを格納する 2 つの有効な場所がある: ドキュメントとライブラリのディレクトリ。 プラグインの以前のバージョンは、唯一のこれまでドキュメント ディレクトリに永続的なファイルを格納されます。 これは、ディレクトリの目的は、輸出のための完全なドキュメントを作成するのではなくなかったがしばしば意図されていたり、特に多数の小さいファイルを処理するアプリケーションの場合、iTunes に表示されているすべてのアプリケーションのファイルを作るの副作用があった。

ドキュメントまたはアプリケーションの config.xml ファイルに優先順位のライブラリ ディレクトリにファイルを保存するかどうかを選択することが可能です今。 これを行うに、config.xml に次の 2 行のいずれかを追加します。

    <preference name="iosPersistentFileLocation" value="Library" />
    
    <preference name="iosPersistentFileLocation" value="Compatibility" />
    

この行がなければファイル プラグインは既定値として「互換性」を使用します。優先タグが存在し、これらの値の 1 つではない場合、アプリケーションは起動しません。

アプリケーションは、ユーザーに以前出荷されている場合、古い (前 1.0） を使用して、このプラグインのバージョンし、永続的なファイルシステムに保存されているファイルには「互換性」を設定する必要があります。 自分のアプリケーションをアップグレードする既存のユーザーを以前に保存されたファイルにアクセスすることができるだろうことを意味する「ライブラリ」に場所をスイッチングします。

アプリケーション場合は、新しい、または永続的なファイルシステムにファイルが格納され以前は決して、「ライブラリ」設定は推奨一般に。

## ノートをアップグレードします。

このプラグインのデベロッパーで、 `FileEntry` と `DirectoryEntry` 構造変更、公開された仕様に沿ったより多くであります。

プラグインの前 (pre 1.0.0) バージョン、デバイス-絶対-ファイルの場所に格納されている、 `fullPath` のプロパティ `Entry` オブジェクト。これらのパスはようになります通常

    /var/mobile/Applications/<application UUID>/Documents/path/to/file  (iOS)
    /storage/emulated/0/path/to/file                                    (Android)
    

これらのパスはまたによって返された、 `toURL()` 法、 `Entry` オブジェクト。

デベロッパーと、 `fullPath` 属性は、 *HTML のファイルシステムのルートに対する相対パス*のファイルへのパス。 したがって、上記のパスは両方によって表される今、 `FileEntry` オブジェクトが、 `fullPath` の

    /path/to/file
    

If your application works with device-absolute-paths, and you previously retrieved those paths through the `fullPath` property of `Entry` objects, then you should update your code to use `entry.toURL()` instead. このメソッドは、フォームのファイルシステムの Url を返します今

    cdvfile://localhost/persistent/path/to/file
    

which can be used to identify the file uniquely.

For backwards compatibility, the `resolveLocalFileSystemURL()` method will accept a device-absolute-path, and will return an `Entry` object corresponding to it, as long as that file exists within either the TEMPORARY or PERSISTENT filesystems.

これは特に以前デバイス絶対パスを使用してファイル転送のプラグインで問題となっている （そしてまだそれらを受け入れることができます）。 ので交換、ファイルシステムの Url で正しく動作するように更新されている `entry.fullPath` と `entry.toURL()` デバイス上のファイルで動作するプラグインを得て問題を解決する必要があります。

## エラー コードと意味のリスト

エラーがスローされると、次のコードのいずれかが使用されます。

*   1 = NOT\_FOUND\_ERR
*   2 = SECURITY_ERR
*   3 = ABORT_ERR
*   4 = NOT\_READABLE\_ERR
*   5 = ENCODING_ERR
*   6 = NO\_MODIFICATION\_ALLOWED_ERR
*   7 = INVALID\_STATE\_ERR
*   8 = SYNTAX_ERR
*   9 = INVALID\_MODIFICATION\_ERR
*   10 = QUOTA\_EXCEEDED\_ERR
*   11 = TYPE\_MISMATCH\_ERR
*   12 = PATH\_EXISTS\_ERR