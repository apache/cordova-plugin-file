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
#import <Cordova/CDV.h>
#import <AssetsLibrary/ALAsset.h>
#import <AssetsLibrary/ALAssetRepresentation.h>
#import <AssetsLibrary/ALAssetsLibrary.h>
#import <MobileCoreServices/MobileCoreServices.h>
#import <sys/xattr.h>

static CDVFile *filePlugin = nil;

extern NSString * const NSURLIsExcludedFromBackupKey __attribute__((weak_import));

#ifndef __IPHONE_5_1
    NSString* const NSURLIsExcludedFromBackupKey = @"NSURLIsExcludedFromBackupKey";
#endif

NSString* const kCDVAssetsLibraryPrefix = @"assets-library://";
NSString* const kCDVAssetsLibraryScheme = @"assets-library";

@interface CDVFilesystemURL : NSObject  {
    NSURL *_url;
    CDVFileSystemType _fileSystemType;
    NSString *_fullPath;
}

- (id) initWithString:(NSString*)strURL;
- (id) initWithURL:(NSURL*)URL;

@property (atomic) NSURL *url;
@property (atomic) CDVFileSystemType fileSystemType;
@property (atomic) NSString *fullPath;

@end

@implementation CDVFilesystemURL
@synthesize url=_url;
@synthesize fileSystemType=_fileSystemType;
@synthesize fullPath=_fullPath;

- (id) initWithString:(NSString *)strURL
{
    if ( self = [super init] ) {
        NSURL *decodedURL = [NSURL URLWithString:strURL];
        return [self initWithURL:decodedURL];
    }
    return nil;
}

-(id) initWithURL:(NSURL *)URL
{
    if ( self = [super init] ) {
        _url = URL;
        _fileSystemType = [self filesystemTypeForLocalURI:URL];
        _fullPath = [self fullPathForLocalURI:URL];
    }
    return self;
}

/*
 * IN
 *  NSString localURI
 * OUT
 *  int FileSystem type for this URI, or -1 if it is not recognized.
 */
- (CDVFileSystemType)filesystemTypeForLocalURI:(NSURL *)uri
{
    if ([[uri scheme] isEqualToString:@"filesystem"] && [[uri host] isEqualToString:@"localhost"]) {
        if ([[uri path] hasPrefix:@"/temporary"]) {
            return TEMPORARY;
        } else if ([[uri path] hasPrefix:@"/persistent"]) {
            return PERSISTENT;
        }
    } else if ([[uri scheme] isEqualToString:kCDVAssetsLibraryScheme]) {
        return ASSETS_LIBRARY;
    }
    return -1;
}

/*
 * IN
 *  NSString localURI
 * OUT
 *  NSString fullPath component suitable for an Entry object.
 * The incoming URI should be properly escaped. The returned fullPath is unescaped.
 */
- (NSString *)fullPathForLocalURI:(NSURL *)uri
{
    int fsType = [self filesystemTypeForLocalURI:uri];
    if (fsType == TEMPORARY) {
        return [[uri path] substringFromIndex:10];
    } else if (fsType == PERSISTENT) {
        return [[uri path] substringFromIndex:11];
    }
    return nil;
}

+ (CDVFilesystemURL *)fileSystemURLWithString:(NSString *)strURL
{
    return [[CDVFilesystemURL alloc] initWithString:strURL];
}

+ (CDVFilesystemURL *)fileSystemURLWithURL:(NSURL *)URL
{
    return [[CDVFilesystemURL alloc] initWithURL:URL];
}

@end

@protocol CDVFileSystem
- (CDVPluginResult *)entryForLocalURI:(CDVFilesystemURL *)url;
- (CDVPluginResult *)getFileForURL:(CDVFilesystemURL *)baseURI requestedPath:(NSString *)requestedPath options:(NSDictionary *)options;
- (CDVPluginResult*)getParentForURL:(CDVFilesystemURL *)localURI;
- (void)getMetadataForURL:(CDVFilesystemURL *)url callback:(void (^)(CDVPluginResult *))callback;
- (CDVPluginResult*)setMetadataForURL:(CDVFilesystemURL *)localURI withObject:(NSDictionary *)options;
- (CDVPluginResult *)removeFileAtURL:(CDVFilesystemURL *)localURI;
- (CDVPluginResult *)recursiveRemoveFileAtURL:(CDVFilesystemURL *)localURI;
- (CDVPluginResult *)readEntriesAtURL:(CDVFilesystemURL *)localURI;
- (CDVPluginResult *)truncateFileAtURL:(CDVFilesystemURL *)localURI atPosition:(unsigned long long)pos;
- (CDVPluginResult *)writeToFileAtURL:(CDVFilesystemURL *)localURL withData:(NSData*)encData append:(BOOL)shouldAppend;
- (void)copyFileToURL:(CDVFilesystemURL *)destURL withName:(NSString *)newName fromFileSystem:(NSObject<CDVFileSystem> *)srcFs atURL:(CDVFilesystemURL *)srcURL copy:(BOOL)bCopy callback:(void (^)(CDVPluginResult *))callback;
- (void)readFileAtURL:(CDVFilesystemURL *)localURL start:(NSInteger)start end:(NSInteger)end callback:(void (^)(NSData*, NSString* mimeType, CDVFileError))callback;
- (void)getFileMetadataForURL:(CDVFilesystemURL *)localURL callback:(void (^)(CDVPluginResult *))callback;
@end

@interface CDVLocalFilesystem : NSObject<CDVFileSystem> {
    NSString *_fsRoot;
}
- (id) initWithName:(NSString *)name root:(NSString *)fsRoot;
@property (nonatomic,strong) NSString *fsRoot;
@end

@implementation CDVLocalFilesystem
@synthesize fsRoot=_fsRoot;

- (id) initWithName:(NSString *)name root:(NSString *)fsRoot
{
    if (self) {
        _fsRoot = fsRoot;
    }
    return self;
}

/*
 * IN
 *  NSString localURI
 * OUT
 *  CDVPluginResult result containing a file or directoryEntry for the localURI, or an error if the
 *   URI represents a non-existent path, or is unrecognized or otherwise malformed.
 */
- (CDVPluginResult *)entryForLocalURI:(CDVFilesystemURL *)url;
{
    CDVPluginResult* result = nil;
    NSString *path = [self fileSystemPathForURL:url];
    NSFileManager* fileMgr = [[NSFileManager alloc] init];
    BOOL isDir = NO;
    // see if exists and is file or dir
    BOOL bExists = [fileMgr fileExistsAtPath:path isDirectory:&isDir];
    if (bExists) {
        NSDictionary* fileSystem = [self makeEntryForPath:url.fullPath fileSystem:url.fileSystemType isDirectory:isDir];
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsDictionary:fileSystem];
    } else {
        // return NOT_FOUND_ERR
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:NOT_FOUND_ERR];
    }
    return result;
}
- (NSDictionary*)makeEntryForPath:(NSString*)fullPath fileSystem:(int)fsType isDirectory:(BOOL)isDir
{
    NSMutableDictionary* dirEntry = [NSMutableDictionary dictionaryWithCapacity:5];
    NSString* lastPart = [fullPath lastPathComponent];
    if (isDir && ![fullPath hasSuffix:@"/"]) {
        fullPath = [fullPath stringByAppendingString:@"/"];
    }
    [dirEntry setObject:[NSNumber numberWithBool:!isDir]  forKey:@"isFile"];
    [dirEntry setObject:[NSNumber numberWithBool:isDir]  forKey:@"isDirectory"];
    [dirEntry setObject:fullPath forKey:@"fullPath"];
    [dirEntry setObject:lastPart forKey:@"name"];
    [dirEntry setObject: [NSNumber numberWithInt:fsType] forKey: @"filesystem"];

    return dirEntry;
}

/*
 * IN
 *  NSString localURI
 * OUT
 *  NSString full local filesystem path for the represented file or directory, or nil if no such path is possible
 *  The file or directory does not necessarily have to exist. nil is returned if the filesystem type is not recognized,
 *  or if the URL is malformed.
 * The incoming URI should be properly escaped (no raw spaces, etc. URI percent-encoding is expected).
 */
- (NSString *)fileSystemPathForURL:(CDVFilesystemURL *)url
{
    NSString *path = nil;
    NSString *fullPath = url.fullPath;
    path = [NSString stringWithFormat:@"%@%@", self.fsRoot, fullPath];
    if ([path hasSuffix:@"/"]) {
      path = [path substringToIndex:([path length]-1)];
    }
    return path;
}


