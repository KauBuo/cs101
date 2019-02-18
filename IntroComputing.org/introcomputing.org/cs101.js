// Code In The Browser .js -- see http://codeinthebrowser.org
// citb.js supports the basic Run functionality and images
// Created by Nick Parlante
// This code is released under the Apache 2.0 license
// http://www.apache.org/licenses/LICENSE-2.0


// Functions to indent new lines .. this code donated by codingbat.com
function insertNewline(ta) {
  if (ta.selectionStart != undefined) {  // firefox etc.
    var before = ta.value.substring(0, ta.selectionStart);
    var indent = figureIndent(before);
    var selSave = ta.selectionEnd;
    var after = ta.value.substring(ta.selectionEnd, ta.value.length)       

    // update the text field
    var tmp = ta.scrollTop;  // inhibit annoying auto-scroll
    ta.value = before + "\n" + indent + after;
    var pos = selSave + 1 + indent.length;
    ta.selectionStart = pos;
    ta.selectionEnd = pos;
    ta.scrollTop = tmp;
    
    // we did it, so return false
    return false;
  } else if (document.selection && document.selection.createRange) { // IE
     var r = document.selection.createRange()
     var dr = r.duplicate()
     dr.moveToElementText(ta)
     dr.setEndPoint("EndToEnd", r)
     var c = dr.text.length - r.text.length
     var b = ta.value.substring(0, c);
     var i = figureIndent(b);
     if (i == "") return true;  // let natural event happen
     r.text = "\n" + i;
     return false;
  }
     
  return true;
}

// given text running up to cursor, return spaces to put at
// start of next line.
function figureIndent(str) {
  var eol = str.lastIndexOf("\n");
  // eol==-1 works ok
  var line = str.substring(eol + 1);  // take from eol to end
  var indent="";
  for (i=0; i<line.length && line.charAt(i)==' '; i++) {
    indent = indent + " ";
  }
  return indent;
}

function handleCR(ta, event) {
  if (event.keyCode==13) return insertNewline(ta)
  else {
    return true;
  }
}



// From eval-exception, figure out the line number or -1.
function extractLine(e, evalLine) {
  if (e.inhibitLine) return -1;  // can be set to specifically inhibit line numbers
  
  // Safari has a .line attribute which is what we want.
  if (e.line) {
    return e.line;
  }
  
  // Firefox has a .lineNumber
  if (e.lineNumber) {
    return e.lineNumber - evalLine + 1;
  }
  
  return -1;
}

// Given id of textarea, eval its code.
// For code errors, returns an error object with
// .userError true and .name .line .message set.
// Otherwise returns null.
function evaluate(inID) {
  
  var ta = document.getElementById(inID);
  // 2012
  var preErr = preflightCheck(ta.value);
  if (preErr) {
    //alert(preErr);
    var e = new Error;
    e.message = preErr;
    return e;
    // todo: work on flagging the right line here
  }
  // todo: could have some way for them to turn preflight off

  var text = sugarCode(ta.value);
  var evalLine = 0;
  var error = new Error;
  if (error.lineNumber) evalLine = error.lineNumber + 3;
  try {
    eval(text);
  }
  catch(e) {
    //alert(e);
    e.userError = true;
    var line = extractLine(e, evalLine)
    if (line != -1) e.userLine = line;
    return e;
  }
  return null;
}

// Select the given line in the ta (for error reporting)
function selectLine(ta, line) {
  if (!ta.setSelectionRange) return;
  
  var count = 0;
  var start = 0;
  var text = ta.value;
  for (var i = 0; i<text.length; i++) {
    if (text[i] == "\n" || (start!=0 && i==text.length-1)) {
      count++;  // [i] is the end of line count
      if (count == line - 1) start = i + 1;
      else if (count == line ) {
        ta.focus();
        ta.setSelectionRange(start, i);
        return;
      }
    }
  }
}


