/*

hpgl v0.5.0-alpha.6

A Node.js library to communicate with HPGL-compatible plotters and printers.
https://github.com/cotejp/hpgl


The MIT License (MIT)

Copyright (c) 2016, Jean-Philippe Côté

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

module.exports = {};

/**
 * The `Plotter` class provides methods to interact with an HPGL-compatible plotter such as those
 * made by HP starting in the 1980s. Various other makers also use or support the HPGL protocol
 * (Calcomp, for example).
 *
 * @todo take into account different devices (plotting areas, orientation, etc.)
 *
 * @class
 */
var Plotter = function() {

  // Private properties
  this._plottingAreas = {
    A: {long: 10365, short: 7962},
    B: {long: 16640, short: 10365},
    A4: {long: 11040, short: 7721},
    A3: {long: 16158, short: 11040}
  };
  this._queue = [];
  this._queueTimeOutId = 0;
  this._paper = "A";
  this._orientation = "landscape";
  this._buffer  = "";
  this._maxConnectionDelay = 2000;

  this._charsets = {

    // ISO 646 French (FR1)
    34: {
      "!": 33,
      '"': 34,
      "£": 35,
      "$": 36,
      "’": 39,
      ",": 44,
      "à": 64,
      "°": 91,
      "ç": 92,
      "§": 93,
      "^": 94,
      "_": 95,
      "µ": 96,
      "é": 123,
      "ù": 124,
      "è": 125,
      "¨": 126,

      // circumflex
      "â": [97, 8, 94],
      "ê": [101, 8, 94],
      "ô": [111, 8, 94],
      "û": [117, 8, 94],

      // diaresis
      "ä": [97, 8, 126],
      "ë": [101, 8, 126],
      "ö": [111, 8, 126],
      "ü": [117, 8, 126]
    }

  };

  /**
   * The size of the device's buffer in bytes (characters). A single instruction sent to the device
   * cannot be larger than that value. Note: it is only available after the
   * [ready]{@link Plotter#event:ready} event has been fired.
   *
   * @member {number}
   * @readOnly
   */
  this.bufferSize = undefined;

  /**
   * Delay between calls to `_processQueue()`.
   *
   * @todo This needs to be thoroughly checked!!
   * @private
   * @member {number}
   */
  this._queueDelay = 100;

  /**
   * The device's reported model name. Note: it is only available after the
   * [ready]{@link Plotter#event:ready} event has been fired.
   *
   * @member {string}
   * @readOnly
   */
  this.model = undefined;

  /**
   * The object that is used for serial communication. This object must adhere to the
   * [serialport](https://www.npmjs.com/package/serialport) module interface. Typically, it is one
   * of: [serialport](https://www.npmjs.com/package/serialport),
   * [browser-serialport](https://www.npmjs.com/package/browser-serialport) or
   * [virtual-serialport](https://www.npmjs.com/package/virtual-serialport)
   *
   * @todo Must test with serialport and virtual-serialport
   *
   * @member {Object}
   * @readOnly
   */
  this.transport = undefined;

  /**
   * Indicates whether the device is ready or not. The device is ready only after having been
   * successfully connected by using the [Plotter.connect()]{@link Plotter#connect} function.
   * Instructions should not be sent to the device prior to it being ready.
   *
   * The [Plotter]{@link Plotter} object triggers the [ready]{@link Plotter#event:ready} event when
   * its ready.
   *
   * @member {Boolean}
   * @readOnly
   */
  this.ready = false;

  /**
   * An object detailing the hardware resolution reported by the connected device. Note: it is only
   * available after the [ready]{@link Plotter#event:ready} event has been fired.
   *
   * @member {Object}
   * @property {number} x Number of plotter units per millimiter on the **x** axis
   * @property {number} y Number of plotter units per millimiter on the **y** axis
   * @readOnly
   */
  this.resolution = {};

  /**
   * An array of all the paper sizes supported by the device.
   *
   * @todo this needs to be mapped inside the HP7475a object
   *
   * @member {string[]}
   * @name Plotter#supportedPapers
   * @readOnly
   */
  Object.defineProperty(this, 'supportedPapers', {
    enumerable: true,
    writable: false,
    value: [
      'A',  // letter
      'B',  // tabloid
      'A4',
      'A3'
    ]
  });

};

