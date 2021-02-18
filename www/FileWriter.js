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

var exec = require('cordova/exec');
var FileError = require('./FileError');
var FileReader = require('./FileReader');
var ProgressEvent = require('./ProgressEvent');

/**
 * This class writes to the mobile device file system.
 *
 * For Android:
 *      The root directory is the root of the file system.
 *      To write to the SD card, the file name is "sdcard/my_file.txt"
 *
 * @constructor
 * @param file {File} File object containing file properties
 * @param append if true write to the end of the file, otherwise overwrite the file
 */
var FileWriter = function (file) {
    this.fileName = '';
    this.length = 0;
    if (file) {
        this.localURL = file.localURL || file;
        this.length = file.size || 0;
    }
    // default is to write at the beginning of the file
    this.position = 0;

    this.readyState = 0; // EMPTY

    this.result = null;

    // Error
    this.error = null;

    // Event handlers
    // When writing starts
    this.onwritestart = null;

    // While writing the file, and reporting partial file data
    this.onprogress = null;

    // When the write has successfully completed.
    this.onwrite = null;

    // When the request has completed (either in success or failure).
    this.onwriteend = null;

    // When the write has been aborted. For instance, by invoking the abort() method.
    this.onabort = null;

    // When the write has failed (see errors).
    this.onerror = null;
};

// States
FileWriter.INIT = 0;
FileWriter.WRITING = 1;
FileWriter.DONE = 2;

/**
 * Abort writing file.
 */
FileWriter.prototype.abort = function () {
    // check for invalid state
    if (this.readyState === FileWriter.DONE || this.readyState === FileWriter.INIT) {
        throw new FileError(FileError.INVALID_STATE_ERR);
    }

    // set error
    this.error = new FileError(FileError.ABORT_ERR);

    this.readyState = FileWriter.DONE;

    // If abort callback
    if (typeof this.onabort === 'function') {
        this.onabort(new ProgressEvent('abort', { target: this }));
    }

    // If write end callback
    if (typeof this.onwriteend === 'function') {
        this.onwriteend(new ProgressEvent('writeend', { target: this }));
    }
};

/**
 * Writes data to the file
 *
 * @param data File, String, Blob or ArrayBuffer to be written
 * @param isPendingBlobReadResult {Boolean} true if the data is the pending blob read operation result
 */
FileWriter.prototype.write = function (data, isPendingBlobReadResult) {
    var me = this;
    var supportsBinary = (typeof window.Blob !== 'undefined' && typeof window.ArrayBuffer !== 'undefined');
    /* eslint-disable no-undef */
    var isProxySupportBlobNatively = (cordova.platformId === 'windows8' || cordova.platformId === 'windows');
    var isBinary;

    if (data instanceof File) {
        turnFileOrBlobIntoArrayBufferOrStringAndCallWrite.call(me, data, supportsBinary);
        return;
    } else if ((!isProxySupportBlobNatively && supportsBinary && data instanceof Blob)) {
        turnFileOrBlobIntoArrayBufferOrStringAndCallWrite.call(me, data, supportsBinary);
        return;
    }

    // Mark data type for safer transport over the binary bridge
    isBinary = supportsBinary && (data instanceof ArrayBuffer);
    if (isBinary && cordova.platformId === 'windowsphone') { // eslint-disable-line no-undef
        // create a plain array, using the keys from the Uint8Array view so that we can serialize it
        data = Array.apply(null, new Uint8Array(data));
    }

    throwExceptionIfWriteIsInProgress(this.readyState, isPendingBlobReadResult);

    this.readyState = FileWriter.WRITING;

    notifyOnWriteStartCallback.call(me);

    // do not use `isBinary` here, as the data might have been changed for windowsphone environment.
    if (supportsBinary && (data instanceof ArrayBuffer) && cordova.platformId === 'android') {
        writeBase64EncodedStringInChunks.call(
            me,
            function () {
                // do not change position and length here, they have been updated while writing chunks
                onSuccessfulChunkedWrite.call(me);
            },
            function writeError (error) {
                // TODO, should we try to "undo" the writing that has happened up until now?
                me.readyState = FileWriter.DONE;

                me.error = error;

                notifyOnErrorCallback.call(me);

                notifyOnWriteEndCallback.call(me);
            },
            data
        );
    } else {
        execFileWrite.call(me, data, isBinary);
    }
};