// Wrap evaluate() with logic to show error messages.
// Prints/line-selects on error output.
function evaluateShow(inID) {
  try {
    var e = evaluate(inID);
    if (e != null) {
      var msg = "<font color=red>Error:</font>" + e.message;  // 2012-2 don't make the whole thing red
      if (e.userLine) msg += " line:" + e.userLine;
      print(msg);
      if (e.userLine) {
        var ta = document.getElementById(inID);
        selectLine(ta, e.userLine);
      }
    }
  }
  catch (e) {
    alert("Low level evaluation error:" + e);
  }
}


// Wrapper for evaluate which clears the output
// and allows that GUI update to happen before
// running.
function evaluateClear(id) {
  store(id);
  
  window.globalRunId = id;  // hack: set state used by printing
  window.globalPrintCount = 5000;

  clearOutput();
  
  var ta = document.getElementById(id);
  var text = ta.value;
  preloadImages(text);
  
  // hack: use setTimeout to run this a bit in the future, so the UI
  // update of the above clearOutput() goes through.
  setTimeout(function() { evaluateShow(id); }, 100);
}




// depends on having an "output" div for printing

var appendCount = 0;


// Is this url really an "aux..." name.
// Used in a couple places.
function isAuxUrl(url) {
  return (url.length >= 3 && url.substring(0, 3) == "aux");
}

// 2012-7
// hash filename to data:
var globalImgDb = {
};


// Given image name, install it, find it in the DOM and return it.
// Note: I believe it must be on the same server as the code..
// see: http://stackoverflow.com/questions/2390232/why-does-canvas-todataurl-throw-a-security-exception
// possible fix: http://stackoverflow.com/questions/667519/firefox-setting-to-enable-cross-domain-ajax-request
function loadImage(filename) {
  // append img tag
  var output = getOutput();
  var id = "img" + appendCount;
  appendCount++;

  // 2012-7 
  if (filename in globalImgDb) {
    //var img = new Image();
    //img.setAttribute('id', id);
    filename = globalImgDb[filename];
    //img.setAttribute('style', 'display:none');
    // Coursera had this stuff
    //if (window.globalAriaTags) {
    //  img.setAttribute('aria-live', 'polite');
    //  img.setAttribute('aria-atomic', 'true');
    //}
   // output.appendChild(img);

    //return;
  }
  else if (isAuxUrl(filename)) {
    // trim off .jpg
    if (filename.indexOf(".jpg") != -1) {
      filename = filename.substring(0, filename.indexOf(".jpg"));
    }
    var ta = document.getElementById(filename);
    var content = ta.value; // todo: trim needed here?

    // Make data:... be at the front if not there
    // data:image/jpeg;base64,
    if (content && !(content.length >= 5 && content.substring(0, 5) == "data:")) {
      content = "data:image/jpeg;base64," + content;
    }

    if (!content || content.length < 20) {
      throwError("Trying to load aux image '" + filename +"' but no data found");
      // todo: make this error appear in the UI, as it's easy to get.
    }
    filename = content;  // Use data:... as the filename and IMG will load it
  }
  var img = new Image();
  img.setAttribute('id', id);
  img.setAttribute('src', filename);
  img.setAttribute('style', 'display:none');
  output.appendChild(img);
  
  return img;
}



// Print any number of things, separated by spaces and ending with a carriage return.
function print() {
  // printlimit feature
  if (window.globalPrintCount <= 0) {
    if (window.globalPrintCount == 0) {
      printOne("***print output limited***");
      printOne("<br>");
      window.globalPrintCount--;
    }
    return;
  }
  window.globalPrintCount--;
    

 for (var i=0; i<arguments.length; i++) {
   printOne(arguments[i]);
 }
 printOne("<br>");
}

// Print any number of things, without the ending carriage return.
function printStart() {
 for (var i=0; i<arguments.length; i++) {
   printOne(arguments[i]);
 }
}

// Returns the current global output element to use -- uses
// globalRunId, so uses the correct output area for the current run.
// Could add "throw" logic to detect errors here.
function getOutput() {
  return document.getElementById(window.globalRunId + "-output");
}

