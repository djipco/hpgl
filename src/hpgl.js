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
 * By default, this library uses the Node.js [serialport](https://www.npmjs.com/package/serialport)
 * module for serial communication. This module offers native support on Mac, Linux and Windows. The
 * library can also use the [browser-serialport](https://www.npmjs.com/package/browser-serialport)
 * module which uses the `chrome.serial` API (only available in Chrome Apps and NW.js). For
 * debugging purposes, it can also use the
 * [virtual-serialport](https://www.npmjs.com/package/virtual-serialport).
 *
 * @class Plotter
 * @constructor
 */
var Plotter = function() {

  // Private properties
  this._queue = [];
  this._queueTimeOutId = 0;
  this._paper = "letter";

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
   * [read-only] Array of all the paper sizes supported by the device
   * @property supportedPapers
   * @type {String[]}
   * @readOnly
   */
  Object.defineProperty(this, 'supportedPapers', {
    enumerable: true,
    writable: false,
    value: [
      'a',
      'letter',
      'a4',
      'b',
      'tabloid',
      'a3'
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
 *   - *A* or *letter* (default)
 *   - *B* or *tabloid*
 *   - *A4*
 *   - *A3*
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
  if ( options.paper && this.supportedPapers.includes(options.paper.toLowerCase()) ) {
    this._paper = options.paper.toLowerCase();
  }

  this.transport.open(function (error) {

    if (error) {

      this._onTransportError(error);

    } else {

      this.transport.on('data', this._onData);
      this.transport.on('error', this._onTransportError);

      // Resets the device to its 'power on' status (same as DF plus: pen is raised, errors are
      // cleared, rotation set to 0, scaling points reset).
      this.queue("IN");

      // Set the initial point (0,0 in this case)
      this.queue("IP");

      // Select paper size. Basically, this tells the device which paper orientation to use. A4 and
      // Letter (A) use the same orientation while A3 and Tabloid (B) use the other orientation.
      if ( ["b", "a3", "tabloid"].includes(this._paper) ) {
        this.queue("PS", 0);
      } else {
        this.queue("PS", 127);
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
 * @method cmToPlotterUnits
 * @param {Number} cm The centimeter value to convert.
 * @return {int} The converted value rounded to the closest **integer**.
 */
Plotter.prototype.cmToPlotterUnits = function(cm) {
  return Math.round(cm / 0.002488);
};

/**
 * @private
 * @param {Object} data
 * @method _onData
 */
Plotter.prototype._onData = function(data) {
  console.log('Data received: ' + data);
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
 * @param {String} instruction The instruction to send
 * @param {Function} [callback] A function to call once the data has been sent. This function will
 * receive an error object, if something went wrong.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 * @chainable
 */
Plotter.prototype.send = function(instruction, callback) {

  // Add termination character. A semicolon is used unless we are printing a label (which requires
  // special termination char: ETX).
  if (instruction.substring(0, 2) === "LB") {
    instruction += String.fromCharCode(3); // ETX character is label delimiter
  } else {
    instruction += ";";
  }

  // console.log("send: " + instruction);

  this.transport.write(instruction, function(results) {
    if (typeof callback === "function") callback(results);
  });

  return this;

};

/**
 * Draws a text label. CHARACTER SETS DO NOT WORK YET!
 *
 * @method drawLabel
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
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 * @chainable
 */
Plotter.prototype.drawLabel = function(text, options = {}) {

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
      this.convertToHpglDecimal(options.characterWidth),
      this.convertToHpglDecimal(options.characterHeight)
    ]
  );

  // @todo: DI, DR, SI, SR and SL

  this.queue("LB", text);

  return this;

};


/**
 * Converts a numerical value to an integer that matches HPGL's requirements (must be between
 * -32768 and 32767).
 *
 * @method convertToHpglInteger
 * @param {Number} value The text to write
 * @returns {int} The converted integer.
 */
Plotter.prototype.convertToHpglInteger = function(value) {

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
 * @method convertToHpglInteger
 * @param {Number} value The text to write
 * @returns {int} The converted integer.
 */
Plotter.prototype.convertToHpglDecimal = function(value) {

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
  this.queue("CI", [this.cmToPlotterUnits(radius), Math.round(angle)]);
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
  this.queue("PU", [this.cmToPlotterUnits(x), this.cmToPlotterUnits(y)]);
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
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 * @chainable
 */
Plotter.prototype.queue = function(mnemonic, params = []) {


  if (!Array.isArray(params)) params = [params];

  // console.log("queued: " + mnemonic + params.join(","));

  this._queue.push(mnemonic + params.join(","));

  if (this._queueTimeOutId === 0) {
    console.log("new queueTimeout: " + this.queueDelay);
    this._queueTimeOutId = setTimeout(this._processQueue.bind(this), this.queueDelay);
  }

  return this;

};

/**
 * @private
 * @method _processQueue
 */
Plotter.prototype._processQueue = function() {

  // console.log("processing queue");

  this._queueTimeOutId = 0;

  if (this._queue.length > 0) {
    this.send(this._queue.shift());
  }

  if (this._queue.length > 0) {
    this._queueTimeOutId = setTimeout(this._processQueue.bind(this), this.queueDelay);
  }

};

module.exports.Plotter = Plotter;