- (CDVPluginResult *)getFileForURL:(CDVFilesystemURL *)baseURI requestedPath:(NSString *)requestedPath options:(NSDictionary *)options
{
    CDVPluginResult* result = nil;
    BOOL bDirRequest = NO;
    BOOL create = NO;
    BOOL exclusive = NO;
    int errorCode = 0;  // !!! risky - no error code currently defined for 0

    if ([options valueForKeyIsNumber:@"create"]) {
        create = [(NSNumber*)[options valueForKey:@"create"] boolValue];
    }
    if ([options valueForKeyIsNumber:@"exclusive"]) {
        exclusive = [(NSNumber*)[options valueForKey:@"exclusive"] boolValue];
    }

    if ([options valueForKeyIsNumber:@"getDir"]) {
        // this will not exist for calls directly to getFile but will have been set by getDirectory before calling this method
        bDirRequest = [(NSNumber*)[options valueForKey:@"getDir"] boolValue];
    }
    // see if the requested path has invalid characters - should we be checking for  more than just ":"?
    if ([requestedPath rangeOfString:@":"].location != NSNotFound) {
        errorCode = ENCODING_ERR;
    } else {
        CDVFilesystemURL* requestedURL = [CDVFilesystemURL fileSystemURLWithURL:[NSURL URLWithString:[requestedPath stringByAddingPercentEscapesUsingEncoding:NSUTF8StringEncoding] relativeToURL:baseURI.url]]; /* TODO: UGLY - FIX */

        // NSLog(@"reqFullPath = %@", reqFullPath);
        NSFileManager* fileMgr = [[NSFileManager alloc] init];
        BOOL bIsDir;
        BOOL bExists = [fileMgr fileExistsAtPath:[self fileSystemPathForURL:requestedURL] isDirectory:&bIsDir];
        if (bExists && (create == NO) && (bIsDir == !bDirRequest)) {
            // path exists and is of requested type  - return TYPE_MISMATCH_ERR
            errorCode = TYPE_MISMATCH_ERR;
        } else if (!bExists && (create == NO)) {
            // path does not exist and create is false - return NOT_FOUND_ERR
            errorCode = NOT_FOUND_ERR;
        } else if (bExists && (create == YES) && (exclusive == YES)) {
            // file/dir already exists and exclusive and create are both true - return PATH_EXISTS_ERR
            errorCode = PATH_EXISTS_ERR;
        } else {
            // if bExists and create == YES - just return data
            // if bExists and create == NO  - just return data
            // if !bExists and create == YES - create and return data
            BOOL bSuccess = YES;
            NSError __autoreleasing* pError = nil;
            if (!bExists && (create == YES)) {
                if (bDirRequest) {
                    // create the dir
                    bSuccess = [fileMgr createDirectoryAtPath:[self fileSystemPathForURL:requestedURL] withIntermediateDirectories:NO attributes:nil error:&pError];
                } else {
                    // create the empty file
                    bSuccess = [fileMgr createFileAtPath:[self fileSystemPathForURL:requestedURL] contents:nil attributes:nil];
                }
            }
            if (!bSuccess) {
                errorCode = ABORT_ERR;
                if (pError) {
                    NSLog(@"error creating directory: %@", [pError localizedDescription]);
                }
            } else {
                // NSLog(@"newly created file/dir (%@) exists: %d", reqFullPath, [fileMgr fileExistsAtPath:reqFullPath]);
                // file existed or was created
                result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsDictionary:[self makeEntryForPath:requestedURL.fullPath fileSystem:baseURI.fileSystemType isDirectory:bDirRequest]];
            }
        } // are all possible conditions met?
    }

    if (errorCode > 0) {
        // create error callback
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:errorCode];
    }
    return result;

}

- (CDVPluginResult*)getParentForURL:(CDVFilesystemURL *)localURI
{
    CDVPluginResult* result = nil;
    CDVFilesystemURL *newURI = nil;
    if ([localURI.fullPath isEqualToString:@""]) {
        // return self
        newURI = localURI;
    } else {
        newURI = [CDVFilesystemURL fileSystemURLWithURL:[localURI.url URLByDeletingLastPathComponent]]; /* TODO: UGLY - FIX */
    }
    NSFileManager* fileMgr = [[NSFileManager alloc] init];
    BOOL bIsDir;
    BOOL bExists = [fileMgr fileExistsAtPath:[self fileSystemPathForURL:newURI] isDirectory:&bIsDir];
    if (bExists) {
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsDictionary:[self makeEntryForPath:newURI.fullPath fileSystem:newURI.fileSystemType isDirectory:bIsDir]];
    } else {
        // invalid path or file does not exist
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:NOT_FOUND_ERR];
    }
    return result;
}

- (void)getMetadataForURL:(CDVFilesystemURL *)url callback:(void (^)(CDVPluginResult *))callback
{

    NSFileManager* fileMgr = [[NSFileManager alloc] init];
    NSError* __autoreleasing error = nil;

    CDVPluginResult *result;
    NSDictionary* fileAttribs = [fileMgr attributesOfItemAtPath:[self  fileSystemPathForURL:url] error:&error];

    if (fileAttribs) {
        NSDate* modDate = [fileAttribs fileModificationDate];
        if (modDate) {
            result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsDouble:[modDate timeIntervalSince1970] * 1000];
        }
    } else {
        // didn't get fileAttribs
        CDVFileError errorCode = ABORT_ERR;
        NSLog(@"error getting metadata: %@", [error localizedDescription]);
        if ([error code] == NSFileNoSuchFileError) {
            errorCode = NOT_FOUND_ERR;
        }
        // log [NSNumber numberWithDouble: theMessage] objCtype to see what it returns
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsInt:errorCode];
    }
    if (!result) {
        // invalid path or file does not exist
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION];
    }
    callback(result);
}

- (CDVPluginResult*)setMetadataForURL:(CDVFilesystemURL *)localURI withObject:(NSDictionary *)options
{
    BOOL ok = NO;

    NSString* filePath = [self fileSystemPathForURL:localURI];
    // we only care about this iCloud key for now.
    // set to 1/true to skip backup, set to 0/false to back it up (effectively removing the attribute)
    NSString* iCloudBackupExtendedAttributeKey = @"com.apple.MobileBackup";
    id iCloudBackupExtendedAttributeValue = [options objectForKey:iCloudBackupExtendedAttributeKey];

    if ((iCloudBackupExtendedAttributeValue != nil) && [iCloudBackupExtendedAttributeValue isKindOfClass:[NSNumber class]]) {
        if (IsAtLeastiOSVersion(@"5.1")) {
            NSURL* url = [NSURL fileURLWithPath:filePath];
            NSError* __autoreleasing error = nil;

            ok = [url setResourceValue:[NSNumber numberWithBool:[iCloudBackupExtendedAttributeValue boolValue]] forKey:NSURLIsExcludedFromBackupKey error:&error];
        } else { // below 5.1 (deprecated - only really supported in 5.01)
            u_int8_t value = [iCloudBackupExtendedAttributeValue intValue];
            if (value == 0) { // remove the attribute (allow backup, the default)
                ok = (removexattr([filePath fileSystemRepresentation], [iCloudBackupExtendedAttributeKey cStringUsingEncoding:NSUTF8StringEncoding], 0) == 0);
            } else { // set the attribute (skip backup)
                ok = (setxattr([filePath fileSystemRepresentation], [iCloudBackupExtendedAttributeKey cStringUsingEncoding:NSUTF8StringEncoding], &value, sizeof(value), 0, 0) == 0);
            }
        }
    }

    if (ok) {
        return [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
    } else {
        return [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR];
    }
}

/* remove the file or directory (recursively)
 * IN:
 * NSString* fullPath - the full path to the file or directory to be removed
 * NSString* callbackId
 * called from remove and removeRecursively - check all pubic api specific error conditions (dir not empty, etc) before calling
 */

- (CDVPluginResult*)doRemove:(NSString*)fullPath
{
    CDVPluginResult* result = nil;
    BOOL bSuccess = NO;
    NSError* __autoreleasing pError = nil;
    NSFileManager* fileMgr = [[NSFileManager alloc] init];

    @try {
        bSuccess = [fileMgr removeItemAtPath:fullPath error:&pError];
        if (bSuccess) {
            result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
        } else {
            // see if we can give a useful error
            CDVFileError errorCode = ABORT_ERR;
            NSLog(@"error removing filesystem entry at %@: %@", fullPath, [pError localizedDescription]);
            if ([pError code] == NSFileNoSuchFileError) {
                errorCode = NOT_FOUND_ERR;
            } else if ([pError code] == NSFileWriteNoPermissionError) {
                errorCode = NO_MODIFICATION_ALLOWED_ERR;
            }

            result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:errorCode];
        }
    } @catch(NSException* e) {  // NSInvalidArgumentException if path is . or ..
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsInt:SYNTAX_ERR];
    }

    return result;
}