// Low level print-one-thing. The something can be a string, number, htmlImage or SimpleImage.
function printOne(something) {
  var output = getOutput();

  // If there's a .getString() function, use it (Row SimplePixel Histogram)
  // This spares us from depending on instanceof/classname.
  if (something.getString) {
    something = something.getString();
  }
  
  // hack: make array look like string
  if (something instanceof Array) {
    something = "[" + something.join(", ") + "]";
  }
  
  if (typeof something == "string" || typeof something == "number") {  // note: instanceof and String is a no-go
    var p = document.createElement("text");
    var spacer = " ";
    if (something == "<br>") spacer = "";
    p.innerHTML = something + spacer;  // by using innerHTML here, markup in the string works.
    output.appendChild(p);
  }
  else if (something instanceof HTMLImageElement) {
    var copy = something.cloneNode(true);
    copy.setAttribute("style", "");
    copy.setAttribute("id", "");

    // used to create <p> here to put on new line.
    //var p = document.createElement("p");
    //p.appendChild(copy);
    output.appendChild(copy);
  }
  else if (something instanceof SimpleImage) {
    // Note, error above if SimpleImage not defined (Chrome)
    // append canvas
    var id = "canvas" + appendCount;
    appendCount++;
    
    
    var canvas = document.createElement("canvas");
    canvas.setAttribute('id', id);
    something.drawTo(canvas);
    output.appendChild(canvas);
    
  }
  else {
    alert("bad print with:" + something);
  }
}

// Clears the current output.
function clearOutput() {
  var output = getOutput();
  output.innerHTML = "";
}

// Clears output for the given input id.
// like "hw1-1" .. -output is added internally.
// todo: I don't think this is used
function clearOutputId(id) {
  var output = document.getElementById(id + "-output");
  if (!output) {
    var err = new Error;
    err.message = "clearOutput() with bad id " + id;
    err.inhibitLine = true;  // this gets the .message through, but the line number will be wrong
    throw(err);
  }
  output.innerHTML = "";
}




// Note there is an Image built in, so don't use that name.

// Makes an invisible canvas, inited either with a "foo.jpg" url,
// or an htmlImage from loadImage().
// maybe: could make this work with another SimpleImage too.
SimpleImage = function(image) {
  var htmlImage = null;
  if (typeof image == "string") {
    htmlImage = loadImage(image);
  } else if (image instanceof HTMLImageElement) {
    htmlImage = image;
  } else {
    var err = new Error;
    err.message = "new SimpleImage(...) requires a htmlImage.";
    err.inhibitLine = true;  // this gets the .message through, but the line number will be wrong
    throw(err);
  }
    
  // append canvas
  var output = getOutput();
  var id = "canvas" + appendCount;
  appendCount++;
  
  var canvas = document.createElement("canvas");
  canvas.setAttribute('id', id);
  canvas.setAttribute('style', 'display:none');
  
  output.appendChild(canvas);
  //var p = document.createElement("text");
  //p.appendChild(canvas);
  //output.appendChild(p);
  
  if (!htmlImage.complete) {
    alert("Image loading -- may need to run again");
  }
  
  this.width = htmlImage.width;
  this.height = htmlImage.height;
  
  //console.log(this);

  this.canvas = canvas;
  this.canvas.width = this.width;
  this.canvas.height = this.height;
  
  this.context = canvas.getContext("2d");  

  this.drawFrom(htmlImage);

  // Do this last so it gets the actual image data.
  this.imageData = this.context.getImageData(0, 0, this.width, this.height);
}


SimpleImage.prototype.canvas;
SimpleImage.prototype.context;
SimpleImage.prototype.width;
SimpleImage.prototype.height;
SimpleImage.prototype.imageData;
SimpleImage.prototype.zoom;

// Sets a zoom factopr such as 4, to print the image at 4x. Useful
// in order to see individual pixels of an image.
SimpleImage.prototype.setZoom = function(n) {
  this.zoom = n;
};


