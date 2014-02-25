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

#import <Cordova/CDV.h>
#import "CDVFile.h"
#import "CDVLocalFilesystem.h"
#import "CDVAssetLibraryFilesystem.h"

CDVFile *filePlugin = nil;

extern NSString * const NSURLIsExcludedFromBackupKey __attribute__((weak_import));

#ifndef __IPHONE_5_1
    NSString* const NSURLIsExcludedFromBackupKey = @"NSURLIsExcludedFromBackupKey";
#endif

NSString* const kCDVFilesystemURLPrefix = @"cdvfile";

@implementation CDVFilesystemURL
@synthesize url=_url;
@synthesize fileSystemName=_fileSystemName;
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
        _fileSystemName = [self filesystemNameForLocalURI:URL];
        _fullPath = [self fullPathForLocalURI:URL];
    }
    return self;
}

/*
 * IN
 *  NSString localURI
 * OUT
 *  NSString FileSystem Name for this URI, or nil if it is not recognized.
 */
- (NSString *)filesystemNameForLocalURI:(NSURL *)uri
{
    if ([[uri scheme] isEqualToString:kCDVFilesystemURLPrefix] && [[uri host] isEqualToString:@"localhost"]) {
        NSArray *pathComponents = [uri pathComponents];
        if (pathComponents != nil && pathComponents.count > 1) {
            return [pathComponents objectAtIndex:1];
        }
    } else if ([[uri scheme] isEqualToString:kCDVAssetsLibraryScheme]) {
        return @"assets-library";
    }
    return nil;
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
    if ([[uri scheme] isEqualToString:kCDVFilesystemURLPrefix] && [[uri host] isEqualToString:@"localhost"]) {
        NSString *path = [uri path];
        if ([uri query]) {
            path = [NSString stringWithFormat:@"%@?%@", path, [uri query]];
        }
        NSRange slashRange = [path rangeOfString:@"/" options:0 range:NSMakeRange(1, path.length-1)];
        if (slashRange.location == NSNotFound) {
            return @"";
        }
        return [path substringFromIndex:slashRange.location];
    } else if ([[uri scheme] isEqualToString:kCDVAssetsLibraryScheme]) {
        return [[uri absoluteString] substringFromIndex:[kCDVAssetsLibraryScheme length]+2];
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

- (NSString *)absoluteURL
{
    return [NSString stringWithFormat:@"cdvfile://localhost/%@%@", self.fileSystemName, self.fullPath];
}

@end

@implementation CDVFilesystemURLProtocol

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
    NSObject<CDVFileSystem> *fs = [filePlugin filesystemForURL:url];
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

@synthesize rootDocsPath, appDocsPath, appLibraryPath, appTempPath, userHasAllowed, fileSystems=fileSystems_;

- (void)registerFilesystem:(NSObject<CDVFileSystem> *)fs {
    [fileSystems_ addObject:fs];
}

- (NSObject<CDVFileSystem> *)fileSystemByName:(NSString *)fsName
{
    if (self.fileSystems != nil) {
        for (NSObject<CDVFileSystem> *fs in self.fileSystems) {
            if ([fs.name isEqualToString:fsName]) {
                return fs;
            }
        }
    }
    return nil;

}

- (NSObject<CDVFileSystem> *)filesystemForURL:(CDVFilesystemURL *)localURL {
    if (localURL.fileSystemName == nil) return nil;
    @try {
        return [self fileSystemByName:localURL.fileSystemName];
    }
    @catch (NSException *e) {
        return nil;
    }
}

@synthesize viewController=_viewController;
- (void)setViewController:(UIViewController *)newViewController
{
    if (_viewController != newViewController) {
        _viewController = newViewController;

        NSString *location = nil;
        if([_viewController isKindOfClass:[CDVViewController class]]) {
            CDVViewController *vc = (CDVViewController *)_viewController;
            NSMutableDictionary *settings = vc.settings;
            location = [[settings objectForKey:@"iospersistentfilelocation"] lowercaseString];
        }
        if (location == nil) {
            // Compatibilty by default (if the config preference is not set, or
            // if we're not embedded in a CDVViewController somehow.)
            location = @"compatibility";
        }

        NSError *error;
        if ([[NSFileManager defaultManager] createDirectoryAtPath:self.appTempPath
                                      withIntermediateDirectories:YES
                                                       attributes:nil
                                                            error:&error]) {
            [self registerFilesystem:[[CDVLocalFilesystem alloc] initWithName:@"temporary" root:self.appTempPath]];
        } else {
            NSLog(@"Unable to create temporary directory: %@", error);
        }
        if ([location isEqualToString:@"library"]) {
            if ([[NSFileManager defaultManager] createDirectoryAtPath:self.appLibraryPath
                                          withIntermediateDirectories:YES
                                                           attributes:nil
                                                                error:&error]) {
                [self registerFilesystem:[[CDVLocalFilesystem alloc] initWithName:@"persistent" root:self.appLibraryPath]];
            } else {
                NSLog(@"Unable to create library directory: %@", error);
            }
        } else if ([location isEqualToString:@"compatibility"]) {
            /*
             *  Fall-back to compatibility mode -- this is the logic implemented in
             *  earlier versions of this plugin, and should be maintained here so
             *  that apps which were originally deployed with older versions of the
             *  plugin can continue to provide access to files stored under those
             *  versions.
             */
            [self registerFilesystem:[[CDVLocalFilesystem alloc] initWithName:@"persistent" root:self.rootDocsPath]];
        } else {
            NSAssert(false,
                @"File plugin configuration error: Please set iosPersistentFileLocation in config.xml to one of \"library\" (for new applications) or \"compatibility\" (for compatibility with previous versions)");
        }
        [self registerFilesystem:[[CDVAssetLibraryFilesystem alloc] initWithName:@"assets-library"]];
    }
}


- (id)initWithWebView:(UIWebView*)theWebView
{
    self = (CDVFile*)[super initWithWebView:theWebView];
    if (self) {
        filePlugin = self;
        [NSURLProtocol registerClass:[CDVFilesystemURLProtocol class]];

        fileSystems_ = [[NSMutableArray alloc] initWithCapacity:3];

        // Get the Library directory path
        NSArray* paths = NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES);
        self.appLibraryPath = [[paths objectAtIndex:0] stringByAppendingPathComponent:@"files"];

        // Get the Temporary directory path
        self.appTempPath = [NSTemporaryDirectory()stringByStandardizingPath];   // remove trailing slash from NSTemporaryDirectory()

        // Get the Documents directory path
        paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
        self.rootDocsPath = [paths objectAtIndex:0];
        self.appDocsPath = [self.rootDocsPath stringByAppendingPathComponent:@"files"];

    }

    return self;
}

- (CDVFilesystemURL *)fileSystemURLforLocalPath:(NSString *)localPath
{
    CDVFilesystemURL *localURL = nil;
    NSUInteger shortestFullPath = 0;

    // Try all installed filesystems, in order. Return the most match url.
    for (id object in self.fileSystems) {
        if ([object respondsToSelector:@selector(URLforFilesystemPath:)]) {
            CDVFilesystemURL *url = [object URLforFilesystemPath:localPath];
            if (url){
                // A shorter fullPath would imply that the filesystem is a better match for the local path
                if (!localURL || ([[url fullPath] length] < shortestFullPath)) {
                    localURL = url;
                    shortestFullPath = [[url fullPath] length];
                }
            }
        }
    }
    return localURL;
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

    if (type > self.fileSystems.count) {
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsInt:NOT_FOUND_ERR];
        NSLog(@"No filesystem of type requested");
    } else {
        NSString* fullPath = @"/";
        // check for avail space for size request
        NSNumber* pNumAvail = [self checkFreeDiskSpace:fullPath];
        // NSLog(@"Free space: %@", [NSString stringWithFormat:@"%qu", [ pNumAvail unsignedLongLongValue ]]);
        if (pNumAvail && ([pNumAvail unsignedLongLongValue] < size)) {
            result = [CDVPluginResult resultWithStatus:CDVCommandStatus_IO_EXCEPTION messageAsInt:QUOTA_EXCEEDED_ERR];
        } else {
            NSObject<CDVFileSystem> *rootFs = [self.fileSystems objectAtIndex:type];
            if (rootFs == nil) {
                result = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsInt:NOT_FOUND_ERR];
                NSLog(@"No filesystem of type requested");
            } else {
                NSMutableDictionary* fileSystem = [NSMutableDictionary dictionaryWithCapacity:2];
                [fileSystem setObject:rootFs.name forKey:@"name"];
                NSDictionary* dirEntry = [self makeEntryForPath:fullPath fileSystemName:rootFs.name isDirectory:YES];
                [fileSystem setObject:dirEntry forKey:@"root"];
                result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsDictionary:fileSystem];
            }
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
 *		NSString* filesystemName - FileSystem name -- actual filesystem will be created on the JS side if necessary, to avoid
 *         creating circular reference (FileSystem contains DirectoryEntry which contains FileSystem.....!!)
 */
- (NSDictionary*)makeEntryForPath:(NSString*)fullPath fileSystemName:(NSString *)fsName isDirectory:(BOOL)isDir
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
    [dirEntry setObject: [NSNumber numberWithInt:([fsName isEqualToString:@"temporary"] ? 0 : 1)] forKey: @"filesystem"];
    [dirEntry setObject:fsName forKey: @"filesystemName"];
    return dirEntry;
}