- (CDVPluginResult *)removeFileAtURL:(CDVFilesystemURL *)localURI
{
    NSString *fileSystemPath = [self fileSystemPathForURL:localURI];

    NSFileManager* fileMgr = [[NSFileManager alloc] init];
    BOOL bIsDir = NO;
    BOOL bExists = [fileMgr fileExistsAtPath:fileSystemPath isDirectory:&bIsDir];
    if (!bExists) {
        return [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:NOT_FOUND_ERR];
    }
    if (bIsDir && ([[fileMgr contentsOfDirectoryAtPath:fileSystemPath error:nil] count] != 0)) {
        // dir is not empty
        return [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:INVALID_MODIFICATION_ERR];
    }
    return [self doRemove:fileSystemPath];
}

- (CDVPluginResult *)recursiveRemoveFileAtURL:(CDVFilesystemURL *)localURI
{
    NSString *fileSystemPath = [self fileSystemPathForURL:localURI];
    return [self doRemove:fileSystemPath];
}

/*
 * IN
 *  NSString localURI
 * OUT
 *  NSString full local filesystem path for the represented file or directory, or nil if no such path is possible
 *  The file or directory does not necessarily have to exist. nil is returned if the filesystem type is not recognized,
 *  or if the URL is malformed.
 * The incoming URI should be properly escaped (no raw spaces, etc. URI percent-encoding is expected).
 */
- (NSString *)fullPathForFileSystemPath:(NSString *)fsPath
{
    if ([fsPath hasPrefix:self.fsRoot]) {
        return [fsPath substringFromIndex:[self.fsRoot length]];
    }
    return nil;
}


- (CDVPluginResult *)readEntriesAtURL:(CDVFilesystemURL *)localURI
{
    NSFileManager* fileMgr = [[NSFileManager alloc] init];
    NSError* __autoreleasing error = nil;
    NSString *fileSystemPath = [self fileSystemPathForURL:localURI];

    NSArray* contents = [fileMgr contentsOfDirectoryAtPath:fileSystemPath error:&error];

    if (contents) {
        NSMutableArray* entries = [NSMutableArray arrayWithCapacity:1];
        if ([contents count] > 0) {
            // create an Entry (as JSON) for each file/dir
            for (NSString* name in contents) {
                // see if is dir or file
                NSString* entryPath = [fileSystemPath stringByAppendingPathComponent:name];
                BOOL bIsDir = NO;
                [fileMgr fileExistsAtPath:entryPath isDirectory:&bIsDir];
                NSDictionary* entryDict = [self makeEntryForPath:[self fullPathForFileSystemPath:entryPath] fileSystem:localURI.fileSystemType isDirectory:bIsDir];
                [entries addObject:entryDict];
            }
        }
        return [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsArray:entries];
    } else {
        // assume not found but could check error for more specific error conditions
        return [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:NOT_FOUND_ERR];
    }
}

- (unsigned long long)truncateFile:(NSString*)filePath atPosition:(unsigned long long)pos
{
    unsigned long long newPos = 0UL;

    NSFileHandle* file = [NSFileHandle fileHandleForWritingAtPath:filePath];

    if (file) {
        [file truncateFileAtOffset:(unsigned long long)pos];
        newPos = [file offsetInFile];
        [file synchronizeFile];
        [file closeFile];
    }
    return newPos;
}

- (CDVPluginResult *)truncateFileAtURL:(CDVFilesystemURL *)localURI atPosition:(unsigned long long)pos
{
    unsigned long long newPos = [self truncateFile:[self fileSystemPathForURL:localURI] atPosition:pos];
    return [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsInt:newPos];
}

- (CDVPluginResult *)writeToFileAtURL:(CDVFilesystemURL *)localURL withData:(NSData*)encData append:(BOOL)shouldAppend
{
    NSString *filePath = [self fileSystemPathForURL:localURL];

    CDVPluginResult* result = nil;
    CDVFileError errCode = INVALID_MODIFICATION_ERR;
    int bytesWritten = 0;

    if (filePath) {
        NSOutputStream* fileStream = [NSOutputStream outputStreamToFileAtPath:filePath append:shouldAppend];
        if (fileStream) {
            NSUInteger len = [encData length];
            [fileStream open];

            bytesWritten = [fileStream write:[encData bytes] maxLength:len];

            [fileStream close];
            if (bytesWritten > 0) {
                result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsInt:bytesWritten];
                // } else {
                // can probably get more detailed error info via [fileStream streamError]
                // errCode already set to INVALID_MODIFICATION_ERR;
                // bytesWritten = 0; // may be set to -1 on error
            }
        } // else fileStream not created return INVALID_MODIFICATION_ERR
    } else {
        // invalid filePath
        errCode = NOT_FOUND_ERR;
    }
    if (!result) {
        // was an error
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsInt:errCode];
    }
    return result;
}

/**
 * Helper function to check to see if the user attempted to copy an entry into its parent without changing its name,
 * or attempted to copy a directory into a directory that it contains directly or indirectly.
 *
 * IN:
 *  NSString* srcDir
 *  NSString* destinationDir
 * OUT:
 *  YES copy/ move is allows
 *  NO move is onto itself
 */
- (BOOL)canCopyMoveSrc:(NSString*)src ToDestination:(NSString*)dest
{
    // This weird test is to determine if we are copying or moving a directory into itself.
    // Copy /Documents/myDir to /Documents/myDir-backup is okay but
    // Copy /Documents/myDir to /Documents/myDir/backup not okay
    BOOL copyOK = YES;
    NSRange range = [dest rangeOfString:src];

    if (range.location != NSNotFound) {
        NSRange testRange = {range.length - 1, ([dest length] - range.length)};
        NSRange resultRange = [dest rangeOfString:@"/" options:0 range:testRange];
        if (resultRange.location != NSNotFound) {
            copyOK = NO;
        }
    }
    return copyOK;
}