function writeBase64EncodedStringInChunks (successCallback, errorCallback, arrayBuffer) {
    var me = this;
    var chunkSizeBytes = 1024 * 1024; // 1MiB chunks
    var startOfChunk = 0;
    var sizeOfChunk = 0;
    var endOfChunk = 0;

    function convertCurrentChunkToBase64AndWriteToDisk () {
        turnArrayBufferIntoBase64EncodedString(
            writeConvertedChunk,
            errorCallback,
            arrayBuffer.slice(startOfChunk, endOfChunk)
        );
    }

    function writeConvertedChunk (base64EncodedChunk) {
        execChunkedWrite.call(
            me,
            wroteChunk,
            errorCallback,
            base64EncodedChunk
        );
    }

    function wroteChunk (bytesWritten) {
        // we need to keep track of the current position, so we do not override the same position over and over again.
        onBytesWritten.call(me, bytesWritten);
        goToNextChunk();

        if (startOfChunk < arrayBuffer.byteLength) {
            calculateCurrentChunk();
            convertCurrentChunkToBase64AndWriteToDisk();
        } else {
            successCallback();
        }
    }

    function goToNextChunk () {
        startOfChunk += chunkSizeBytes;
    }

    function calculateCurrentChunk () {
        sizeOfChunk = Math.min(chunkSizeBytes, arrayBuffer.byteLength - startOfChunk);
        endOfChunk = startOfChunk + sizeOfChunk;

        console.log('size of chunk', sizeOfChunk);
        console.log('endOfChunk', endOfChunk);
    }

    calculateCurrentChunk();
    convertCurrentChunkToBase64AndWriteToDisk();
}

function throwExceptionIfWriteIsInProgress (readyState, isPendingBlobReadResult) {
    if (readyState === FileWriter.WRITING && !isPendingBlobReadResult) {
        throw new FileError(FileError.INVALID_STATE_ERR);
    }
}

function turnArrayBufferIntoBase64EncodedString (successCallback, errorCallback, arrayBuffer) {
    var fileReader = new FileReader();
    /* eslint-enable no-undef */
    fileReader.onload = function () {
        var withoutPrefix = removeBase64Prefix(this.result);
        successCallback(withoutPrefix);
    };
    fileReader.onerror = function () {
        errorCallback(this.error);
    };

    // it is important to mark this as 'application/octet-binary', otherwise you
    // might not get a base64 encoding the binary data.
    fileReader.readAsDataURL(
        // eslint-disable-next-line no-undef
        new Blob([arrayBuffer], {
            type: 'application/octet-binary'
        })
    );
}

function removeBase64Prefix (base64EncodedString) {
    var indexOfComma = base64EncodedString.indexOf(',');
    if (indexOfComma > 0) {
        return base64EncodedString.substr(indexOfComma + 1);
    } else {
        return base64EncodedString;
    }
}

function execChunkedWrite (successCallback, errorCallback, base64EncodedChunk) {
    var me = this;
    exec(
        successCallback,
        errorCallback,
        'File',
        'write',
        [
            me.localURL,
            base64EncodedChunk,
            me.position,
            true
        ]
    );
}

function execFileWrite (data, isBinary) {
    var me = this;
    exec(
        function (bytesWritten) {
            onSuccessfulWrite.call(me, bytesWritten);
        },
        // Error callback
        function (error) {
            errorCallback.call(me, error);
        },
        'File',
        'write',
        [
            this.localURL,
            data,
            this.position,
            isBinary
        ]
    );
}

function onSuccessfulChunkedWrite () {
    var me = this;
    // If DONE (cancelled), then don't do anything
    if (me.readyState === FileWriter.DONE) {
        return;
    }

    // DONE state
    me.readyState = FileWriter.DONE;

    notifyOnWriteCallback.call(me);

    notifyOnWriteEndCallback.call(me);
}

function onSuccessfulWrite (bytesWritten) {
    var me = this;
    // If DONE (cancelled), then don't do anything
    if (me.readyState === FileWriter.DONE) {
        return;
    }

    onBytesWritten.call(me, bytesWritten);

    // DONE state
    me.readyState = FileWriter.DONE;

    notifyOnWriteCallback.call(me);

    notifyOnWriteEndCallback.call(me);
}

function onBytesWritten (bytesWritten) {
    var me = this;
    console.log('bytes written', bytesWritten);

    // position always increases by bytes written because file would be extended
    me.position += bytesWritten;

    // The length of the file is now where we are done writing.
    me.length = me.position;
    console.log('position', me.position);
}

