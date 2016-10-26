'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

/**
 * The `hpgl` library makes it possible to interact with plotters and printers that support the
 * *Hewlett-Packard Graphics Language* (a.k.a. *hpgl*). This language is the de facto standard for
 * most plotters.
 *
 * @module hpgl
 */
module.exports = {};

/**
 * The `Plotter` class provides methods to interact with an HPGL-compatible plotter such as those
 * made by HP starting in the 1980s. Various other makers also use or support the HPGL protocol.
 *
 * #### Transport Layer
 *
 * By default, this library uses the Node.js [serialport](https://www.npmjs.com/package/serialport)
 * module for serial communication. This module offers native support on Mac, Linux and Windows. The
 * library can also use the [browser-serialport](https://www.npmjs.com/package/browser-serialport)
 * module which uses the `chrome.serial` API (only available in Chrome Apps and NW.js). For
 * debugging purposes, it can also use the
 * [virtual-serialport](https://www.npmjs.com/package/virtual-serialport).
 *
 * #### Coordinate Sytem
 *
 * The coordinate system is anchored in the top-left of the paper sheet. Positive `x` goes right and
 * positive `y` goes down. Some plotters work differently but I found it easier to stick with the
 * computer screen standard.
 *
 * @class Plotter
 * @constructor
 */
