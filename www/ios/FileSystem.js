/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/
/* eslint no-undef : 0 */
FILESYSTEM_PROTOCOL = 'cdvfile';

module.exports = {
    __format__: function (fullPath, internalUrl) {
        // todo move to fileSystem like the toInternalUrl as above
        console.error('__format__', fullPath, internalUrl);
        var path = ('/' + this.name + (fullPath[0] === '/' ? '' : '/') + FileSystem.encodeURIPath(fullPath)).replace('//', '/');
        var cdvFilePath = FILESYSTEM_PROTOCOL + '://localhost' + path;

        if (cdvFilePath && window && window.WkWebView) { // https://github.com/apache/cordova-plugin-file/pull/457/commits/fea030f4e870ad7a2f07a8063c7da894ee9b2818
            var convertedFilePath =  window.WkWebView.convertFilePath(cdvFilePath);
            console.error('convertedFilePath', cdvFilePath, convertedFilePath);
            return convertedFilePath;
        }

        return cdvFilePath;
    }
};