- (void)copyFileToURL:(CDVFilesystemURL *)destURL withName:(NSString *)newName fromFileSystem:(NSObject<CDVFileSystem> *)srcFs atURL:(CDVFilesystemURL *)srcURL copy:(BOOL)bCopy callback:(void (^)(CDVPluginResult *))callback
{
    NSFileManager *fileMgr = [[NSFileManager alloc] init];
    NSString *destRootPath = [self fileSystemPathForURL:destURL];
    BOOL bDestIsDir = NO;
    BOOL bDestExists = [fileMgr fileExistsAtPath:destRootPath isDirectory:&bDestIsDir];

    NSString *newFileSystemPath = [destRootPath stringByAppendingPathComponent:newName];
    NSString *newFullPath = [self fullPathForFileSystemPath:newFileSystemPath];

    BOOL bNewIsDir = NO;
    BOOL bNewExists = [fileMgr fileExistsAtPath:newFileSystemPath isDirectory:&bNewIsDir];

    CDVPluginResult *result = nil;
    int errCode = 0;

    if (!bDestExists) {
        // the destination root does not exist
        errCode = NOT_FOUND_ERR;
    }

    else if ([srcFs isKindOfClass:[CDVLocalFilesystem class]]) {
        /* Same FS, we can shortcut with NSFileManager operations */
        NSString *srcFullPath = [self fileSystemPathForURL:srcURL];

        BOOL bSrcIsDir = NO;
        BOOL bSrcExists = [fileMgr fileExistsAtPath:srcFullPath isDirectory:&bSrcIsDir];

        if (!bSrcExists) {
            // the source does not exist
            errCode = NOT_FOUND_ERR;
        } else if ([newFileSystemPath isEqualToString:srcFullPath]) {
            // source and destination can not be the same
            errCode = INVALID_MODIFICATION_ERR;
        } else if (bSrcIsDir && (bNewExists && !bNewIsDir)) {
            // can't copy/move dir to file
            errCode = INVALID_MODIFICATION_ERR;
        } else { // no errors yet
            NSError* __autoreleasing error = nil;
            BOOL bSuccess = NO;
            if (bCopy) {
                if (bSrcIsDir && ![self canCopyMoveSrc:srcFullPath ToDestination:newFileSystemPath]) {
                    // can't copy dir into self
                    errCode = INVALID_MODIFICATION_ERR;
                } else if (bNewExists) {
                    // the full destination should NOT already exist if a copy
                    errCode = PATH_EXISTS_ERR;
                } else {
                    bSuccess = [fileMgr copyItemAtPath:srcFullPath toPath:newFileSystemPath error:&error];
                }
            } else { // move
                // iOS requires that destination must not exist before calling moveTo
                // is W3C INVALID_MODIFICATION_ERR error if destination dir exists and has contents
                //
                if (!bSrcIsDir && (bNewExists && bNewIsDir)) {
                    // can't move a file to directory
                    errCode = INVALID_MODIFICATION_ERR;
                } else if (bSrcIsDir && ![self canCopyMoveSrc:srcFullPath ToDestination:newFileSystemPath]) {
                    // can't move a dir into itself
                    errCode = INVALID_MODIFICATION_ERR;
                } else if (bNewExists) {
                    if (bNewIsDir && ([[fileMgr contentsOfDirectoryAtPath:newFileSystemPath error:NULL] count] != 0)) {
                        // can't move dir to a dir that is not empty
                        errCode = INVALID_MODIFICATION_ERR;
                        newFileSystemPath = nil;  // so we won't try to move
                    } else {
                        // remove destination so can perform the moveItemAtPath
                        bSuccess = [fileMgr removeItemAtPath:newFileSystemPath error:NULL];
                        if (!bSuccess) {
                            errCode = INVALID_MODIFICATION_ERR; // is this the correct error?
                            newFileSystemPath = nil;
                        }
                    }
                } else if (bNewIsDir && [newFileSystemPath hasPrefix:srcFullPath]) {
                    // can't move a directory inside itself or to any child at any depth;
                    errCode = INVALID_MODIFICATION_ERR;
                    newFileSystemPath = nil;
                }

                if (newFileSystemPath != nil) {
                    bSuccess = [fileMgr moveItemAtPath:srcFullPath toPath:newFileSystemPath error:&error];
                }
            }
            if (bSuccess) {
                // should verify it is there and of the correct type???
                NSDictionary* newEntry = [self makeEntryForPath:newFullPath fileSystem:srcURL.fileSystemType isDirectory:bSrcIsDir];  // should be the same type as source
                result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsDictionary:newEntry];
            } else {
                if (error) {
                    if (([error code] == NSFileReadUnknownError) || ([error code] == NSFileReadTooLargeError)) {
                        errCode = NOT_READABLE_ERR;
                    } else if ([error code] == NSFileWriteOutOfSpaceError) {
                        errCode = QUOTA_EXCEEDED_ERR;
                    } else if ([error code] == NSFileWriteNoPermissionError) {
                        errCode = NO_MODIFICATION_ALLOWED_ERR;
                    }
                }
            }
        }
    } else {
        // Need to copy the hard way
        [srcFs readFileAtURL:srcURL start:0 end:-1 callback:^(NSData* data, NSString* mimeType, CDVFileError errorCode) {
            CDVPluginResult* result = nil;
            if (data != nil) {
                BOOL bSuccess = [data writeToFile:newFileSystemPath atomically:YES];
                if (bSuccess) {
                    // should verify it is there and of the correct type???
                    NSDictionary* newEntry = [self makeEntryForPath:newFullPath fileSystem:destURL.fileSystemType isDirectory:NO];
                    result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsDictionary:newEntry];
                } else {
                    result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:ABORT_ERR];
                }
            } else {
                result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:errorCode];
            }
            callback(result);
        }];
        return; // Async IO; return without callback.
    }
    if (result == nil) {
        if (!errCode) {
            errCode = INVALID_MODIFICATION_ERR; // Catch-all default
        }
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:errCode];
    }
    callback(result);
}

/* helper function to get the mimeType from the file extension
 * IN:
 *	NSString* fullPath - filename (may include path)
 * OUT:
 *	NSString* the mime type as type/subtype.  nil if not able to determine
 */
+ (NSString*)getMimeTypeFromPath:(NSString*)fullPath
{
    NSString* mimeType = nil;

    if (fullPath) {
        CFStringRef typeId = UTTypeCreatePreferredIdentifierForTag(kUTTagClassFilenameExtension, (__bridge CFStringRef)[fullPath pathExtension], NULL);
        if (typeId) {
            mimeType = (__bridge_transfer NSString*)UTTypeCopyPreferredTagWithClass(typeId, kUTTagClassMIMEType);
            if (!mimeType) {
                // special case for m4a
                if ([(__bridge NSString*)typeId rangeOfString : @"m4a-audio"].location != NSNotFound) {
                    mimeType = @"audio/mp4";
                } else if ([[fullPath pathExtension] rangeOfString:@"wav"].location != NSNotFound) {
                    mimeType = @"audio/wav";
                }
            }
            CFRelease(typeId);
        }
    }
    return mimeType;
}

- (void)readFileAtURL:(CDVFilesystemURL *)localURL start:(NSInteger)start end:(NSInteger)end callback:(void (^)(NSData*, NSString* mimeType, CDVFileError))callback
{
    NSString *path = [self fileSystemPathForURL:localURL];

    NSString* mimeType = [CDVLocalFilesystem getMimeTypeFromPath:path];
    if (mimeType == nil) {
        mimeType = @"*/*";
    }
    NSFileHandle* file = [NSFileHandle fileHandleForReadingAtPath:path];
    if (start > 0) {
        [file seekToFileOffset:start];
    }

    NSData* readData;
    if (end < 0) {
        readData = [file readDataToEndOfFile];
    } else {
        readData = [file readDataOfLength:(end - start)];
    }
    [file closeFile];

    callback(readData, mimeType, readData != nil ? NO_ERROR : NOT_FOUND_ERR);
}

- (void)getFileMetadataForURL:(CDVFilesystemURL *)localURL callback:(void (^)(CDVPluginResult *))callback
{
    NSString *path = [self fileSystemPathForURL:localURL];
        NSFileManager* fileMgr = [[NSFileManager alloc] init];
        BOOL bIsDir = NO;
        // make sure it exists and is not a directory
        BOOL bExists = [fileMgr fileExistsAtPath:path isDirectory:&bIsDir];
        if (!bExists || bIsDir) {
            callback([CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:NOT_FOUND_ERR]);
        } else {
            // create dictionary of file info
            NSError* __autoreleasing error = nil;
            NSDictionary* fileAttrs = [fileMgr attributesOfItemAtPath:path error:&error];
            NSMutableDictionary* fileInfo = [NSMutableDictionary dictionaryWithCapacity:5];
            [fileInfo setObject:[NSNumber numberWithUnsignedLongLong:[fileAttrs fileSize]] forKey:@"size"];
            [fileInfo setObject:localURL.fullPath forKey:@"fullPath"];
            [fileInfo setObject:@"" forKey:@"type"];  // can't easily get the mimetype unless create URL, send request and read response so skipping
            [fileInfo setObject:[path lastPathComponent] forKey:@"name"];
            NSDate* modDate = [fileAttrs fileModificationDate];
            NSNumber* msDate = [NSNumber numberWithDouble:[modDate timeIntervalSince1970] * 1000];
            [fileInfo setObject:msDate forKey:@"lastModifiedDate"];
            callback([CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsDictionary:fileInfo]);
        }
}

@end

@interface CDVAssetLibraryFilesystem : NSObject<CDVFileSystem> {
}
@end

@implementation CDVAssetLibraryFilesystem
- (CDVPluginResult *)entryForLocalURI:(CDVFilesystemURL *)url
{
    NSDictionary* fileSystem = [self makeEntryForPath:[url.url absoluteString] fileSystem:ASSETS_LIBRARY isDirectory:NO];
    return [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsDictionary:fileSystem];
}

- (NSDictionary*)makeEntryForPath:(NSString*)fullPath fileSystem:(int)fsType isDirectory:(BOOL)isDir
{
    NSMutableDictionary* dirEntry = [NSMutableDictionary dictionaryWithCapacity:5];
    NSString* lastPart = [fullPath lastPathComponent];
    if (isDir && ![fullPath hasSuffix:@"/"]) {
        fullPath = [fullPath stringByAppendingString:@"/"];
    }
    [dirEntry setObject:[NSNumber numberWithBool:!isDir]  forKey:@"isFile"];
    [dirEntry setObject:[NSNumber numberWithBool:isDir]  forKey:@"isDirectory"];
    [dirEntry setObject:fullPath forKey:@"fullPath"];
    [dirEntry setObject:lastPart forKey:@"name"];
    [dirEntry setObject: [NSNumber numberWithInt:fsType] forKey: @"filesystem"];

    return dirEntry;
}

- (CDVPluginResult *)getFileForURL:(CDVFilesystemURL *)baseURI requestedPath:(NSString *)requestedPath options:(NSDictionary *)options
{
    // return unsupported result for assets-library URLs
   return [CDVPluginResult resultWithStatus:CDVCommandStatus_MALFORMED_URL_EXCEPTION messageAsString:@"getFile not supported for assets-library URLs."];
}

