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

#import "CDVFile.h"

extern NSString* const kCDVAssetsLibraryPrefix;
extern NSString* const kCDVAssetsLibraryScheme;

/*
 Compatibility filesystem for legacy iOS photo-library URLs.

 This filesystem maps native `asset-library://...` resources to the internal
 `cdvfile://localhost/assets-library/...` namespace so they can be resolved by
 Cordova's File plugin APIs.

 This legacy API provides access to pictures and videos managed by the
 Photos application, not arbitrary document files.

 It is intentionally read-only. Write and directory-management operations are
 unsupported for this filesystem root.

 The implementation is based on Apple's AssetsLibrary API, which was
 deprecated in iOS 9.0, and exists to preserve behavior for older
 integrations. For apps with a deployment target of 26.0 or later,
 AssetsLibrary is removed and this filesystem is not registered.
 */
@interface CDVAssetLibraryFilesystem : NSObject<CDVFileSystem> {
}

- (id) initWithName:(NSString *)name;

@end