util.inherits(Plotter, EventEmitter);

/**
 * Opens a serial connection to the device using the specified transport layer. Currently, only the
 * [browser-serialport](https://www.npmjs.com/package/browser-serialport) module has been tested.
 *
 * @param {Object} transport - A transport object compatible with the
 * [serialport](https://www.npmjs.com/package/serialport) API interface.
 * Typically, it is one of: [serialport](https://www.npmjs.com/package/serialport),
 * [browser-serialport](https://www.npmjs.com/package/browser-serialport) or
 * [virtual-serialport](https://www.npmjs.com/package/virtual-serialport).
 * @param {Object} [options={}] Options to use while setting up the device.
 * @param {string} [options.paper="A"] - The paper size to use. Choices are:
 *   - *A* (a.k.a "letter")
 *   - *B* (a.k.a "tabloid")
 *   - *A4*
 *   - *A3*
 * @param {string} [options.orientation="landscape"] - The orientation of the paper: *landscape* or
 * *portrait*.
 * @param {Function} [callback=null] - A function to trigger when the connect operation has completed.
 * This function will receive an `error` parameter is an error occured.
 *
 * @todo Paper sizes must be mapped to the actual device.
 */
Plotter.prototype.connect = function(transport, options = {}, callback = null) {

  this.transport = transport;

  // Save different paper size if specified
  if ( options.paper && this.supportedPapers.includes(options.paper.toUpperCase()) ) {
    this._paper = options.paper.toUpperCase();
  }

  // Save different orientation if specified
  if (
    options.orientation &&
    ["landscape", "portrait"].includes(options.orientation.toLowerCase())
  ) {
    this._orientation = options.orientation.toLowerCase();
  }

  // Try to open transport layer
  this.transport.open((error) => {

    // If the connection attempt was unsuccessful, we are done!
    if (error) {
      if (callback) { callback.call(this, error); }
      this._onError(error);
      return;
    }

    this.transport.on('data', this._onData.bind(this));
    this.transport.on('error', this._onError.bind(this));

    // Reset the device to its 'power on' status (same as DF plus: pen is raised, errors are
    // cleared, rotation set to 0, scaling points reset). Must be done first and without being
    // queued.
    this.send("IN");

    // Retrieve buffer size. As per the "Output Buffer Size Instruction" documentation (when in
    // block mode), we must first send an ESC.E and read the response before sending an ESC.L to
    // retrieve buffer size.
    this.queue(String.fromCharCode(27) + ".E", [], () => {}, true);
    this.queue(String.fromCharCode(27) + ".L", [], (data) => {
      this.bufferSize = data;
    }, true);

    // Retrieve device model
    this.queue("OI", [], (data) => {
      this.model = data;
    }, true);

    // Retrieve device resolution
    this.queue("OF", [], (data) => {
      [this.resolution.x, this.resolution.y] = data.split(",", 2);
    }, true);

    // Select paper size. Basically, this tells the device which paper orientation to use. A4 and
    // A (letter) use the same orientation while A3 and B (tabloid) use the other orientation.
    if ( ["B", "A3"].includes(this._paper) ) {
      this.queue("PS", 0);
    } else {
      this.queue("PS", 127);
    }

    // Set the desired orientation
    if (this._orientation === "portrait") {

      if ( ["A", "A4"].includes(this._paper) ) {
        this.queue("RO", 90);   // rotate to 0
        this.queue("IP");       // reassign P1 and P2
        this.queue("IW");       // reset plotting window
      }

    } else {

      if ( ["B", "A3"].includes(this._paper) ) {
        this.queue("RO", 90);   // rotate to 0
        this.queue("IP");       // reassign P1 and P2
        this.queue("IW");       // reset plotting window
      }

    }

    // Instead of using the SC instruction to scale for millimiters, we are using our own
    // conversion function. The decision is motivated by the fact that SC onky accepts integers as
    // parameters which makes it imprecise. SHOULD WE STICK WITH THAT OR USE, THE RES REPORTED
    //BY DEVICE ?!

    // Wait for buffer size, model and resolution information to be retrieved before triggering
    // user callback. If it takes too long, report error.
    let start = Date.now();

    let intervalId = setInterval(() => {

      if (this.bufferSize && this.model && this.resolution.x) {

        clearInterval(intervalId);
        this.ready = true;
        if (callback) { callback.call(this); }

        /**
         * Event emitted when the device is ready.
         * @event Plotter#ready
         */
        this.emit("ready");

      } else if (start + this._maxConnectionDelay < Date.now()) {

        clearInterval(intervalId);
        if (callback) {
          callback.call(
            this,
            new Error("Could not retrieve mandatory startup information from the device.")
          );
        }

      }

    }, 100);

  });

};