- (NSDictionary *)makeEntryForLocalURL:(CDVFilesystemURL *)localURL
{
    NSObject<CDVFileSystem> *fs = [self filesystemForURL:localURL];
    return [fs makeEntryForLocalURL:localURL];
}

- (NSDictionary *)makeEntryForURL:(NSURL *)URL
{
    CDVFilesystemURL *fsURL = [CDVFilesystemURL fileSystemURLWithURL:URL];
    return [self makeEntryForLocalURL:fsURL];
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
    NSString* localURIstr = [command.arguments objectAtIndex:0];
    CDVPluginResult* result;
    CDVFilesystemURL* inputURI;
    
    /* Backwards-compatibility: Check for file:// urls */
    if ([localURIstr hasPrefix:@"file://"]) {
        /* This looks like a file url. Get the path, and see if any handlers recognize it. */
        NSString* path;
        NSRange questionMark = [localURIstr rangeOfString:@"?"];
        if (questionMark.location == NSNotFound) {
            path = [localURIstr substringFromIndex:7];
        } else {
            path = [localURIstr substringWithRange:NSMakeRange(7,questionMark.location-7)];
        }
        inputURI = [self fileSystemURLforLocalPath:path];
    } else {
        inputURI = [CDVFilesystemURL fileSystemURLWithString:localURIstr];
    }
    if (inputURI != nil && inputURI.fileSystemName == nil) {
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsInt:ENCODING_ERR];
    } else {
        NSObject<CDVFileSystem> *fs = [self filesystemForURL:inputURI];
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

    NSObject<CDVFileSystem> *fs = [self filesystemForURL:baseURI];
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

    NSObject<CDVFileSystem> *fs = [self filesystemForURL:localURI];
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
    NSObject<CDVFileSystem> *fs = [self filesystemForURL:localURI];
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
    NSObject<CDVFileSystem> *fs = [self filesystemForURL:localURI];
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
        NSObject<CDVFileSystem> *fs = [self filesystemForURL:localURI];
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
        NSObject<CDVFileSystem> *fs = [self filesystemForURL:localURI];
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

    NSObject<CDVFileSystem> *srcFs = [self filesystemForURL:srcURL];
    NSObject<CDVFileSystem> *destFs = [self filesystemForURL:destURL];

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
    NSObject<CDVFileSystem> *fs = [self filesystemForURL:localURI];

    [fs getFileMetadataForURL:localURI callback:^(CDVPluginResult* result) {
        [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
    }];
}

- (void)readEntries:(CDVInvokedUrlCommand*)command
{
    CDVFilesystemURL* localURI = [CDVFilesystemURL fileSystemURLWithString:[command.arguments objectAtIndex:0]];
    NSObject<CDVFileSystem> *fs = [self filesystemForURL:localURI];
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

    NSObject<CDVFileSystem> *fs = [self filesystemForURL:localURI];

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

    NSObject<CDVFileSystem> *fs = [self filesystemForURL:localURI];

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

    NSObject<CDVFileSystem> *fs = [self filesystemForURL:localURI];

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

    NSObject<CDVFileSystem> *fs = [self filesystemForURL:localURI];

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

    NSObject<CDVFileSystem> *fs = [self filesystemForURL:localURI];
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

    NSObject<CDVFileSystem> *fs = [self filesystemForURL:localURI];


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

#pragma mark Methods for converting between URLs and paths

- (NSString *)filesystemPathForURL:(CDVFilesystemURL *)localURL
{
    for (NSObject<CDVFileSystem> *fs in self.fileSystems) {
        if ([fs.name isEqualToString:localURL.fileSystemName]) {
            if ([fs respondsToSelector:@selector(filesystemPathForURL:)]) {
                return [fs filesystemPathForURL:localURL];
            }
        }
    }
    return nil;
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

#pragma mark Compatibility with older File API

- (NSString*)getMimeTypeFromPath:(NSString*)fullPath
{
    return [CDVLocalFilesystem getMimeTypeFromPath:fullPath];
}

- (NSDictionary *)getDirectoryEntry:(NSString *)localPath isDirectory:(BOOL)bDirRequest
{
    CDVFilesystemURL *localURL = [self fileSystemURLforLocalPath:localPath];
    return [self makeEntryForPath:localURL.fullPath fileSystemName:localURL.fileSystemName isDirectory:bDirRequest];
}

#pragma mark Internal methods for testing
// Internal methods for testing: Get the on-disk location of a local filesystem url.
// [Currently used for testing file-transfer]

- (void)_getLocalFilesystemPath:(CDVInvokedUrlCommand*)command
{
    NSString* localURLstr = [command.arguments objectAtIndex:0];
    CDVFilesystemURL* localURL = [CDVFilesystemURL fileSystemURLWithString:localURLstr];

    NSString* fsPath = [self filesystemPathForURL:localURL];
    CDVPluginResult* result;
    if (fsPath) {
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsString:fsPath];
    } else {
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Cannot resolve URL to a file"];
    }
    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

@end