- (CDVPluginResult*)getParentForURL:(CDVFilesystemURL *)localURI
{
    // we don't (yet?) support getting the parent of an asset
    return [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:NOT_READABLE_ERR];
}

- (void)getMetadataForURL:(CDVFilesystemURL *)url callback:(void (^)(CDVPluginResult *))callback
{
    __block CDVPluginResult* result = nil;

    // In this case, we need to use an asynchronous method to retrieve the file.
    // Because of this, we can't just assign to `result` and send it at the end of the method.
    // Instead, we return after calling the asynchronous method and send `result` in each of the blocks.
    ALAssetsLibraryAssetForURLResultBlock resultBlock = ^(ALAsset* asset) {
        if (asset) {
            // We have the asset!  Retrieve the metadata and send it off.
            NSDate* date = [asset valueForProperty:ALAssetPropertyDate];
            result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsDouble:[date timeIntervalSince1970] * 1000];
            callback(result);
        } else {
            // We couldn't find the asset.  Send the appropriate error.
            result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:NOT_FOUND_ERR];
            callback(result);
        }
    };
    // TODO(maxw): Consider making this a class variable since it's the same every time.
    ALAssetsLibraryAccessFailureBlock failureBlock = ^(NSError* error) {
        // Retrieving the asset failed for some reason.  Send the appropriate error.
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsString:[error localizedDescription]];
        callback(result);
    };

    ALAssetsLibrary* assetsLibrary = [[ALAssetsLibrary alloc] init];
    [assetsLibrary assetForURL:url.url resultBlock:resultBlock failureBlock:failureBlock];
    return;
}

- (CDVPluginResult*)setMetadataForURL:(CDVFilesystemURL *)localURI withObject:(NSDictionary *)options
{
    // setMetadata doesn't make sense for asset library files
    return [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR];
}

- (CDVPluginResult *)removeFileAtURL:(CDVFilesystemURL *)localURI
{
    // return error for assets-library URLs
    return [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:INVALID_MODIFICATION_ERR];
}

- (CDVPluginResult *)recursiveRemoveFileAtURL:(CDVFilesystemURL *)localURI
{
    // return error for assets-library URLs
    return [CDVPluginResult resultWithStatus:CDVCommandStatus_MALFORMED_URL_EXCEPTION messageAsString:@"removeRecursively not supported for assets-library URLs."];
}

- (CDVPluginResult *)readEntriesAtURL:(CDVFilesystemURL *)localURI
{
    // return unsupported result for assets-library URLs
    return [CDVPluginResult resultWithStatus:CDVCommandStatus_MALFORMED_URL_EXCEPTION messageAsString:@"readEntries not supported for assets-library URLs."];
}

- (CDVPluginResult *)truncateFileAtURL:(CDVFilesystemURL *)localURI atPosition:(unsigned long long)pos
{
    // assets-library files can't be truncated
    return [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:NO_MODIFICATION_ALLOWED_ERR];
}

- (CDVPluginResult *)writeToFileAtURL:(CDVFilesystemURL *)localURL withData:(NSData*)encData append:(BOOL)shouldAppend
{
    // text can't be written into assets-library files
    return [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:NO_MODIFICATION_ALLOWED_ERR];
}

- (void)copyFileToURL:(CDVFilesystemURL *)destURL withName:(NSString *)newName fromFileSystem:(NSObject<CDVFileSystem> *)srcFs atURL:(CDVFilesystemURL *)srcURL copy:(BOOL)bCopy callback:(void (^)(CDVPluginResult *))callback
{
    // Copying to an assets library file is not doable, since we can't write it.
    CDVPluginResult *result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:INVALID_MODIFICATION_ERR];
    callback(result);
}

- (NSString *)fileSystemPathForURL:(CDVFilesystemURL *)url
{
    NSString *path = nil;
    if ([[url.url scheme] isEqualToString:kCDVAssetsLibraryScheme]) {
        path = [url.url path];
    } else {
       path = url.fullPath;
    }
    if ([path hasSuffix:@"/"]) {
      path = [path substringToIndex:([path length]-1)];
    }
    return path;
}

- (void)readFileAtURL:(CDVFilesystemURL *)localURL start:(NSInteger)start end:(NSInteger)end callback:(void (^)(NSData*, NSString* mimeType, CDVFileError))callback
{
    NSString *path = [self fileSystemPathForURL:localURL];

    ALAssetsLibraryAssetForURLResultBlock resultBlock = ^(ALAsset* asset) {
        if (asset) {
            // We have the asset!  Get the data and send it off.
            ALAssetRepresentation* assetRepresentation = [asset defaultRepresentation];
            Byte* buffer = (Byte*)malloc([assetRepresentation size]);
            NSUInteger bufferSize = [assetRepresentation getBytes:buffer fromOffset:0.0 length:[assetRepresentation size] error:nil];
            NSData* data = [NSData dataWithBytesNoCopy:buffer length:bufferSize freeWhenDone:YES];
            NSString* MIMEType = (__bridge_transfer NSString*)UTTypeCopyPreferredTagWithClass((__bridge CFStringRef)[assetRepresentation UTI], kUTTagClassMIMEType);

            callback(data, MIMEType, NO_ERROR);
        } else {
            callback(nil, nil, NOT_FOUND_ERR);
        }
    };

    ALAssetsLibraryAccessFailureBlock failureBlock = ^(NSError* error) {
        // Retrieving the asset failed for some reason.  Send the appropriate error.
        NSLog(@"Error: %@", error);
        callback(nil, nil, SECURITY_ERR);
    };

    ALAssetsLibrary* assetsLibrary = [[ALAssetsLibrary alloc] init];
    [assetsLibrary assetForURL:[NSURL URLWithString:path] resultBlock:resultBlock failureBlock:failureBlock];
}

- (void)getFileMetadataForURL:(CDVFilesystemURL *)localURL callback:(void (^)(CDVPluginResult *))callback
{
    NSString *path = [self fileSystemPathForURL:localURL];

    // In this case, we need to use an asynchronous method to retrieve the file.
    // Because of this, we can't just assign to `result` and send it at the end of the method.
    // Instead, we return after calling the asynchronous method and send `result` in each of the blocks.
    ALAssetsLibraryAssetForURLResultBlock resultBlock = ^(ALAsset* asset) {
        if (asset) {
            // We have the asset!  Populate the dictionary and send it off.
            NSMutableDictionary* fileInfo = [NSMutableDictionary dictionaryWithCapacity:5];
            ALAssetRepresentation* assetRepresentation = [asset defaultRepresentation];
            [fileInfo setObject:[NSNumber numberWithUnsignedLongLong:[assetRepresentation size]] forKey:@"size"];
            [fileInfo setObject:localURL.fullPath forKey:@"fullPath"];
            NSString* filename = [assetRepresentation filename];
            [fileInfo setObject:filename forKey:@"name"];
            [fileInfo setObject:[CDVLocalFilesystem getMimeTypeFromPath:filename] forKey:@"type"];
            NSDate* creationDate = [asset valueForProperty:ALAssetPropertyDate];
            NSNumber* msDate = [NSNumber numberWithDouble:[creationDate timeIntervalSince1970] * 1000];
            [fileInfo setObject:msDate forKey:@"lastModifiedDate"];

            callback([CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsDictionary:fileInfo]);
        } else {
            // We couldn't find the asset.  Send the appropriate error.
            callback([CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:NOT_FOUND_ERR]);
        }
    };
    ALAssetsLibraryAccessFailureBlock failureBlock = ^(NSError* error) {
        // Retrieving the asset failed for some reason.  Send the appropriate error.
        callback([CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsString:[error localizedDescription]]);
    };

    ALAssetsLibrary* assetsLibrary = [[ALAssetsLibrary alloc] init];
    [assetsLibrary assetForURL:[NSURL URLWithString:path] resultBlock:resultBlock failureBlock:failureBlock];
    return;
}
@end

@interface CDVFilesystemURLProtocol : NSURLProtocol
@end

@implementation CDVFilesystemURLProtocol

NSString* const kCDVFilesystemURLPrefix = @"filesystem";

+ (BOOL)canInitWithRequest:(NSURLRequest*)request
{
    NSURL* url = [request URL];
    return [[url scheme] isEqualToString:kCDVFilesystemURLPrefix];
}

+ (NSURLRequest*)canonicalRequestForRequest:(NSURLRequest*)request
{
    return request;
}

+ (BOOL)requestIsCacheEquivalent:(NSURLRequest*)requestA toRequest:(NSURLRequest*)requestB
{
    return [[[requestA URL] resourceSpecifier] isEqualToString:[[requestB URL] resourceSpecifier]];
}