/**
 * Converts centimeters to plotter units. According to the documentation, a plotter unit is
 * equivalent to 0.02488 millimeters.
 *
 * THIS METHOD SHOULD USE WHAT IS RETURNED BY OF and put in this.resolution
 *
 * @private
 * @method _toPlotterUnits
 * @param {number} cm The centimeter value to convert.
 * @return {Number} The converted value rounded to the closest **integer**.
 */
Plotter.prototype._toPlotterUnits = function(cm) {
  return Math.round(cm / 0.002488);
};

/**
 * Converts a point (x, y) whose origin is in the usual top-left to a point following the HPGL
 * coordinates system. The input coordinates must be expressed in plotter units since this function
 * takes into account the desired orientation and the paper size.
 *
 * @private
 * @method _toHpglCoordinates
 * @param {number} x The `x` coordinate of the point (must be expressed in plotter units).
 * @param {number} y The `y` coordinate of the point (must be expressed in plotter units).
 * @return {Object} An object whose **x** and **y** properties have been transformed.
 */
Plotter.prototype._toHpglCoordinates = function(x, y) {

  let point = {x: Math.round(x), y: Math.round(y)};

  if ( ["A", "A4"].includes(this._paper) ) {

    if (this._orientation === "portrait") {
      point.x = this._plottingAreas[this._paper].short - x;
    } else {
      point.y = this._plottingAreas[this._paper].short - y;
    }


  } else if ( ["B", "A3"].includes(this._paper) ) {

    if (this._orientation === "portrait") {
      point.y = x;
      point.x = y;
    } else {

    }

  }

  return point;

};

/**
 * @private
 * @param {Object} data
 * @method _onData
 */
Plotter.prototype._onData = function(data) {

  // console.log("_onData: " + data);

  if (data.toString() === "\r") {

    /**
     * Event emitted when data is received from the device.
     * @event Plotter#data
     * @param {string} data The data received.
    */
    this.emit("data", this._buffer);
    this._buffer = "";

  } else {

    this._buffer += data.toString();

  }

};

/**
 * @private
 * @method _onError
 * @param {Object} error An object containing information about the error.
 */
Plotter.prototype._onError = function(error) {

  /**
   * Event emitted when an error occurs. The specified function will receive an object with
   * information about the error.
   *
   * @event Plotter#error
   * @param {Object} error object containing details about the error
   */
  this.emit("error", error);

};

