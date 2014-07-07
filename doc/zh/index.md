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

這個外掛程式實現檔 API 允許對檔駐留在該設備上的讀/寫訪問。

這個外掛程式基於幾個規格，包括： HTML5 檔 API [HTTP://www.w3.org/TR/FileAPI/][1]

 [1]: http://www.w3.org/TR/FileAPI/

（現已解散） 目錄和系統擴展最新： [HTTP://www.w3.org/TR/2012/WD-file-system-api-20120417/][2]雖然大部分的外掛程式代碼寫時較早的規格是當前： [HTTP://www.w3.org/TR/2011/WD-file-system-api-20110419/][3]

 [2]: http://www.w3.org/TR/2012/WD-file-system-api-20120417/
 [3]: http://www.w3.org/TR/2011/WD-file-system-api-20110419/

它還實現 FileWriter 規格： [HTTP://dev.w3.org/2009/dap/file-system/file-writer.html][4]

 [4]: http://dev.w3.org/2009/dap/file-system/file-writer.html

用法，請參閱對 HTML5 的岩石優秀[檔案系統文章。][5]

 [5]: http://www.html5rocks.com/en/tutorials/file/filesystem/

其他存儲選項的概述，請參閱科爾多瓦的[存儲指南][6].

 [6]: http://cordova.apache.org/docs/en/edge/cordova_storage_storage.md.html

## 安裝

    cordova plugin add org.apache.cordova.file
    

## 支援的平臺

*   亞馬遜火 OS
*   Android 系統
*   黑莓 10
*   火狐瀏覽器的作業系統
*   iOS
*   Windows Phone 7 和 8 *
*   Windows 8 *

**這些平臺不支援 `FileReader.readAsArrayBuffer` ，也不 `FileWriter.write(blob)` .*

## 存儲檔的位置

自 v1.2.0，提供重要的檔案系統目錄的 Url。 每個 URL 是在表單*file:///path/to/spot/*，和可以轉換為 `DirectoryEntry` 使用`window.resolveLocalFileSystemURL()`.

`cordova.file.applicationDirectory`-唯讀目錄在哪裡安裝的應用程式。（*iOS*，*安卓*)

`cordova.file.applicationStorageDirectory`-應用程式的私有可寫入存儲的根。（*iOS*，*安卓*)

`cordova.file.dataDirectory`-把特定于應用程式的資料檔案的位置。（*iOS*，*安卓*)

`cordova.file.cacheDirectory`-緩存的檔應該生存的應用程式重新開機。應用程式不應依賴的作業系統，請刪除檔在這裡。（*iOS*，*安卓*)

`cordova.file.externalApplicationStorageDirectory`-應用程式外部存儲上的空間。（*iOS*，*安卓*)

`cordova.file.externalDataDirectory`-放在外部存儲特定于應用程式的資料檔案的位置。（*安卓*)

`cordova.file.externalCacheDirectory`-在外部存儲應用程式緩存。（*安卓*)

`cordova.file.externalRootDirectory`-外部存儲 （SD 卡） 的根。（*安卓*)

`cordova.file.tempDirectory`-OS 可以清除時的空目錄會。（*iOS*)

`cordova.file.syncedDataDirectory`-保存應同步 （例如到 iCloud） 的特定于應用程式的檔。（*iOS*)

`cordova.file.documentsDirectory`-檔私有的應用程式，但這是對其他的 applciations （例如 Office 檔） 有意義。（*iOS*)

## Android 的怪癖

### Android 的永久存儲位置

有很多有效的位置來存儲持久性檔在 Android 設備上。 請參閱[此頁][7]為廣泛地討論的各種可能性。

 [7]: http://developer.android.com/guide/topics/data/data-storage.html

以前版本的外掛程式會選擇在啟動時，基於該設備是否聲稱 SD 卡 （或等效存儲分區） 展開，臨時和永久檔的位置。 如果被掛載 SD 卡，或者如果一個大的內部存儲分區是可用 （如 Nexus 設備上） 然後持久性檔將存儲在該空間的根目錄中。 這就意味著所有的科爾多瓦應用程式可以看到所有可用的檔在卡上。

如果 SD 卡不是可用的然後以前的版本會將資料存儲在下/資料/資料 /<packageid>其中隔離應用程式從彼此，但仍然可能會導致使用者之間共用資料。

現在可以選擇是否將檔存儲在內部檔存儲位置，或使用以前的邏輯，與您的應用程式的 config.xml 檔中的偏好。 要做到這一點，向 config.xml 添加以下兩行之一：

    <preference name="AndroidPersistentFileLocation" value="Internal" />
    
    <preference name="AndroidPersistentFileLocation" value="Compatibility" />
    

如果這條線，沒有檔外掛程式將作為預設值使用"相容性"。如果首選項標記是存在，並不是這些值之一，應用程式將無法啟動。

如果您的應用程式先前已經運送到使用者，使用較舊的 (預 1.0) 的這個外掛程式版本和已存儲的檔中的持久性的檔案系統，然後您應該設置的首選項的"相容性"。 切換到"內部"的位置就意味著現有使用者升級他們的應用程式可能無法訪問他們以前存儲的檔，他們的設備。

如果您的應用程式是新的或以前從未有持久性檔案系統中存儲檔，然後，通常建議的"內部"的設置。

## iOS 的怪癖

*   `FileReader.readAsText(blob, encoding)` 
    *   `encoding`參數不受支援，和 utf-8 編碼總是有效。

### iOS 的持久性存儲位置