- (void)startLoading
{
    CDVFilesystemURL* url = [CDVFilesystemURL fileSystemURLWithURL:[[self request] URL]];
    CDVLocalFilesystem *fs = [filePlugin.fileSystems objectAtIndex:url.fileSystemType];
    [fs readFileAtURL:url start:0 end:-1 callback:^void(NSData *data, NSString *mimetype, CDVFileError error) {
        if (!error) {
            NSURLResponse *response = [[NSHTTPURLResponse alloc] initWithURL:url.url statusCode:200 HTTPVersion:@"HTTP/1.1"headerFields:@{@"Content-Type": mimetype}];
            [[self client] URLProtocol:self didReceiveResponse:response cacheStoragePolicy:NSURLCacheStorageNotAllowed];
            [[self client] URLProtocol:self didLoadData:data];
            [[self client] URLProtocolDidFinishLoading:self];
        } else {
            NSURLResponse *response = [[NSHTTPURLResponse alloc] initWithURL:url.url statusCode:404 HTTPVersion:@"HTTP/1.1"headerFields:@{}];
            [[self client] URLProtocol:self didReceiveResponse:response cacheStoragePolicy:NSURLCacheStorageNotAllowed];
            [[self client] URLProtocolDidFinishLoading:self];
        }
    }];
}

- (void)stopLoading
{
    // do any cleanup here
}

@end


@implementation CDVFile

@synthesize appDocsPath, appLibraryPath, appTempPath, persistentPath, temporaryPath, userHasAllowed, fileSystems=fileSystems_;

- (id)initWithWebView:(UIWebView*)theWebView
{
    self = (CDVFile*)[super initWithWebView:theWebView];
    if (self) {
        filePlugin = self;
        [NSURLProtocol registerClass:[CDVFilesystemURLProtocol class]];

        fileSystems_ = [[NSMutableArray alloc] initWithCapacity:3];

        // get the temporary directory path
        NSArray* paths = NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES);
        self.appLibraryPath = [paths objectAtIndex:0];

        self.appTempPath = [NSTemporaryDirectory()stringByStandardizingPath];   // remove trailing slash from NSTemporaryDirectory()

        [fileSystems_ addObject:[[CDVLocalFilesystem alloc] initWithName:@"temporary" root:[paths objectAtIndex:0]]];

        // get the documents directory path
        paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
        self.appDocsPath = [paths objectAtIndex:0];

        [fileSystems_ addObject:[[CDVLocalFilesystem alloc] initWithName:@"persistent" root:[paths objectAtIndex:0]]];

        self.persistentPath = [NSString stringWithFormat:@"/%@", [self.appDocsPath lastPathComponent]];
        self.temporaryPath = [NSString stringWithFormat:@"/%@", [self.appTempPath lastPathComponent]];
        // NSLog(@"docs: %@ - temp: %@", self.appDocsPath, self.appTempPath);
    }

    return self;
}


- (NSNumber*)checkFreeDiskSpace:(NSString*)appPath
{
    NSFileManager* fMgr = [[NSFileManager alloc] init];

    NSError* __autoreleasing pError = nil;

    NSDictionary* pDict = [fMgr attributesOfFileSystemForPath:appPath error:&pError];
    NSNumber* pNumAvail = (NSNumber*)[pDict objectForKey:NSFileSystemFreeSize];

    return pNumAvail;
}

/* Request the File System info
 *
 * IN:
 * arguments[0] - type (number as string)
 *	TEMPORARY = 0, PERSISTENT = 1;
 * arguments[1] - size
 *
 * OUT:
 *	Dictionary representing FileSystem object
 *		name - the human readable directory name
 *		root = DirectoryEntry object
 *			bool isDirectory
 *			bool isFile
 *			string name
 *			string fullPath
 *			fileSystem = FileSystem object - !! ignored because creates circular reference !!
 */

- (void)requestFileSystem:(CDVInvokedUrlCommand*)command
{
    NSArray* arguments = command.arguments;

    // arguments
    NSString* strType = [arguments objectAtIndex:0];
    unsigned long long size = [[arguments objectAtIndex:1] longLongValue];

    int type = [strType intValue];
    CDVPluginResult* result = nil;

    if (type > 1) {
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsInt:NOT_FOUND_ERR];
        NSLog(@"iOS only supports TEMPORARY and PERSISTENT file systems");
    } else {
        NSString* fullPath = @"/";
        // check for avail space for size request
        NSNumber* pNumAvail = [self checkFreeDiskSpace:fullPath];
        // NSLog(@"Free space: %@", [NSString stringWithFormat:@"%qu", [ pNumAvail unsignedLongLongValue ]]);
        if (pNumAvail && ([pNumAvail unsignedLongLongValue] < size)) {
            result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:QUOTA_EXCEEDED_ERR];
        } else {
            NSMutableDictionary* fileSystem = [NSMutableDictionary dictionaryWithCapacity:2];
            [fileSystem setObject:(type == TEMPORARY ? kW3FileTemporary : kW3FilePersistent) forKey:@"name"];
            NSDictionary* dirEntry = [self makeEntryForPath:fullPath fileSystem:type isDirectory:YES];
            [fileSystem setObject:dirEntry forKey:@"root"];
            result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsDictionary:fileSystem];
        }
    }
    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

/* Creates and returns a dictionary representing an Entry Object
 *
 * IN:
 * NSString* fullPath of the entry
 * int fsType - FileSystem type
 * BOOL isDirectory - YES if this is a directory, NO if is a file
 * OUT:
 * NSDictionary* Entry object
 *		bool as NSNumber isDirectory
 *		bool as NSNumber isFile
 *		NSString*  name - last part of path
 *		NSString* fullPath
 *		filesystem = FileSystem type -- actual filesystem will be created on the JS side if necessary, to avoid
 *         creating circular reference (FileSystem contains DirectoryEntry which contains FileSystem.....!!)
 */
- (NSDictionary*)makeEntryForPath:(NSString*)fullPath fileSystem:(int)fsType isDirectory:(BOOL)isDir
{
    NSMutableDictionary* dirEntry = [NSMutableDictionary dictionaryWithCapacity:5];
    NSString* lastPart = [fullPath lastPathComponent];
    if (isDir && ![fullPath hasSuffix:@"/"]) {
        fullPath = [fullPath stringByAppendingString:@"/"];
    }
    [dirEntry setObject:[NSNumber numberWithBool:!isDir]  forKey:@"isFile"];
    [dirEntry setObject:[NSNumber numberWithBool:isDir]  forKey:@"isDirectory"];
    [dirEntry setObject:fullPath forKey:@"fullPath"];
    [dirEntry setObject:lastPart forKey:@"name"];
    [dirEntry setObject: [NSNumber numberWithInt:fsType] forKey: @"filesystem"];

    return dirEntry;
}

/*
 * Given a URI determine the File System information associated with it and return an appropriate W3C entry object
 * IN
 *	NSString* localURI: Should be an escaped local filesystem URI
 * OUT
 *	Entry object
 *		bool isDirectory
 *		bool isFile
 *		string name
 *		string fullPath
 *		fileSystem = FileSystem object - !! ignored because creates circular reference FileSystem contains DirectoryEntry which contains FileSystem.....!!
 */
- (void)resolveLocalFileSystemURI:(CDVInvokedUrlCommand*)command
{
    // arguments
    CDVFilesystemURL* inputURI = [CDVFilesystemURL fileSystemURLWithString:[command.arguments objectAtIndex:0]];
    CDVPluginResult* result;
    if (inputURI.fileSystemType == -1) {
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsInt:ENCODING_ERR];
    } else {
        CDVLocalFilesystem *fs = [self.fileSystems objectAtIndex:inputURI.fileSystemType];
        result = [fs entryForLocalURI:inputURI];
    }
    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}


/* Part of DirectoryEntry interface,  creates or returns the specified directory
 * IN:
 *	NSString* localURI - local filesystem URI for this directory
 *	NSString* path - directory to be created/returned; may be full path or relative path
 *	NSDictionary* - Flags object
 *		boolean as NSNumber create -
 *			if create is true and directory does not exist, create dir and return directory entry
 *			if create is true and exclusive is true and directory does exist, return error
 *			if create is false and directory does not exist, return error
 *			if create is false and the path represents a file, return error
 *		boolean as NSNumber exclusive - used in conjunction with create
 *			if exclusive is true and create is true - specifies failure if directory already exists
 *
 *
 */