/**
 * Immediately sends a raw HPGL instruction down the serial port. The instruction is automatically
 * terminated with a semicolon.
 *
 * Unless you are very familiar with HPGL, this method should not be used directly. Instead, you can
 * use friendlier methods such as: [drawLines()]{@link Plotter#drawLines},
 * [drawText()]{@link Plotter#drawText}, [drawCircle()]{@link Plotter#drawCircle}, etc.
 *
 * @param {string} instruction The raw instruction to send (unterminated).
 * @param {Function} [callback=null] A function to call once the data has been sent to the device
 * (default) or when an answer has been received from the device. If `waitForResponse` is `true`,
 * the callback function will receive a single parameter containing the data received from the
 * device.
 * @param {boolean} [waitForResponse=false] Whether to execute the callback function immediately
 * after the data has been sent or only after an answer has been received from the device.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.send = function(instruction, callback = null, waitForResponse = false) {

  // if (!this.ready) {
  //   throw new Error("The device cannot receive instructions before its `ready` property is `true`");
  // }

  // Add termination character. A semicolon is used unless we are printing a label (which requires
  // a special termination char: ETX).
  if (instruction.substring(0, 2) === "LB") {
    instruction += String.fromCharCode(3); // ETX character is label delimiter
  } else {
    instruction += ";";
  }

  // Check maximum instruction length
  if (instruction.length > this.bufferSize) {
    throw new RangeError(
      "The maximum size for a single instruction is " + this.bufferSize + " bytes (characters)."
    );
  }

  // Send the instruction. Wait for printer response if required
  if (waitForResponse) {

    console.log("Send and wait " + instruction);

    this.once("data", (data) => {
      console.log("Received: " + data);
      if (typeof callback === "function") callback(data);
    });
    this.transport.write(instruction);

  } else {

    console.log("Send " + instruction);

    this.transport.write(instruction, (results) => {
      if (typeof callback === "function") callback(results);
    });

  }

  return this;

};

/**
 * Draws the specified text.
 *
 * @todo text direction (double check with orientation)
 * @todo Add the missing character sets.
 *
 * @param {string} text The text to write
 * @param {Object} [options={}] Options to control how the text is drawn.
 * @param {number} [options.charset=0] The numerical ID of the character set to use to print
 * the label. These sets are defined by the [IS0 646](https://en.wikipedia.org/wiki/ISO/IEC_646)
 * standard.
 *
 * Currently, only the **ANSI** and the **ISO French** sets are available:
 *  - 0: ANSI
 *  - ~~1: 9825 Character Set~~
 *  - ~~2: French/German~~
 *  - ~~3: Scandinavian~~
 *  - ~~4: Spanish/Latin American~~
 *  - ~~6: JIS~~
 *  - ~~7: Roman Extensions~~
 *  - ~~8: Katakana~~
 *  - ~~9: ISO Internation Reference Version~~
 *  - ~~30: ISO Swedish~~
 *  - ~~31: ISO Swedish for Names~~
 *  - ~~32: ISO Norway, Version 1 (sic)~~
 *  - ~~33: ISO German~~
 *  - 34: ISO French
 *  - ~~35: ISO United Kingdom (sic)~~
 *  - ~~36: ISO Italian~~
 *  - ~~37: ISO Spanish~~
 *  - ~~38: ISO Portuguese~~
 *  - ~~39: ISO Norway, Version 2 (sic)~~
 * @param {number} [options.characterWidth=0.187] The width, in centimeters, to draw the text at. A
 * negative value mirrors the text for that dimension.
 * @param {number} [options.characterHeight=0.269] The height, in centimeters, to draw the text at.
 * A negative value mirrors the text for that dimension.
 * @param {number} [options.rotation=0] The rotation to apply to the text (in degrees).
 * @param {number} [options.slant=0] The slant (italic) with which characters are lettered (in
 * degrees).
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.drawText = function(text, options = {}) {

  // this._toIso646(text, options.charset);
  // return;

  // Defaults
  if (!options.charset) options.charset = 0;
  if (!options.characterWidth) options.characterWidth = .187;
  if (!options.characterHeight) options.characterHeight = .269;

  // Define the standard character set (CS) and select it (SS)
  this.queue("CS", options.charset);
  this.queue("SS");

  // Assign character width and height
  this.queue(
    "SI",
    [
      this._toHpglDecimal(options.characterWidth),
      this._toHpglDecimal(options.characterHeight)
    ]
  );

  // Assign correct rotation angle
  options.rotation = parseFloat(options.rotation);
  if ( isNaN(options.rotation) ) { options.rotation = 0; }

  let radRotation = options.rotation * Math.PI / 180;

  this.queue(
    "DI",
    [
      this._toHpglDecimal( Math.cos(radRotation) ),
      this._toHpglDecimal( Math.sin(radRotation) )
    ]
  );

  // Assign correct rotation angle
  options.slant = parseFloat(options.slant);
  if ( isNaN(options.slant) ) { options.slant = 0; }

  let radSlant = options.slant * Math.PI / 180;
  this.queue("SL", this._toHpglDecimal( Math.tan(radSlant) ) );

  // Send label command
  this.queue("LB", this._toIso646(text, options.charset));


  // @todo: DI, DR, SI, SR and SL

  return this;

};

/**
 * Converts a UTF-8 string to an ISO 646 character set.
 *
 * @private
 * @method _toIso646
 * @param {string} text The text to write
 * @param {number} [charset=0] The ISO 646 character set to convert the text to.
 * @returns {string} The converted text.
 */