/**
 * Read the data source, which can either be a File or a Blob.
 * The data is read as an ArrayBuffer, if `supportsBinary` is `true`.
 * The data is read as a string otherwise.
 *
 * The read data is then passed to FileWriter.prototype.write.
 *
 * @param fileOrBlob Is either a File or Blob object.
 * @param supportsBinary Is a boolean that should be set depending on if ArrayBuffer and Blob are supported by the environment.
 */
function turnFileOrBlobIntoArrayBufferOrStringAndCallWrite (fileOrBlob, supportsBinary) {
    var me = this;
    var fileReader = new FileReader();
    /* eslint-enable no-undef */
    fileReader.onload = function () {
        // Call this method again, with the arraybuffer as argument
        FileWriter.prototype.write.call(me, this.result, true /* isPendingBlobReadResult */);
    };
    fileReader.onerror = function () {
        // DONE state
        me.readyState = FileWriter.DONE;

        // Save error
        me.error = this.error;

        notifyOnErrorCallback.call(me);

        notifyOnWriteEndCallback.call(me);
    };

    // WRITING state
    this.readyState = FileWriter.WRITING;

    if (supportsBinary) {
        fileReader.readAsArrayBuffer(fileOrBlob);
    } else {
        fileReader.readAsText(fileOrBlob);
    }
}

/**
 * Moves the file pointer to the location specified.
 *
 * If the offset is a negative number the position of the file
 * pointer is rewound.  If the offset is greater than the file
 * size the position is set to the end of the file.
 *
 * @param offset is the location to move the file pointer to.
 */
FileWriter.prototype.seek = function (offset) {
    // Throw an exception if we are already writing a file
    if (this.readyState === FileWriter.WRITING) {
        throw new FileError(FileError.INVALID_STATE_ERR);
    }

    if (!offset && offset !== 0) {
        return;
    }

    // See back from end of file.
    if (offset < 0) {
        this.position = Math.max(offset + this.length, 0);
    // Offset is bigger than file size so set position
    // to the end of the file.
    } else if (offset > this.length) {
        this.position = this.length;
    // Offset is between 0 and file size so set the position
    // to start writing.
    } else {
        this.position = offset;
    }
};

/**
 * Truncates the file to the size specified.
 *
 * @param size to chop the file at.
 */
FileWriter.prototype.truncate = function (size) {
    // Throw an exception if we are already writing a file
    if (this.readyState === FileWriter.WRITING) {
        throw new FileError(FileError.INVALID_STATE_ERR);
    }

    // WRITING state
    this.readyState = FileWriter.WRITING;

    var me = this;

    notifyOnWriteStartCallback.call(me);

    // Write file
    exec(
        // Success callback
        function (r) {
            // If DONE (cancelled), then don't do anything
            if (me.readyState === FileWriter.DONE) {
                return;
            }

            // DONE state
            me.readyState = FileWriter.DONE;

            // Update the length of the file
            me.length = r;
            me.position = Math.min(me.position, r);

            notifyOnWriteCallback.call(me);

            notifyOnWriteEndCallback.call(me);
        },
        // Error callback
        function (error) {
            errorCallback.call(me, error);
        },
        'File',
        'truncate',
        [
            this.localURL,
            size
        ]
    );
};

function errorCallback (error) {
    var me = this;
    // If DONE (cancelled), then don't do anything
    if (me.readyState === FileWriter.DONE) {
        return;
    }

    // DONE state
    me.readyState = FileWriter.DONE;

    // Save error
    me.error = new FileError(error);

    notifyOnErrorCallback.call(me);

    notifyOnWriteEndCallback.call(me);
}

function notifyOnErrorCallback () {
    var me = this;
    if (typeof me.onerror === 'function') {
        me.onerror(new ProgressEvent('error', { target: me }));
    }
}

function notifyOnWriteStartCallback () {
    var me = this;
    if (typeof me.onwritestart === 'function') {
        me.onwritestart(new ProgressEvent('writestart', { target: this }));
    }
}

function notifyOnWriteEndCallback () {
    var me = this;
    if (typeof me.onwriteend === 'function') {
        me.onwriteend(new ProgressEvent('writeend', { target: me }));
    }
}

function notifyOnWriteCallback () {
    var me = this;
    if (typeof me.onwrite === 'function') {
        me.onwrite(new ProgressEvent('write', { target: me }));
    }
}

module.exports = FileWriter;
