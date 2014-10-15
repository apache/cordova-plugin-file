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

// If ProgressEvent exists in global context, use it already, otherwise use our own polyfill
// Feature test: See if we can instantiate a native ProgressEvent;
// if so, use that approach,
// otherwise fill-in with our own implementation.
//
var ProgressEvent = (function(global)
{
  try
  {
    // Detect available ProgressEvent support
    (new global.ProgressEvent('load')).preventDefault();
    return(global.ProgressEvent);
  }
  catch(e)
  {
    // Part or all of implementation will need polyfilling
  }
  var nativeProgressEvent = global.ProgressEvent;
  var createProgressEvent;
  try
  {
    // Detect support for creating ProgressEvents via deprecated method
    document.createEvent('ProgressEvent');
    createProgressEvent = function() { return(document.createEvent('ProgressEvent')); };
  }
  catch(e)
  {
    // Polyfill ProgressEvent creation
    createProgressEvent = function()
    {
      var evt = document.createEvent('Event');
      evt.initProgressEvent = function(evtType, bubbles, cancelable, lengthComputable, loaded, total)
      {
        this.initEvent(evtType,bubbles,cancelable);
        this.lengthComputable = lengthComputable;
        this.loaded = loaded;
        this.total = total;
      };
      return(evt);
    };
  }
  
  // Create polyfill ProgressEvent
  var ProgressEvent = function(eventType, dict)
  {
    var evt = createProgressEvent();
    dict = dict || {};
    var bubbles = dict.bubbles || false;
    var cancelable = dict.cancelable || false;
    var lengthComputable = dict.lengthComputable || false;
    var loaded = dict.loaded || 0;
    var total = dict.total || 0;
    evt.initProgressEvent(eventType,bubbles,cancelable,lengthComputable,loaded,total);
    return(evt);
  };

  // Link polyfill ProgressEvent with Event prototype chain
  if (!(ProgressEvent.prototype = nativeProgressEvent && ProgressEvent.prototype))
  {
    try
    {
      ProgressEvent.prototype = Object.create(Event.prototype);
      ProgressEvent.prototype.constructor = ProgressEvent;
    }
    catch(e)
    {
      ProgressEvent.prototype = Event.prototype;
    }
  }
  return(ProgressEvent);
})(this);


// FileReader/FileWriter of Cordova file plugin need ProgressEvent creation to be wrapped to support target objects included in dictionary
module.exports = function(evtType, dict)
{
  var evt = new ProgressEvent(evtType,dict);
  if (dict && dict.target)
  {
    // Override target property if possible
    try
    {
      Object.defineProperty(evt,'target',{ get:function() { return(dict.target); }, set:function(value) { } });
    }
    catch(e)
    {
      // Some versions of Webkit (affecting iOS 6.x/7.x, BB 10.2.x) have native ProgressEvents with target being an unconfigurable property.  Wrap instead.
      var theWrapper = {};
      for(var attr in evt)
      {
        if (attr == 'target')
          Object.defineProperty(theWrapper,'target',{ get:function() { return(dict.target); }, set:function(value) {} });
        else if (typeof evt[attr] == 'function')
          theWrapper[attr] = (function(thisObject,functionName){ return(function() { return(thisObject[functionName].apply(thisObject,arguments)); }); })(evt,attr);
        else  // value
        {
          var origPropDesc = Object.getOwnPropertyDescriptor(evt,attr);
          if (origPropDesc)
          {
            var newPropDesc = { configurable:origPropDesc.configurable, enumerable:origPropDesc.enumerable };
            newPropDesc.get = (function(thisObject,attrName){ return(function() { return(thisObject[attrName]); }) })(evt,attr);
            if (origPropDesc.writable)
              newPropDesc.set = (function(thisObject,attrName){ return(function(value) { thisObject[attrName] = value; }) })(evt,attr);
            else
              newPropDesc.set = function() {};  // write-NOP
            Object.defineProperty(theWrapper,attr,newPropDesc);
          }
          else  // mimic with simple get/set handler
            Object.defineProperty(theWrapper,attr,{ get:function() { return(evt[attr]); }, set:function(val) { evt[attr] = val; } });
        }
      }
      return(theWrapper);
    }
  }
  return(evt);
};