Plotter.prototype._toIso646 = function(text, charset = 0) {

  // If no encoding is needed, bail out early.
  if (charset === 0) { return text; }

  let converted = text.split("").map((char) => {

    console.log(this);

    let found = this._charsets[charset][char];

    if (found) {

      if (!Array.isArray(found)) { found = [found]; }

      let encoded = "";

      found.forEach((element) => {
        encoded += String.fromCharCode(element);
      });

      return encoded;

    } else {
      return char;
    }

  });

  return converted.join("");

};

/**
 * Converts a numerical value to an integer that matches HPGL's requirements (must be between
 * -32768 and 32767).
 *
 * @private
 * @method _toHpglInteger
 * @param {number} value The text to write
 * @returns {int} The converted integer.
 */
Plotter.prototype._toHpglInteger = function(value) {

  value = parseInt(value, 10);

  if (value > 32767) {
    value = 32767;
  } else if (value < -32768) {
    value = -32768;
  }

  return value;

};

/**
 * Converts a numerical value to floating-point decimal value respecting HPGL's requirements (must
 * be between -128 and 127.9999 and must a maximum of 4 decimal places).
 *
 * @private
 * @method _toHpglDecimal
 * @param {number} value The text to write
 * @returns {number} The converted float.
 */
Plotter.prototype._toHpglDecimal = function(value) {

  value = parseFloat(value);

  if (value < -128) {
    value = -128;
  } else if (value > 127.9999) {
    value = 127.9999;
  }

  return value.toFixed(4);

};

/**
 * Draws a circle whose center is at the current location of the pen.
 *
 * @param {number} [radius=1] The circle's radius (in centimeters).
 * @param {number} [angle=5]  An integer between -180° and 180° representing the chord angle. The
 * most commonly used values are 0-180. In this case, the smaller the angle is, the smoother the
 * circle will be. Negative values make the circle start at 180° instead of 0°.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.drawCircle = function(radius = 1, angle = 5) {
  this.queue("CI", [this._toPlotterUnits(radius), Math.round(angle)]);
  return this;
};

/**
 * Draws a line from the current pen position to the specified destination position.
 *
 * @param {number} destX The `x` coordinate of the point where the the line should end (in cm).
 * @param {number} destY The `y` coordinate of the point where the the line should end (in cm).
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.drawLine = function(destX, destY) {

  this.drawLines([destX, destY]);
  return this;

};

/**
 * Draws a series of lines starting at the current pen position and going, in turn, to all x/y pairs
 * specified in the array.
 *
 * @param {number[]} [positions=[]] An array of line-end positions in the form
 * `[x1, y1, x2, y2, ...]`.
 * @param {Object} [options={}]
 * @param {number} [options.linePattern=7] Integer between `0` and `7`. Value `0` only prints dots
 * at line extremities only. Values `1` to `6` prints various types of dotted lines. Value `7`
 * (default) is a solid line.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 *
 * @todo add linePatternLength option
 */
Plotter.prototype.drawLines = function(positions = [], options = {}) {

  let positionsPU = [];

  // Check validity of line pattern
  options.linePattern = parseInt(options.linePattern);

  if (isNaN(options.linePattern) || options.linePattern < 0 || options.linePattern > 7) {
    options.linePattern = 7;
  }

  if (options.linePattern === 7) {
    this.queue("LT");
  } else {
    this.queue("LT", options.linePattern);
  }


  for (var i = 0; i < positions.length; i += 2) {

    let x = this._toPlotterUnits(positions[i]);
    let y = this._toPlotterUnits(positions[i+1]);
    let p = this._toHpglCoordinates(x, y);

    positionsPU.push(p.x, p.y);

  }

  if (positionsPU.length > 0) {
    this.queue("PD");
    this.queue("PA", positionsPU.join(","));
    this.queue("PU");
  }

  return this;

};