// Change the size of the image to the given, scaling the pixels.
// (formerly "resize").
SimpleImage.prototype.setSize = function(newWidth, newHeight) {
  // append canvas
  var output = getOutput();
  var id = "canvas" + appendCount;
  appendCount++;
  
  var canvasNew = document.createElement("canvas");
  canvasNew.width = newWidth;
  canvasNew.height = newHeight;
  canvasNew.setAttribute('id', id);
  canvasNew.setAttribute('style', 'display:none');
  
  var p = document.createElement("text");
  p.appendChild(canvasNew);
  output.appendChild(p);
  
  // draw OUR canvas to new canvas
  this.flush();
  var contextNew = canvasNew.getContext("2d");  
  contextNew.drawImage(this.canvas, 0, 0, newWidth, newHeight);

  // then Swap in canvas
  this.width = canvasNew.width;
  this.height = canvasNew.height;

  this.canvas = canvasNew;
  this.context = canvasNew.getContext("2d");  

  // Do this last so it gets the actual image data.
  this.imageData = this.context.getImageData(0, 0, this.width, this.height);
}

// Set this image to be the same size to the passed in image.
// This image may end up a little bigger than the passed image
// to keep its proportions.
// Useful to set a back image to match the size of the front
// image for bluescreen.
SimpleImage.prototype.setSameSize = function(otherImage) {
  if (!this.width) return;

  var wscale = otherImage.width / this.width;
  var hscale = otherImage.height / this.height;

  var scale = Math.max(wscale, hscale);

  if (scale != 1) {
    this.setSize(this.width * scale, this.height * scale);
  }
}


// Takes on the pixels of the given html image
SimpleImage.prototype.drawFrom = function(htmlImage) {
  // drawImage takes either an htmlImage or a canvas
  this.context.drawImage(htmlImage, 0, 0);
};

// Draws to the given canvas, setting its size.
// Used to implement printing of an image.
SimpleImage.prototype.drawTo = function(toCanvas) {
  if (!this.zoom) {
    toCanvas.width = this.width;
    toCanvas.height = this.height;
  }
  else {
    toCanvas.width = this.width * this.zoom;
    toCanvas.height = this.height * this.zoom;
  }
  
  this.flush();
  var toContext = toCanvas.getContext("2d");
  // drawImage() takes either an htmlImg or a canvas
  if (!this.zoom) {
    toContext.drawImage(this.canvas, 0, 0);
  }
  else {
    // in effect we want this:
    //toContext.drawImage(this.canvas, 0, 0, toCanvas.width, toCanvas.height);

    // Manually scale/copy the pixels, to avoid the default blurring effect.
    // changed: createImageData apparently better than getImageData here.
    var toData = toContext.createImageData(toCanvas.width, toCanvas.height);
    for (var x = 0; x < toCanvas.width; x++) {
      for (var y = 0; y < toCanvas.height; y++) {
        var iNew =  (x + y * toCanvas.width) * 4;
        var iOld = (Math.floor(x / this.zoom) + Math.floor(y / this.zoom) * this.width) * 4;
        for (var j = 0; j < 4; j++) {
          toData.data[iNew + j] = this.imageData.data[iOld + j];
        }
      }
    }
    toContext.putImageData(toData, 0, 0);
    // todo: above line throws an exception in Chrome if
    // args toCanvas.width, toCanvas.height are included: bug report?
  }
}

SimpleImage.prototype.getWidth = function() {
  return this.width;
}

SimpleImage.prototype.getHeight = function() {
  return this.height;
}

// Computes index into 1-d array, and checks correctness of x,y values
SimpleImage.prototype.getIndex = function(x, y) {
  if (x == null || y == null) {
    var e = new Error("need x and y values passed to this function");
    e.inhibitLine = true;
    throw e;
  }
  else if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
    var e = new Error("x/y out of bounds x:" + x + " y:" + y);
    e.inhibitLine = true;
    throw e;
  }
  else return (x + y * this.width) * 4;
}


// --setters--
// Sets the red value for the given x,y
SimpleImage.prototype.setRed = function(x, y, value) {
  funCheck("setRed", 3, arguments.length);
  var index = this.getIndex(x, y);
  this.imageData.data[index] = clamp(value);
  
  // This is how you would write back each pixel individually.
  // It gives terrible performance (on Firefox anyway).
  // this.context.putImageData(this.imageData, 0, 0, x, y, 1, 1);
  // dx dy dirtyX dirtyY dirtyWidth dirtyHeight
};

// Sets the green value for the given x,y
SimpleImage.prototype.setGreen = function(x, y, value) {
  funCheck("setGreen", 3, arguments.length);
  var index = this.getIndex(x, y);
  this.imageData.data[index + 1] = clamp(value);
};