有兩個有效的位置來存儲持久性的 iOS 設備上的檔： 檔目錄和庫目錄。 以前版本的外掛程式永遠只能存儲持久性檔在檔目錄中。 這有副作用 — — 使所有的應用程式的檔可見在 iTunes 中，往往是意料之外，尤其是對於處理大量小檔的應用程式，而不是生產用於出口，是意欲的目的的目錄的完整文檔。

現在可以選擇是否將檔存儲在檔或庫目錄，與您的應用程式的 config.xml 檔中的偏好。 要做到這一點，向 config.xml 添加以下兩行之一：

    <preference name="iosPersistentFileLocation" value="Library" />
    
    <preference name="iosPersistentFileLocation" value="Compatibility" />
    

如果這條線，沒有檔外掛程式將使用"相容性"作為預設值。如果偏好的標記是存在的並不是這些值之一，應用程式將無法啟動。

如果您的應用程式先前已經運送到使用者，使用較舊的 （預 1.0） 的這個外掛程式，版本和已存儲的檔中的持久性的檔案系統，那麼您應該設置為"相容性"的偏好。 切換到"庫"的位置就意味著現有使用者升級他們的應用程式將無法訪問他們以前存儲的檔。

如果您的應用程式是新的或以前從未有持久性檔案系統中存儲檔，然後一般建議使用"庫"設置。

### 火狐瀏覽器作業系統的怪癖

檔案系統 API 本身不支援通過 Firefox OS，作為墊片在 indexedDB 上實現的。

*   不會失敗時刪除非空的目錄
*   不支援用中繼資料的目錄
*   不支援 `requestAllFileSystems` 和 `resolveLocalFileSystemURI` 的方法
*   方法 `copyTo` 和 `moveTo` 不支援目錄

## 升級說明

在這個外掛程式，v1.0.0 `FileEntry` 和 `DirectoryEntry` 結構已經改變，更符合已發佈的規範。

以前 (pre-1.0.0） 版本的外掛程式存放裝置固定檔案位置在 `fullPath` 屬性的 `Entry` 物件。這些路徑通常會看起來像

    /var/mobile/Applications/<application UUID>/Documents/path/to/file  (iOS)
    /storage/emulated/0/path/to/file                                    (Android)
    

這些路徑還返回的 `toURL()` 方法的 `Entry` 物件。

與 v1.0.0， `fullPath` 的屬性是檔，*相對於 HTML 檔案系統的根目錄*的路徑。 所以，上面的路徑會現在都由代表 `FileEntry` 物件與 `fullPath` 的

    /path/to/file
    

如果您的應用程式與設備-絕對路徑，和你以前檢索到這些路徑通過 `fullPath` 屬性的 `Entry` 物件，然後您應該更新代碼以使用 `entry.toURL()` 相反。

為向後相容性， `resolveLocalFileSystemURL()` 方法將接受設備-絕對路徑，並將返回 `Entry` 對應于它，只要該檔存在內的臨時或永久性的檔案系統物件。

這特別是一直與檔案傳輸外掛程式，以前使用過的設備-絕對路徑的問題 (和仍然可以接受他們)。 它已更新正常工作與檔案系統的 Url，所以更換 `entry.fullPath` 與 `entry.toURL()` 應解決獲取該外掛程式來處理檔在設備上的任何問題。

V1.1.0 的傳回值中的 `toURL()` 被更改 （見 [CB-6394] （HTTPs://issues.apache.org/jira/browse/CB-6394）） 為返回一個絕對 file:// URL。 只要有可能。 以確保 ' cdvfile:'-您可以使用的 URL `toInternalURL()` 現在。 現在，此方法將返回檔案系統的表單的 Url

    cdvfile://localhost/persistent/path/to/file
    

它可以用於唯一地標識該檔。

## 錯誤代碼和含義的清單

當拋出一個錯誤時，將使用以下代碼之一。

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

## 配置的外掛程式 （可選）

可用的檔案系統的一整套可以配置每個平臺。IOS 和安卓系統識別 <preference> 在標記 `config.xml` 哪一個名字要安裝的檔案系統。預設情況下，啟用所有檔案系統的根。

    <preference name="iosExtraFilesystems" value="library,library-nosync,documents,documents-nosync,cache,bundle,root" />
    <preference name="AndroidExtraFilesystems" value="files,files-external,documents,sdcard,cache,cache-external,root" />
    

### Android 系統

*   檔: 應用程式的內部檔存儲目錄
*   檔外部： 應用程式的外部檔存儲目錄
*   sdcard： 全球外部檔存儲目錄 （如果安裝了一個，這是 SD 卡的根目錄）。 您必須具有 `android.permission.WRITE_EXTERNAL_STORAGE` 使用此許可權。
*   快取記憶體： 應用程式的內部緩存目錄
*   外部快取記憶體： 應用程式的外部快取記憶體目錄
*   根： 整個設備的檔案系統

安卓系統還支援一個特別的檔案系統命名為"檔"，它代表"檔"的檔案系統中的子目錄"/ 檔 /"。

### iOS

*   圖書館： 應用程式的庫目錄
*   文檔： 應用程式的檔目錄
*   快取記憶體： 應用程式的緩存目錄
*   束： 束應用程式的 ；應用程式本身 （唯讀） 的磁片上的位置
*   根： 整個設備的檔案系統

預設情況下，圖書館和檔目錄可以同步到 iCloud。 您也可以要求兩個附加檔案系統、"圖書館 nosync"和"文檔-nosync"，所代表的庫或檔的檔案系統內的一個特殊非同步目錄。