/**
 * Draws a rectangle from the current position to the specified destination position.
 *
 * @todo Validate input
 *
 * @param {number} destX The `x` coordinate of the target point of the rectangle (in cm).
 * @param {number} destY The `y` coordinate of the target point of the rectangle (in cm).
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.drawRectangle = function(destX, destY) {

  this.queue("EA", [this._toPlotterUnits(destX), this._toPlotterUnits(destY)]);
  return this;

};

/**
 * Lifts the pen and moves it to the specified `x` and `y` coordinates.
 *
 * @param {number} x Position along the `x` axis (in centimeters)
 * @param {number} y Position along the `y` axis (in centimeters)
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.moveTo = function(x, y) {

  let point = this._toHpglCoordinates(this._toPlotterUnits(x), this._toPlotterUnits(y));
  this.queue("PU", [point.x, point.y]);
  return this;

};

/**
 * Sets the velocity of the plotting pen. When the velocity `parameter` is set to `1`, the velocity
 * will be at its maximum of 38.1cm/s (default). So, if you set the `velocity` parameter to `0.1`,
 * the actual velocity will be 3.81cm/s.
 *
 * Any value equal or lower than `0` and any value above `1` will trigger the use of the default
 * velocity.
 *
 * @param {number} [velocity=1.0] A decimal number between `0` and `1`.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.setVelocity = function(velocity = 1.0) {

  velocity = parseFloat(velocity);

  if (isNaN(velocity) || velocity <= 0 || velocity > 38.1) {
    velocity = 38.1;
  }

  this.queue("VS", this._toHpglDecimal(velocity));

  return this;

};

/**
 * Queues an HPGL instruction to be sent to the device via the serial port. If any parameters are
 * present, they are appended to the 2-letter mnemonic and separated by commas.
 *
 * Unless you are very familiar with HPGL, this method should not be used directly. Instead, you can
 * use friendlier methods such as: [drawLines()]{@link Plotter#drawLines},
 * [drawText()]{@link Plotter#drawText}, [drawCircle()]{@link Plotter#drawCircle}, etc.
 *
 * @param {string} mnemonic 2-letter code for the HPGL command to send
 * @param {number|string|number[]|string[]} [params=[]] A string, a number or an or array of string
 * or numbers to use as parameter(s) for the instruction.
 * @param {Function} [callback=null]
 * @param {boolean} [waitForResponse=false] Whether to execute the callback function immediately
 * after the data has been sent or only after an answer has been received from the device.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.queue = function(
  mnemonic, params = [], callback = null, waitForResponse = false
) {

  // Make sure the params are wrapped in an array.
  if (!Array.isArray(params)) params = [params];

  // Add command object to queue.
  this._queue.push({
    instruction: mnemonic + params.join(","),
    callback: callback,
    waitForResponse: waitForResponse
  });

  console.log("Queue: " + mnemonic + params.join(","));

  // If the queue is not set for execution, set it.
  if (this._queueTimeOutId === 0) {
    this._queueTimeOutId = setTimeout(this._processQueue.bind(this), this._queueDelay);
    // this._processQueue();
  }

  return this;

};

/**
 * The queue is comprised of objects:...
 *
 * @private
 * @method _processQueue
 */
Plotter.prototype._processQueue = function() {

  console.log("Process queue");

  // Make sure any pending timeout is cancelled. We will add a new one if necessary. Exit if no
  // commands are pending.
  clearTimeout(this._queueTimeOutId);
  this._queueTimeOutId = 0;
  if (this._queue.length < 1) { return; }

  console.log("Send buffer size request.");

  // Before sending the command, we send a request to know the available buffer space on the device.
  this.send(String.fromCharCode(27) + ".B", (data) => {

    // If there is enough buffer space, we send the instruction. Otherwise, we set a timeout to
    // delay processing until later.
    if (this._queue[0].instruction.length < data) {

      console.log("Enough size.");

      // Send oldest available instruction first (and keep it for later check)
      var command = this._queue.shift();
      this.send(command.instruction, command.callback, command.waitForResponse);

      // If the command must wait for a response, we have to hold the queue until then. Otherwise,
      // if more commands are in the queue, process them.
      if (command.waitForResponse) {
        this.once("data", () => {
          // console.log("data");
          this._queueTimeOutId = setTimeout(this._processQueue.bind(this), this._queueDelay);
        })
      } else if (this._queue.length > 0) {
        this._queueTimeOutId = setTimeout(this._processQueue.bind(this), this._queueDelay);
        // this._processQueue();
      }

    } else {

      console.log("Not enough size.");

      this._queueTimeOutId = setTimeout(this._processQueue.bind(this), this._queueDelay);
    }

  }, true);

};

module.exports.Plotter = Plotter;