- (void)getDirectory:(CDVInvokedUrlCommand*)command
{
    NSMutableArray* arguments = [NSMutableArray arrayWithArray:command.arguments];
    NSMutableDictionary* options = nil;

    if ([arguments count] >= 3) {
        options = [arguments objectAtIndex:2 withDefault:nil];
    }
    // add getDir to options and call getFile()
    if (options != nil) {
        options = [NSMutableDictionary dictionaryWithDictionary:options];
    } else {
        options = [NSMutableDictionary dictionaryWithCapacity:1];
    }
    [options setObject:[NSNumber numberWithInt:1] forKey:@"getDir"];
    if ([arguments count] >= 3) {
        [arguments replaceObjectAtIndex:2 withObject:options];
    } else {
        [arguments addObject:options];
    }
    CDVInvokedUrlCommand* subCommand =
        [[CDVInvokedUrlCommand alloc] initWithArguments:arguments
                                             callbackId:command.callbackId
                                              className:command.className
                                             methodName:command.methodName];

    [self getFile:subCommand];
}

/* Part of DirectoryEntry interface,  creates or returns the specified file
 * IN:
 *	NSString* baseURI - local filesytem URI for the base directory to search
 *	NSString* requestedPath - file to be created/returned; may be absolute path or relative path
 *	NSDictionary* options - Flags object
 *		boolean as NSNumber create -
 *			if create is true and file does not exist, create file and return File entry
 *			if create is true and exclusive is true and file does exist, return error
 *			if create is false and file does not exist, return error
 *			if create is false and the path represents a directory, return error
 *		boolean as NSNumber exclusive - used in conjunction with create
 *			if exclusive is true and create is true - specifies failure if file already exists
 */
