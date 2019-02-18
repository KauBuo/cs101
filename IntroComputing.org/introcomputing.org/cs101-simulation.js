// citb-simulation.js supports monte carlo simulations
// Code In The Browser .js -- see http://codeinthebrowser.org
// Created by Nick Parlante
// This code is released under the Apache 2.0 license
// http://www.apache.org/licenses/LICENSE-2.0

// Histogram with min..max buckets, inclusive.
Histogram = function(min_val, max_val) {
  this.values = new Array();
  this.min_val = min_val;
  this.max_val = max_val;
  this.count = 0;
};
Histogram.prototype.values;
Histogram.prototype.min_val;
Histogram.prototype.max_val;
Histogram.prototype.count;

// Add the given value to the histogram.
Histogram.prototype.add = function(n) {
  if (!this.values[n]) {
    this.values[n] = 1;
  }
  else {
    this.values[n] = this.values[n] + 1;
  }
  this.count++;
};

// Return string/html form of histrogram (used by print).
Histogram.prototype.getString = function() {
  var log = Math.log(10);
  var result = "";
  
  // Make first pass to figure max value.
  var max = 0;
  var min = 1e9;
  for (var i = this.min_val; i <= this.max_val; i++) {
    if (this.values[i] > max) max = this.values[i];
    if (this.values[i] < min) min = this.values[i];
  }

  // We make the bars a little wider for large values, so you get
  // a bit of a sense of big vs little in the UI.
  var maxLog = Math.log(max) / Math.log(10); // 1 = 10, 2 = 100, ...
  var pixels = (150 + (50 * maxLog)) / max;


  for (var i = this.min_val; i <= this.max_val; i++) {
    var val = this.values[i];
    if (!val) val = 0;
    var color = (i%2?"#EBEBEB":"#DEDEDE");
    // Draw each bar as a div using width: css
    result = result + "<div style='overflow:visible;background-color:" + color +
      ";height:25px;width:" + val * pixels + "'>";
    result = result + i + ":&nbsp;" + val + "</div>\n";
  }
  
  // 2012-7
  if (this.min_val < this.max_val) {
    result = result + "count:" + this.count;
  }
  
  return result;
};

// Returns an integer value in the range 0..n-1 inclusive.
function randomInt(n) {
  return Math.floor(Math.random() * n);
}

// Returns a value in the range first..last inclusive.
function random(first, last) {
  funCheck("random(min, max)", 2, arguments.length);
  var diff = last - first;
  var rand = randomInt(Math.round(diff + 1)); // 0..diff
  return first + rand;
}

// Returns the series of numbers min...max (inclusive).
// With only one argument, the series is 1...val.
function series(min_val, max_val) {
  if (arguments.length == 1) {
    max_val = min_val;
    min_val = 1;
  }
  var vals = new Array();
  for (var i = min_val; i <= max_val; i++) {
    vals.push(i);
  }
  return vals;
}

// Give two numbers in the range 1..3, return a random
// number 1..3 which is different from those passed in.
// Very handy for Monty Hall.
function neitherOfThese(a, b) {
  funCheck("neitherOfThese", 2, arguments.length);
  while (1) {
    var num = randomInt(3) + 1;
    if (num !=a && num !=b) return num;
  }
}