// Sets the blue value for the given x,y
SimpleImage.prototype.setBlue = function(x, y, value) {
  funCheck("setBlue", 3, arguments.length);
  var index = this.getIndex(x, y);
  this.imageData.data[index + 2] = clamp(value);
};

// Sets the alpha value for the given x,y
SimpleImage.prototype.setAlpha = function(x, y, value) {
  funCheck("setAlpha", 3, arguments.length);
  var index = this.getIndex(x, y);
  this.imageData.data[index + 3] = clamp(value);
};


// --getters--
// Gets the red value for the given x,y
SimpleImage.prototype.getRed = function(x, y) {
  funCheck("getRed", 2, arguments.length);
  var index = this.getIndex(x, y);
  return this.imageData.data[index];
};
// Gets the green value for the given x,y
SimpleImage.prototype.getGreen = function(x, y) {
  funCheck("getGreen", 2, arguments.length);
  var index = this.getIndex(x, y);
  return this.imageData.data[index + 1];
};
// Gets the blue value for the given x,y
SimpleImage.prototype.getBlue = function(x, y) {
  funCheck("getBlue", 2, arguments.length);
  var index = this.getIndex(x, y);
  return this.imageData.data[index + 2];
};
// Gets the blue value for the given x,y
SimpleImage.prototype.getAlpha = function(x, y) {
  funCheck("getAlpha", 2, arguments.length);
  var index = this.getIndex(x, y);
  return this.imageData.data[index + 3];
};

// Gets the pixel object for this x,y. Changes to the
// pixel write back to the image.
SimpleImage.prototype.getPixel = function(x, y) {
  funCheck("getPixel", 2, arguments.length);

  return new SimplePixel(this, x, y);
};


// Pushes any accumulated local changes out to the screen
SimpleImage.prototype.flush = function() {
  this.context.putImageData(this.imageData, 0, 0);  // can omit x/y/width/height and get default behavior
};


// Export an image as an array of pixels for the for-loop.
SimpleImage.prototype.toArray = function() {
  var array = new Array();  // 1. simple-way (this is as good or faster in various browser tests)
  //var array = new Array(this.getWidth() * this.getHeight()); // 2. alloc way
  //var i = 0;  // 2.
  // nip 2012-7  .. change to cache-friendly y/x ordering
  // Non-firefox browsers may benefit.
  for (var y = 0; y < this.getHeight(); y++) {
    for (var x = 0; x < this.getWidth(); x++) {
      //array[i++] = new SimplePixel(this, x, y);  // 2.
      array.push(new SimplePixel(this, x, y));  // 1.
    }
  }
  return array;
};


// Wrapper called on the composite by the for(part: composite) sugar, and it does
// some basic error checking.
function getArray(obj) {
  if (obj && typeof(obj) == 'object') {
    if (obj instanceof Array) {
      return obj;
    } else if ('toArray' in obj) {
      return obj.toArray();
    }
  } else {
    throwError("'for (part: composite)' used, but composite is wrong.");
  }
}

// Represents one pixel in a SimpleImage, supports rgb get/set.
SimplePixel = function(simple_image, x, y) {
  this.simple_image = simple_image;
  this.x = x;
  this.y = y;
};


SimplePixel.prototype.simple_image;
SimplePixel.prototype.x;
SimplePixel.prototype.y;

SimplePixel.prototype.getRed = function() {
  funCheck("getRed", 0, arguments.length);
  return this.simple_image.getRed(this.x, this.y);
};
SimplePixel.prototype.setRed = function(val) {
  funCheck("setRed", 1, arguments.length);
  this.simple_image.setRed(this.x, this.y, val);
};
SimplePixel.prototype.getGreen = function() {
  funCheck("getGreen", 0, arguments.length);
  return this.simple_image.getGreen(this.x, this.y);
};
SimplePixel.prototype.setGreen = function(val) {
  funCheck("setGreen", 1, arguments.length);
  this.simple_image.setGreen(this.x, this.y, val);
};
SimplePixel.prototype.getBlue = function() {
  funCheck("getBlue", 0, arguments.length);
  return this.simple_image.getBlue(this.x, this.y);
};
SimplePixel.prototype.setBlue = function(val) {
  funCheck("setBlue", 1, arguments.length);
  this.simple_image.setBlue(this.x, this.y, val);
};