- (void)getFile:(CDVInvokedUrlCommand*)command
{
    NSString* baseURIstr = [command.arguments objectAtIndex:0];
    CDVFilesystemURL* baseURI = [CDVFilesystemURL fileSystemURLWithString:baseURIstr];
    NSString* requestedPath = [command.arguments objectAtIndex:1];
    NSDictionary* options = [command.arguments objectAtIndex:2 withDefault:nil];

    CDVLocalFilesystem *fs = [self.fileSystems objectAtIndex:baseURI.fileSystemType];
    CDVPluginResult* result = [fs getFileForURL:baseURI requestedPath:requestedPath options:options];


    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

/*
 * Look up the parent Entry containing this Entry.
 * If this Entry is the root of its filesystem, its parent is itself.
 * IN:
 * NSArray* arguments
 *	0 - NSString* localURI
 * NSMutableDictionary* options
 *	empty
 */
- (void)getParent:(CDVInvokedUrlCommand*)command
{
    // arguments are URL encoded
    CDVFilesystemURL* localURI = [CDVFilesystemURL fileSystemURLWithString:[command.arguments objectAtIndex:0]];

    CDVLocalFilesystem *fs = [self.fileSystems objectAtIndex:localURI.fileSystemType];
    CDVPluginResult* result = [fs getParentForURL:localURI];

    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

/*
 * get MetaData of entry
 * Currently MetaData only includes modificationTime.
 */
- (void)getMetadata:(CDVInvokedUrlCommand*)command
{
    // arguments
    NSString* localURIstr = [command.arguments objectAtIndex:0];
    CDVFilesystemURL* localURI = [CDVFilesystemURL fileSystemURLWithString:localURIstr];
    CDVLocalFilesystem *fs = [self.fileSystems objectAtIndex:localURI.fileSystemType];
    [fs getMetadataForURL:localURI callback:^(CDVPluginResult* result) {
        [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
    }];

}

/*
 * set MetaData of entry
 * Currently we only support "com.apple.MobileBackup" (boolean)
 */
- (void)setMetadata:(CDVInvokedUrlCommand*)command
{
    // arguments
    CDVFilesystemURL* localURI = [CDVFilesystemURL fileSystemURLWithString:[command.arguments objectAtIndex:0]];
    NSDictionary* options = [command.arguments objectAtIndex:1 withDefault:nil];
    CDVLocalFilesystem *fs = [self.fileSystems objectAtIndex:localURI.fileSystemType];
    CDVPluginResult* result = [fs setMetadataForURL:localURI withObject:options];

    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

/* removes the directory or file entry
 * IN:
 * NSArray* arguments
 *	0 - NSString* localURI
 *
 * returns NO_MODIFICATION_ALLOWED_ERR  if is top level directory or no permission to delete dir
 * returns INVALID_MODIFICATION_ERR if is non-empty dir or asset library file
 * returns NOT_FOUND_ERR if file or dir is not found
*/
- (void)remove:(CDVInvokedUrlCommand*)command
{
    // arguments
    CDVFilesystemURL* localURI = [CDVFilesystemURL fileSystemURLWithString:[command.arguments objectAtIndex:0]];
    CDVPluginResult* result = nil;

    if ([localURI.fullPath isEqualToString:@""]) {
        // error if try to remove top level (documents or tmp) dir
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:NO_MODIFICATION_ALLOWED_ERR];
    } else {
        CDVLocalFilesystem *fs = [self.fileSystems objectAtIndex:localURI.fileSystemType];
        result = [fs removeFileAtURL:localURI];
    }
    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

/* recursively removes the directory
 * IN:
 * NSArray* arguments
 *	0 - NSString* localURI
 *
 * returns NO_MODIFICATION_ALLOWED_ERR  if is top level directory or no permission to delete dir
 * returns NOT_FOUND_ERR if file or dir is not found
 */
- (void)removeRecursively:(CDVInvokedUrlCommand*)command
{
    // arguments
    CDVFilesystemURL* localURI = [CDVFilesystemURL fileSystemURLWithString:[command.arguments objectAtIndex:0]];
    CDVPluginResult* result = nil;

    if ([localURI.fullPath isEqualToString:@""]) {
        // error if try to remove top level (documents or tmp) dir
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:NO_MODIFICATION_ALLOWED_ERR];
    } else {
        CDVLocalFilesystem *fs = [self.fileSystems objectAtIndex:localURI.fileSystemType];
        result = [fs recursiveRemoveFileAtURL:localURI];
    }
    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

- (void)copyTo:(CDVInvokedUrlCommand*)command
{
    [self doCopyMove:command isCopy:YES];
}

- (void)moveTo:(CDVInvokedUrlCommand*)command
{
    [self doCopyMove:command isCopy:NO];
}

/* Copy/move a file or directory to a new location
 * IN:
 * NSArray* arguments
 *	0 - NSString* URL of entry to copy
 *  1 - NSString* URL of the directory into which to copy/move the entry
 *  2 - Optionally, the new name of the entry, defaults to the current name
 *	BOOL - bCopy YES if copy, NO if move
 */
- (void)doCopyMove:(CDVInvokedUrlCommand*)command isCopy:(BOOL)bCopy
{
    NSArray* arguments = command.arguments;

    // arguments
    NSString* srcURLstr = [arguments objectAtIndex:0];
    NSString* destURLstr = [arguments objectAtIndex:1];

    CDVPluginResult *result;

    if (!srcURLstr || !destURLstr) {
        // either no source or no destination provided
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:NOT_FOUND_ERR];
        [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
        return;
    }

    CDVFilesystemURL* srcURL = [CDVFilesystemURL fileSystemURLWithString:srcURLstr];
    CDVFilesystemURL* destURL = [CDVFilesystemURL fileSystemURLWithString:destURLstr];

    CDVLocalFilesystem *srcFs = [self.fileSystems objectAtIndex:srcURL.fileSystemType];
    CDVLocalFilesystem *destFs = [self.fileSystems objectAtIndex:destURL.fileSystemType];

    // optional argument; use last component from srcFullPath if new name not provided
    NSString* newName = ([arguments count] > 2) ? [arguments objectAtIndex:2] : [srcURL.url lastPathComponent];
    if ([newName rangeOfString:@":"].location != NSNotFound) {
        // invalid chars in new name
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:ENCODING_ERR];
        [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
        return;
    }

    [destFs copyFileToURL:destURL withName:newName fromFileSystem:srcFs atURL:srcURL copy:bCopy callback:^(CDVPluginResult* result) {
        [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
    }];

}

- (void)getFileMetadata:(CDVInvokedUrlCommand*)command
{
    // arguments
    NSString* localURIstr = [command.arguments objectAtIndex:0];
    CDVFilesystemURL* localURI = [CDVFilesystemURL fileSystemURLWithString:localURIstr];
    CDVLocalFilesystem *fs = [self.fileSystems objectAtIndex:localURI.fileSystemType];

    [fs getFileMetadataForURL:localURI callback:^(CDVPluginResult* result) {
        [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
    }];
}

- (void)readEntries:(CDVInvokedUrlCommand*)command
{
    CDVFilesystemURL* localURI = [CDVFilesystemURL fileSystemURLWithString:[command.arguments objectAtIndex:0]];
    CDVLocalFilesystem *fs = [self.fileSystems objectAtIndex:localURI.fileSystemType];
    CDVPluginResult *result = [fs readEntriesAtURL:localURI];

    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

/* read and return file data
 * IN:
 * NSArray* arguments
 *	0 - NSString* fullPath
 *	1 - NSString* encoding
 *	2 - NSString* start
 *	3 - NSString* end
 */
- (void)readAsText:(CDVInvokedUrlCommand*)command
{
    // arguments
    CDVFilesystemURL* localURI = [CDVFilesystemURL fileSystemURLWithString:[command argumentAtIndex:0]];
    NSString* encoding = [command argumentAtIndex:1];
    NSInteger start = [[command argumentAtIndex:2] integerValue];
    NSInteger end = [[command argumentAtIndex:3] integerValue];

    CDVLocalFilesystem *fs = [self.fileSystems objectAtIndex:localURI.fileSystemType];

    // TODO: implement
    if ([@"UTF-8" caseInsensitiveCompare : encoding] != NSOrderedSame) {
        NSLog(@"Only UTF-8 encodings are currently supported by readAsText");
        CDVPluginResult* result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:ENCODING_ERR];
        [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
        return;
    }

    [self.commandDelegate runInBackground:^ {
        [fs readFileAtURL:localURI start:start end:end callback:^(NSData* data, NSString* mimeType, CDVFileError errorCode) {
            CDVPluginResult* result = nil;
            if (data != nil) {
                NSString* str = [[NSString alloc] initWithBytesNoCopy:(void*)[data bytes] length:[data length] encoding:NSUTF8StringEncoding freeWhenDone:NO];
                // Check that UTF8 conversion did not fail.
                if (str != nil) {
                    result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsString:str];
                    result.associatedObject = data;
                } else {
                    errorCode = ENCODING_ERR;
                }
            }
            if (result == nil) {
                result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:errorCode];
            }

            [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
        }];
    }];
}

/* Read content of text file and return as base64 encoded data url.
 * IN:
 * NSArray* arguments
 *	0 - NSString* fullPath
 *	1 - NSString* start
 *	2 - NSString* end
 *
 * Determines the mime type from the file extension, returns ENCODING_ERR if mimetype can not be determined.
 */

- (void)readAsDataURL:(CDVInvokedUrlCommand*)command
{
    CDVFilesystemURL* localURI = [CDVFilesystemURL fileSystemURLWithString:[command argumentAtIndex:0]];
    NSInteger start = [[command argumentAtIndex:1] integerValue];
    NSInteger end = [[command argumentAtIndex:2] integerValue];

    CDVLocalFilesystem *fs = [self.fileSystems objectAtIndex:localURI.fileSystemType];

    [self.commandDelegate runInBackground:^ {
        [fs readFileAtURL:localURI start:start end:end callback:^(NSData* data, NSString* mimeType, CDVFileError errorCode) {
            CDVPluginResult* result = nil;
            if (data != nil) {
                // TODO: Would be faster to base64 encode directly to the final string.
                NSString* output = [NSString stringWithFormat:@"data:%@;base64,%@", mimeType, [data base64EncodedString]];
                result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsString:output];
            } else {
                result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:errorCode];
            }

            [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
        }];
    }];
}

/* Read content of text file and return as an arraybuffer
 * IN:
 * NSArray* arguments
 *	0 - NSString* fullPath
 *	1 - NSString* start
 *	2 - NSString* end
 */

- (void)readAsArrayBuffer:(CDVInvokedUrlCommand*)command
{
    CDVFilesystemURL* localURI = [CDVFilesystemURL fileSystemURLWithString:[command argumentAtIndex:0]];
    NSInteger start = [[command argumentAtIndex:1] integerValue];
    NSInteger end = [[command argumentAtIndex:2] integerValue];

    CDVLocalFilesystem *fs = [self.fileSystems objectAtIndex:localURI.fileSystemType];

    [self.commandDelegate runInBackground:^ {
        [fs readFileAtURL:localURI start:start end:end callback:^(NSData* data, NSString* mimeType, CDVFileError errorCode) {
            CDVPluginResult* result = nil;
            if (data != nil) {
                result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsArrayBuffer:data];
            } else {
                result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:errorCode];
            }

            [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
        }];
    }];
}

- (void)readAsBinaryString:(CDVInvokedUrlCommand*)command
{
    CDVFilesystemURL* localURI = [CDVFilesystemURL fileSystemURLWithString:[command argumentAtIndex:0]];
    NSInteger start = [[command argumentAtIndex:1] integerValue];
    NSInteger end = [[command argumentAtIndex:2] integerValue];

    CDVLocalFilesystem *fs = [self.fileSystems objectAtIndex:localURI.fileSystemType];

    [self.commandDelegate runInBackground:^ {
        [fs readFileAtURL:localURI start:start end:end callback:^(NSData* data, NSString* mimeType, CDVFileError errorCode) {
            CDVPluginResult* result = nil;
            if (data != nil) {
                NSString* payload = [[NSString alloc] initWithBytesNoCopy:(void*)[data bytes] length:[data length] encoding:NSASCIIStringEncoding freeWhenDone:NO];
                result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsString:payload];
                result.associatedObject = data;
            } else {
                result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:errorCode];
            }

            [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
        }];
    }];
}


- (void)truncate:(CDVInvokedUrlCommand*)command
{
    // arguments
    CDVFilesystemURL* localURI = [CDVFilesystemURL fileSystemURLWithString:[command argumentAtIndex:0]];
    unsigned long long pos = (unsigned long long)[[command.arguments objectAtIndex:1] longLongValue];

    CDVLocalFilesystem *fs = [self.fileSystems objectAtIndex:localURI.fileSystemType];
    CDVPluginResult *result = [fs truncateFileAtURL:localURI atPosition:pos];

    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

/* write
 * IN:
 * NSArray* arguments
 *  0 - NSString* localURI of file to write to
 *  1 - NSString* or NSData* data to write
 *  2 - NSNumber* position to begin writing
 */
- (void)write:(CDVInvokedUrlCommand*)command
{
    NSString* callbackId = command.callbackId;
    NSArray* arguments = command.arguments;

    // arguments
    NSString* localURIstr = [arguments objectAtIndex:0];
    CDVFilesystemURL* localURI = [CDVFilesystemURL fileSystemURLWithString:localURIstr];
    id argData = [arguments objectAtIndex:1];
    unsigned long long pos = (unsigned long long)[[arguments objectAtIndex:2] longLongValue];

    CDVLocalFilesystem *fs = [self.fileSystems objectAtIndex:localURI.fileSystemType];


    [fs truncateFileAtURL:localURI atPosition:pos];
    CDVPluginResult *result;
    if ([argData isKindOfClass:[NSString class]]) {
        NSData *encData = [argData dataUsingEncoding:NSUTF8StringEncoding allowLossyConversion:YES];
        result = [fs writeToFileAtURL:localURI withData:encData append:YES];
    } else if ([argData isKindOfClass:[NSData class]]) {
        result = [fs writeToFileAtURL:localURI withData:argData append:YES];
    } else {
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Invalid parameter type"];
    }
    [self.commandDelegate sendPluginResult:result callbackId:callbackId];

}

#pragma mark Undocumented Filesystem API

- (void)testFileExists:(CDVInvokedUrlCommand*)command
{
    // arguments
    NSString* argPath = [command.arguments objectAtIndex:0];

    // Get the file manager
    NSFileManager* fMgr = [NSFileManager defaultManager];
    NSString* appFile = argPath; // [ self getFullPath: argPath];

    BOOL bExists = [fMgr fileExistsAtPath:appFile];
    CDVPluginResult* result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsInt:(bExists ? 1 : 0)];

    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

- (void)testDirectoryExists:(CDVInvokedUrlCommand*)command
{
    // arguments
    NSString* argPath = [command.arguments objectAtIndex:0];

    // Get the file manager
    NSFileManager* fMgr = [[NSFileManager alloc] init];
    NSString* appFile = argPath; // [self getFullPath: argPath];
    BOOL bIsDir = NO;
    BOOL bExists = [fMgr fileExistsAtPath:appFile isDirectory:&bIsDir];

    CDVPluginResult* result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsInt:((bExists && bIsDir) ? 1 : 0)];

    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

// Returns number of bytes available via callback
- (void)getFreeDiskSpace:(CDVInvokedUrlCommand*)command
{
    // no arguments

    NSNumber* pNumAvail = [self checkFreeDiskSpace:self.appDocsPath];

    NSString* strFreeSpace = [NSString stringWithFormat:@"%qu", [pNumAvail unsignedLongLongValue]];
    // NSLog(@"Free space is %@", strFreeSpace );

    CDVPluginResult* result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsString:strFreeSpace];

    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

@end