var Plotter = function() {

  // Private properties
  this._plottingAreas = {
    A: {long: 10365, short: 7962},
    B: {long: 16640, short: 10365},
    A4: {long: 11040, short: 7721},
    A3: {long: 16158, short: 11040}
  };
  this._synchronousInstructions = [
    "OA",
    "OC",
    "OD",
    "OE",
    "OF",
    "OH",
    "OI",
    "OO",
    "OP",
    "OS",
    "OW",
  ];
  this._queue = [];
  this._queueTimeOutId = 0;
  this._paper = "A";
  this._orientation = "landscape";
  this._buffer  = "";

  /**
   * The interval (in milliseconds) to wait before sending a new instruction (so as to not overflow
   * the serial connection).
   *
   * @property queueDelay
   * @type {int}
   * @default 100
   */
  this.queueDelay = 50;

  /**
   * The model name as reported by the device. Only available after the `ready` event has been
   * fired.
   *
   * @property model
   * @type {String}
   */
  this.model = undefined;

  /**
   * The device's capabilities:
   *
   *  -
   *
   * @property capabilities
   * @type {Object}
   */
  this.capabilities = undefined;

  /**
   * [read-only] Array of all the paper sizes supported by the device
   * @property supportedPapers
   * @type {String[]}
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
 * Opens a serial connection to the device.
 *
 * @method connect
 * @param {Object} transport A transport object compatible with the `serialport` API interface.
 * @param {Object} [options]
 * @param {String} [options.paper="A"] The paper size to use. Choices are:
 *   - *A* (a.k.a "letter")
 *   - *B* (a.k.a "tabloid")
 *   - *A4*
 *   - *A3*
 * @param {String} [options.orientation="landscape"] The orientation of the paper: *landscape* or
 * *portrait*.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 * @chainable
 */
Plotter.prototype.connect = function(transport, options = {}) {

  /**
   * An object that is used for serial communication. This object must adhere to the `serialport`
   * object's interface.
   *
   * @property transport
   * @type {Object}
   */
  this.transport = transport;

  // Assign different paper size if specified
  if ( options.paper && this.supportedPapers.includes(options.paper.toUpperCase()) ) {
    this._paper = options.paper.toUpperCase();
  }

  // Assign different orientation if specified
  if (
    options.orientation &&
    ["landscape", "portrait"].includes(options.orientation.toLowerCase())
  ) {
    this._orientation = options.orientation.toLowerCase();
  }

  this.transport.open(function (error) {

    if (error) {

      this._onTransportError(error);

    } else {

      this.transport.on('data', this._onData.bind(this));
      this.transport.on('error', this._onTransportError.bind(this));

      // Retrieve device model
      this.queue("OI", [], (data) => {
        this.model = data;
        console.log("Response OI: " + data);
      }, true);

      // Retrieve capabilities
      this.queue("OO", [], (data) => {
        console.log("Response OF: " + data);
      }, true);

      // Resets the device to its 'power on' status (same as DF plus: pen is raised, errors are
      // cleared, rotation set to 0, scaling points reset).
      this.queue("IN");

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
      // parameters which makes it imprecise.

      /**
       * Event emitted when a serial connection is successfully established to the device.
       * @event ready
       */
      setTimeout(function () {
        this.emit("ready");
      }.bind(this), 50);

    }

  }.bind(this));

};

/**
 * Converts centimeters to plotter units. According to the documentation, a plotter unit is
 * equivalent to 0.02488 millimeters.
 *
 * @private
 * @method _toPlotterUnits
 * @param {Number} cm The centimeter value to convert.
 * @return {int} The converted value rounded to the closest **integer**.
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
 * @param {Number} x The x coordinate of the point (must be expressed in plotter units).
 * @param {Number} y The y coordinate of the point (must be expressed in plotter units).
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

  if (data.toString() === "\r") {
    // console.log("Receive: " + this._buffer);
    this.emit("data", this._buffer);
    this._buffer = "";
  } else {
    this._buffer += data.toString();
  }

};

/**
 * @private
 * @method _onTransportError
 * @param {Object} error An object containing information about the error.
 */
Plotter.prototype._onTransportError = function(error) {

  /**
   * Event emitted when an error occurs. The specified function will receive an object with
   * information about the error.
   *
   * @event ready
   * @param {Object} error
   */
  this.emit("error", error);

};

/**
 *
 * Immediately sends an HPGL instruction down the serial port. The instruction is automatically
 * terminated with a semicolon.
 *
 * @method send
 * @param {String} instruction The instruction to send (unterminated).
 * @param {Function} [callback=null] A function to call once the data has been sent to the device
 * (default) or when an answer has been received from the device.
 * @param {Boolean} [waitForResponse=false] Whether to execute the callback when the data is sent or
 * when a response is received.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 * @chainable
 */
Plotter.prototype.send = function(instruction, callback = null, waitForResponse = false) {

  // Add termination character. A semicolon is used unless we are printing a label (which requires
  // a special termination char: ETX).
  if (instruction.substring(0, 2) === "LB") {
    instruction += String.fromCharCode(3); // ETX character is label delimiter
  } else {
    instruction += ";";
  }

  console.log("Send: " + instruction);

  // Send the instruction. Wait for printer response if required
  if (waitForResponse) {

    this.once("data", (data) => {
      // console.log("data2");
      if (typeof callback === "function") callback(data);
    });
    this.transport.write(instruction);

  } else {

    this.transport.write(instruction, (results) => {
      if (typeof callback === "function") callback(results);
    });

  }


  return this;

};

/**
 * Draws a text label.
 *
 * @todo text direction (double check with orientation)
 * @todo charsets
 *
 * @method drawText
 * @param {String} text The text to write
 * @param {Object} [options]
 * @param {Number} [options.characterSet=0] The numerical ID of the character set to use to print
 * the label. Available sets are:
 *  - 0: ANSI
 *  - 1: 9825 Character Set
 *  - 2: French/German
 *  - 3: Scandinavian
 *  - 4: Spanish/Latin American
 *  - 6: JIS
 *  - 7: Roman Extensions
 *  - 8: Katakana
 *  - 9: ISO Internation Reference Version
 *  - 30: ISO Swedish
 *  - 31: ISO Swedish for Names
 *  - 32: ISO Norway, Version 1 (sic)
 *  - 33: ISO German
 *  - 34: ISO French
 *  - 35: ISO United Kingdom (sic)
 *  - 36: ISO Italian
 *  - 37: ISO Spanish
 *  - 38: ISO Portuguese
 *  - 39: ISO Norway, Version 2 (sic)
 * @param {Number} [options.characterWidth=0.187] The width, in centimeters, to draw the text at. A
 * negative value mirrors the text for that dimension.
 * @param {Number} [options.characterHeight=0.269] The height, in centimeters, to draw the text at.
 * A negative value mirrors the text for that dimension.
 * @param {Number} [options.rotation=0] The rotation to apply to the text (in degrees).
 * @param {Number} [options.slant=0] The slant (italic) with which characters are lettered (in
 * degrees).
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 * @chainable
 */
Plotter.prototype.drawText = function(text, options = {}) {

  // Defaults
  if (!options.characterSet) options.characterSet = 0;
  if (!options.characterWidth) options.characterWidth = .187;
  if (!options.characterHeight) options.characterHeight = .269;

  // Define the standard character set (CS) and select it (SS)
  this.queue("CS", options.characterSet);
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




  this.queue("LB", text);


  // @todo: DI, DR, SI, SR and SL

  return this;

};


/**
 * Converts a numerical value to an integer that matches HPGL's requirements (must be between
 * -32768 and 32767).
 *
 * @private
 * @method _toHpglInteger
 * @param {Number} value The text to write
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
 * @param {Number} value The text to write
 * @returns {Number} The converted float.
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
 * @method drawCircle
 * @param {Number} [radius=1] The circle's radius (in centimeters).
 * @param {Number} [angle=5]  An integer between -180 and 180 degrees representing the chord angle.
 * The most commonly used values are 0-180. In this case, the smaller the angle is, the smoother the
 * circle will be. Negative values make the circle start at 180 degrees instead of 0.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 * @chainable
 */
Plotter.prototype.drawCircle = function(radius = 1, angle = 5) {
  this.queue("CI", [this._toPlotterUnits(radius), Math.round(angle)]);
  return this;
};

/**
 * Draws a line from the current position to the specified destination position.
 *
 * @method drawLine
 * @param {Number} destX The `x` coordinate of the end of the line (in cm).
 * @param {Number} destY The `y` coordinate of the end of the line (in cm).
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 * @chainable
 */
Plotter.prototype.drawLine = function(destX, destY) {

  this.drawLines([destX, destY]);
  return this;

};

/**
 * Draws a series of lines starting at the current pen position and going, in turn, to all x/y pairs
 * specified in the array.
 *
 * @method drawLines
 * @param {Array} positions An array of line-end ositions in the form `[x1, y1, x2, y2, ...]`
 * @param {Object} [options]
 * @param {int} [options.linePattern=7] Integer between 0 and 7. Value 0 prints dots at extermities
 * only. Values 1 to 6 prints various types of dotted lines. Value 7 (default) is a solid line.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 * @chainable
 *
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
 * @method drawRectangle
 * @param {Number} destX The `x` coordinate of the end of the line (in cm).
 * @param {Number} destY The `y` coordinate of the end of the line (in cm).
 * @param {Boolean} liftPenWhenDone Whether to automatically lift the pen when done p;otting the
 * line.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 * @chainable
 */
Plotter.prototype.drawRectangle = function(destX, destY, liftPenWhenDone = false) {

  this.queue("EA", [this._toPlotterUnits(destX), this._toPlotterUnits(destY)]);
  // if (liftPenWhenDone) { this.queue("PU"); }
  return this;

};

/**
 * Lifts the pen and moves it to the specified x and y coordinates.
 *
 * @method moveTo
 * @param {Number} x Position along the **x** axis (in centimeters)
 * @param {Number} y Position along the **y** axis (in centimeters)
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 * @chainable
 */
Plotter.prototype.moveTo = function(x, y) {

  let point = this._toHpglCoordinates(this._toPlotterUnits(x), this._toPlotterUnits(y));
  this.queue("PU", [point.x, point.y]);
  return this;

};

/**
 * Sets the velocity of the plotting pen. When the velocity `parameter` is set to `1`, the velocity
 * will be at its maximum of 38.1cm/s (default). When the `velocity` parameter is set to 0.1, the
 * actual velocity will be 3.81cm/s.
 *
 * @method setVelocity
 * @param {Number} velocity A decimal number between 0 and 1.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 * @chainable
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
 *
 * Queues an HPGL instruction to be sent to the serial port. If any parameters are present, they are
 * appended to the 2-letter mnemonic and separated by commas.
 *
 * @method queue
 * @param {String} mnemonic 2-letter code for the HPGL command to send
 * @param {Number|String|Array} params A string, a number or an or array of string or numbers to use
 * as parameter(s) for the instruction.
 * @param {Function=null} callback
 * @param {Boolean=false} waitForResponse
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 * @chainable
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
    this._queueTimeOutId = setTimeout(this._processQueue.bind(this), this.queueDelay);
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

  // Make sure any pending timeout is cancelled
  clearTimeout(this._queueTimeOutId);
  this._queueTimeOutId = 0;

  // If the queue is not empty, send oldest available instruction (and keep it for later check)
  if (this._queue.length > 0) {
    var command = this._queue.shift();
    this.send(command.instruction, command.callback, command.waitForResponse);
  }

  // If the command must wait for a response, we have to hold the queue until then. Otherwise, if
  // more commands are in the queue, process them.
  if (command.waitForResponse) {
    this.once("data", () => {
      // console.log("data");
      this._queueTimeOutId = setTimeout(this._processQueue.bind(this), this.queueDelay);
    })
  } else if (this._queue.length > 0) {
    this._queueTimeOutId = setTimeout(this._processQueue.bind(this), this.queueDelay);
  }

};

module.exports.Plotter = Plotter;