SimplePixel.prototype.getX = function() {
  funCheck("getX", 0, arguments.length);
  return this.x;
};
SimplePixel.prototype.getY = function() {
  funCheck("getY", 0, arguments.length);
  return this.y;
};

// Render pixel as string -- print() uses this
SimplePixel.prototype.getString = function() {
  return "r:" + this.getRed() + " g:" + this.getGreen() + " b:" + this.getBlue();
};


// Given code, return sugared up code, or may throw error.
// expands: for (part: composite) {
function sugarCode(code) {
  var reWeak = /for *\([ \w+().-]*:[ \w+().-]*\) *\{/g;
  // important: the g is required to avoid infinite loop
  // weak: for ( stuff* : stuff*) {
  // weak not allowing newline etc., or the * goes too far
  var reStrong = /for\s*\(\s*(?:var\s+)?(\w+)\s*:\s*(\w+(\(.*?\))?)\s*\)\s*\{/;
  // strong: for([var ]x : y|foo(.*?) ) {

  // Find all occurences of weak, check that each is also strong.
  // e.g. "for (x: 1 +1) {" should throw this error
  var result;
  while ((result = reWeak.exec(code)) != null) {
    // have result[0] result.index, reWeak.lastIndex
    var matched = result[0];
    //alert(matched);
    if (matched.search(reStrong) == -1) {
      throwError("Attempt to use 'for(part: composite)' form, but it looks wrong: " + result[0]);
      // todo: since it happens before the eval, this error ends up in an alert(), but maybe
      // appearing in the regular red-text would be better.
    }
  }
  
  // Loop, finding the next 
  var gensym = 0;
  while (1) {
    var temp = code;
    var pvar = "pxyz" + gensym;
    var ivar = "ixyz" + gensym;
    gensym++;
    var replacement = "var " + pvar + " = getArray($2); " +
      "for (var " + ivar + "=0; " + ivar + "<" + pvar + ".length; " + ivar + "++) {" +
      "var $1 = " + pvar + "[" + ivar + "];";
    code = code.replace(reStrong, replacement);
    if (code == temp) break;
  }
  return(code);
  //return code.replace(reStrong, replacement);
  
  // someday: could look for reWeak, compare to where reStrong applied,
  // see if there is a case where they are trying but failing to use the for(part) form.
  // Or an easy to implement form would be to look for "for (a b c)" or whatever
  // where the lexemes look wrong, and flag it before the sugaring even happens.
  //var reWeak = /for\s*\((.*?)\)\s*\{/;
  //while ((result = reWeak.exec(code)) != null) {
  // have result[0] result.index, reWeak.lastIndex
}


// Call this to abort with a message e.g. "Wrong number of arguments to foo()".
// todo: in some cases, this does not show up in the UI, missing the try/catch
// in the evaluate chain for some reason.
function throwError(message) {
    var err = new Error;
    err.message = message;
    err.inhibitLine = true;  // this gets the .message through, but the line number will be wrong
    throw err;
}

// Called from user-facing functions, checks number of arguments.
function funCheck(funName, expectedLen, actualLen) {
  if (expectedLen != actualLen) {
    var s1 = (actualLen == 1)?"":"s";  // pluralize correctly
    var s2 = (expectedLen == 1)?"":"s";
    var message = funName + "() called with " + actualLen + " value" + s1 + ", but expected " +
      expectedLen + " value" + s2 + ".";
    // someday: think about "values" vs. "arguments" here
    // todo: any benefit to throwing an Error here vs. a string?
    throwError(message);
  }
}




// Given code text, scan for image urls so they can be pre-loaded.
// This is a hack, but it mostly works.
// This is called *before* we run the student code, avoiding async image-load problems.
// maybe: could skip commented-out code
// maybe: could be smart about loading something just once, but it's pretty harmless as is.
function preloadImages(code) {
  var re = /SimpleImage\(\s*("|')(.*?)("|')\s*\)/g;
  while (ar = re.exec(code)) {
    // Used to screen out data: urls here, but that messed up the .loaded attr, strangely
    var url = ar[2];
    loadImage(url);
  }
}

// Clamp values to be in the range 0..255. Used by setRed() et al.
function clamp(value) {
  // value = Math.floor(value);  // .js is always float, so this line
  // is probably unncessary, unless we get into some deep JIT level.
  if (value < 0) return 0;
  if (value > 255) return 255;
  return value;
}



// Storage
// These silently NOP if localstorage is not available.

// Prefix used under the hood for local storage.
var storeprefix = "citb.";
// if global var storeinhibit is defined, don't do any storage,
// so the html can block out storage in that way.

// ID's with this pattern saved by the Run button.
var storeexpattern = ".-ex";

// Stores the text for the given textarea id.
// Does not store if the text area contains only whitespace.
// If the data is "del", stores blank data.
function store(id) {
  // Apparently some windows security settings remove local storage,
  // so you really need to check.
  if (!localStorage) return; // todo: note in the UI the lack of storage
  if (window.storeinhibit) return;

  if (!id.match(storeexpattern)) return;

  var ta = document.getElementById(id);
  var text = ta.value;
  var trimmed = text.replace(/\s/g,"");  // used for testing, not storage
  if (trimmed.length > 0) {  // detect if this is basically empty data
    if (trimmed == "del") text = "";  // special case to delete
    localStorage.setItem(storeprefix + id, text);
  }
}

// Retrieves and returns the text for the given id.
// Changes null to "", so you get back a string at a minimum.
function retrieve(id) {
  if (!localStorage) return "";
  if (window.storeinhibit) return "";

  var val = localStorage.getItem(storeprefix + id);
  if (!val) val = "";  // todo: what if "0" is stored?
  return val;
}


// Retrieves the localstorage text of all saved exercises.
// Pastes the text into the given outputid if non-null, and also
// returns the text to the caller. 
function retrieveCodeText(outputid) {
  if (!localStorage) return;
  if (window.storeinhibit) return;

  var keys = new Array();
  for (var i = 0; i < localStorage.length; i++) {
    var key = localStorage.key(i);
    if (key.indexOf(storeprefix) == 0) {
      keys.push(key);
    }
  }
  keys.sort();

  var text = "";
  for (var i in keys) {
    var key = keys[i];
    var val = localStorage.getItem(key);
    var keyshort = key.substring(storeprefix.length)
    text = text + "----------\n" + keyshort + "\n\n" + val + "\n";
  }

  if (outputid) {
    var output = document.getElementById(outputid);
    output.innerHTML = "<pre>" + text + "</pre>";
  }

  return text;
}

// 2012
// Variant which takes in specific ids to use.
// (probably new homeworks should use this one, maybe remove the other one.)
function retrieveCodeTextIds(outputid, ids) {
  if (!localStorage) return;
  if (window.storeinhibit) return;

  ids.sort();
  var text = "";
  for (var i in ids) {
    var val = retrieve(ids[i]);
    text = text + "----------\n" + ids[i] + "\n\n" + val + "\n";
  }

  if (outputid) {
    var output = document.getElementById(outputid);
    output.innerHTML = "<pre>" + text + "</pre>";
  }

  return text;
}



// 2012
// Given code, returns error string or empty string
// Adding more checks here for mistakes students make
// run line "nocodecheck = true;" in user code to inhibit
// these preflight checks
// (setting the global window.nocodecheck variable).
function preflightCheck(code) {
  // 2012-2
  if (window.nocodecheck) return "";

  // 2012-2 allow if (...) { to span lines
  var reIf1 = /^\s*if\s*(.*)$/mg; // initial anchor, m makes ^/$ work per line
  // todo: deal with comments correctly
  // todo: would be nice to also report a line number
  //  return an Error instead of a string
  
  var result;
  while ((result = reIf1.exec(code)) != null) {
    var line = result[1];
    var check = "";
    var found = "";
    if (line.match(/\{\s*($|\/\/)/)) { // one-line..{ common case
      check = line;
      found = line;
    }
    else {
      // See if there is multi-line ... { text we can check
      // Had problems with .* going in to the weeds, so trying to constrain
      // the check here with the initial anchor. If .. { can span 4 lines here.
      var text = code.substring(result.index);
      var reIf2 = /^\s*if\s*((.*(\r?\n?)){1,3}.*\{\s*($|\/\/))/m;
      if ((result2 = reIf2.exec(text)) != null) {
        //alert(result2[1]);
        check = result2[1];
        found = result2[0];
      }
    }
    
    // Check the text after the "if " text ends with {\s*$
    if (check) {
      // These error messages go in the output area, so tags work
      if (!check.match(/^\s*\(/)) return "<b>if</b> should be immediately followed by <b>(</b>test<b>)</b> but found:<br>" + found;
      if (!check.match(/\)\s*\{\s*($|\/\/)/)) return "<b>if test</b> should end with <b>)</b> but found:<br>" + found;
      if (check.match(/[^<>=!]\=[^=]/)) return "<b>if test</b> should not contain single = (use == &lt;= &gt;=), but found:<br>" + found;
      if (check.match(/[^&]&[^&]/)) return "<b>if test</b> should not contain single & (use double &&), but found:<br>" + found;
      if (check.match(/[^|]\|[^|]/)) return "<b>if test</b> should not contain single | (use double ||), but found:<br>" + found;
    }
    else {
      // Experiment: flag that we cannot find { within 4 lines of the opening if as
      // an error.
      return "<b>if-statement</b> cannot find end of line <br>left curly brace <b>{</b> <br>Form should be " +
             "<br><b>if (test) {</b><br>&nbsp;..code..<br>but found:" + result[0];  // note using result from initial match.
    }
  }

  // 2012-7 adding ($|\/\/)
  var reFor = /^\s*for\s(.*)$/mg; // m makes ^/$ work per line
  // insist on space after for, so we don't grab every random "for" occurrence
  while ((result = reFor.exec(code)) != null) {
    // have result[0] result[1] groups, result.index index
    var line = result[1];
    if (!line.match(/^\s*\(/)) return "<b>for</b> should be immediately followed by <b>(</b> but found:<br>" + result[0];
    if (!line.match(/\{\s*($|\/\/)/)) return "<b>for</b> line should end with curly brace <b>{</b> but found:<br>" + result[0];
    if (!line.match(/\)\s*\{\s*($|\/\/)/)) return "<b>for</b> should be followed by <b>(</b>part: whole<b>)</b> but found:<br>" + result[0];
  }

  // Function names, 
  var reFn =  /(getRed|getGreen|getBlue|setRed|setGreen|setBlue|getX|getY|getPixel|setZoom|setSize|setSameSize|getField|startsWith|endsWith)(.)/g
  var reFnI = /(getRed|getGreen|getBlue|setRed|setGreen|setBlue|getX|getY|getPixel|setZoom|setSize|setSameSize|getField|startsWith|endsWith)(.)/gi
  // omitting "print" as too easily could appear in a string

  // Check for off by capitalization
  while ((result = reFnI.exec(code)) != null) {
    if (!result[0].match(reFn)) {
      return "<b>" + result[1] + "</b> appears to have some wrong capitalization";
    }
  }

  // Have fn names ... look for (
  // Using pixel.getRed as an rvalue .. hard for them to debug
  while ((result = reFn.exec(code)) != null) {
    // have result[0] result[1] groups, result.index index
    var paren = result[2];
    if (paren != "(") {
      return "<b>" + result[1] + "</b> should be immediately followed by <b>(</b>"
    }
  }
  return "";
}


/*
// We don't do this any more
function checkFirefox() {
  if (navigator.userAgent.indexOf("Firefox") == -1) {
    var warn = document.getElementById("warning-output");
    warn.innerHTML = "<font color=red>Warning: this page only works with the latest Firefox. " +
      "This will be fixed ultimately, but for now the limitation is real.</font>";
  }
}
*/

// Hide the first thing, unhide the thing following it.
// Used to make the litttle solution-show buttons in the html.
function unhide(first) {
  first.style.display = "none";
  first.nextSibling.style.display = "block";
}









