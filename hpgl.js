/*

hpgl v0.6.1-alpha.1

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

var orientations = ["portrait", "landscape"];

/**
 * The `Rectangle` class represents an abstrat rectangle object which posesses a `width`, a `height`
 * and a position (`x`, `y`).
 *
 * @class
 *
 * @param x {Number} - Position of the rectangle's top-left corner along the **x** axis.
 * @param y {Number} - Position of the rectangle's topl-left corner along the **y** axis.
 * @param width {Number} - Width of the rectangle.
 * @param height {Number} - Height of the rectangle.
 */
var Rectangle = function (x = 0, y = 0, width = 0, height = 0) {

  this.x = x;
  this.y = y;
  this.width = width;
  this.height = height;

};

/**
 * The `Models` class is basically an enumeration class that provides information about all the
 * devices (only a few plotters for now) that are supported by the library.
 *
 * >Note: the only plotter that was tested so far is the **HP 7475A**. We are assuming the others
 * >are going to work based on the documentation we found for them.
 *
 * If you have a plotter that is not listed here, [contact the author](https://twitter.com/jpcote)
 * to see if we can add support for your device. Adding support for a new model simply involves
 * retrieving the information such as the one found in this class for other devices.
 *
 * @todo should this even be exported? allos the user to view the supported modesl ?!
 *
 * @class
 */
var Models = {

  // The undefined values are expected to be fetched from the device at startup.

  /**
   * Characteristics of the plotter
   *
   * @todo how can i move this inside the Models documentation without screwing up everything?
   *
   * @typedef {object} PlotterCharacteristics
   * @property {string} brand - Name of the manufacturer of the device.
   * @property {number} buffer - Size of the device's buffer in bytes (characters).
   * @property {string[]} instructions - An array of all the 2-letter HPGL instruction codes
   * supported by the device.
   * @property {string} model - Model of the device. The library attempts to retrieve that
   * information from the device itself.
   * @property {Object} papers - Supported paper formats
   * @property {string[]} papers.list - Array of all paper formats supported by the device.
   * @property {number} papers.~format~ - Information about a specific paper format. Substitute
   * `~format~` with the actual format from the `papers.list` array: **A3**, **A4**, **A**, **B**,
   * **C**, etc.
   * @property {number} papers.~format~.long - The length of the long side of the plottable are.
   * @property {number} papers.~format~.short - The length of the short side of the plottable are.
   * @property {number} papers.~format~.psCode - The paper size (**PS**) code for that paper (not
   * @property {number} papers.~format~.margins - The margins for that paper.
   * @property {number} papers.~format~.margins.landscape - Margins in **landscape** orientation.
   * @property {number} papers.~format~.margins.landscape.top - Top margin.
   * @property {number} papers.~format~.margins.landscape.right - Right margin.
   * @property {number} papers.~format~.margins.landscape.bottom - Bottom margin.
   * @property {number} papers.~format~.margins.landscape.left - Left margin.
   * @property {number} papers.~format~.margins.portrait - Margins in **portrait** orientation.
   * @property {number} papers.~format~.margins.portrait.top - Top margin.
   * @property {number} papers.~format~.margins.portrait.right - Right margin.
   * @property {number} papers.~format~.margins.portrait.bottom - Bottom margin.
   * @property {number} papers.~format~.margins.portrait.left - Left margin.
   * necessary on most devices).
   */

  /**
   * @type {PlotterCharacteristics}
   * @todo find margin information
   */
  "7470A": {
    brand: "HP",
    model: undefined,
    buffer: undefined,
    papers: {
      list: ["A4", "US"],
      A4: {long: 10900, short: 7650},
      US: {long: 10300, short: 7650}
    },
    instructions: [
      "AA", "AR", "CA", "CI", "CP", "CS", "DC", "DF", "DI", "DP", "DR", "DT", "IM", "IN", "IP",
      "IW", "LB", "LT", "OA", "OC", "OD", "OE", "OF", "OI", "OO", "OP", "OS", "OW", "PA", "PD",
      "PR", "PU", "SA", "SC", "SI", "SL", "SM", "SP", "SR", "SS", "TL", "UC", "VS", "XT", "YT"
    ]
  },

  /**
   * @type {PlotterCharacteristics}
   */
  "7475A": {
    brand: "HP",
    model: undefined,
    buffer: undefined,
    papers: {
      list: ["A", "B", "A4", "A3"],
      A: {
        long: 10365, short: 7962, psCode: 4,
        margins: {
          landscape: {top: 562, right: 463, bottom: 112, left: 348},
          portrait: {top: 348, right: 562, bottom: 463, left: 112}
        }
      },
      B: {
        long: 16640, short: 10365, psCode: 0,
        margins: {
          landscape: {top: 463, right: 112, bottom: 348, left: 562},
          portrait: {top: 112, right: 348, bottom: 562, left: 463}
        },
      },
      A4: {long: 11040, short: 7721, psCode: 4},
      A3: {long: 16158, short: 11040, psCode: 0}
    },
    resolution: {
      x: undefined,
      y: undefined
    },
    instructions: [
      "AA", "AR", "CA", "CI", "CP", "CS", "DC", "DF", "DI", "DP", "DR", "DT", "EA", "ER", "EW",
      "FT", "IM", "IN", "IP", "IW", "LB", "LT", "OA", "OC", "OD", "OE", "OF", "OH", "OI", "OO",
      "OP", "OS", "OW", "PA", "PD", "PR", "PS", "PT", "PU", "RA", "RO", "RR", "SA", "SC", "SI",
      "SL", "SM", "SP", "SR", "SS", "TL", "UC", "VS", "WG", "XT", "YT"
    ]
  },

  // 12800 bytes memory
  /**
   * @type {PlotterCharacteristics}
   * @todo find margin information
   */
  "7550A": {
    brand: "HP",
    model: undefined,
    buffer: undefined,
    papers: {
      list: ["A", "B", "A4", "A3"],
      A4: {long: 10870, short: 7600},
      A3: {long: 15970, short: 10870},
      A: {long: 10170, short: 7840},
      B: {long: 16450, short: 10170}
    },
    resolution: {
      x: undefined,
      y: undefined
    },
    instructions: [
      "AA", "AP", "AR", "AS", "BF", "BL", "CA", "CI", "CM", "CP", "CS", "CT", "CV", "DC", "DF",
      "DI", "DL", "DP", "DR", "DS", "DT", "EA", "EP", "ER", "ES", "EW", "FP", "FS", "FT", "GC",
      "GM", "IM", "IN", "IP", "IV", "IW", "KY", "LB", "LO", "LT", "NR", "OA", "OC", "OD", "OE",
      "OF", "OG", "OH", "OI", "OK", "OL", "OO", "OP", "OS", "OT", "OW", "PA", "PB", "PD", "PG",
      "PM", "PR", "PT", "PU", "RA", "RO", "RP", "RR", "SA", "SC", "SI", "SL", "SM", "SP", "SR",
      "SS", "TL", "UC", "UF", "VS", "WD", "WG", "XT", "YT"
    ]
  }

  // "7440A": {}, res: 40,40 // buffer: 60 ou 1024
  // "7580A": {},
  // "7585A": {},
  // "7585B": {},
  // "7586B": {}

};

module.exports.Models = Models;

/*
  HPGL Pen Plotters (http://www.winline.com/outdevs.html)

 HP 7220C
 HP ColorPro, HP 7470, HP 7475A, HP 7550A
 HP DraftPro (7570A), HP DraftPro DXL (7575A), HP DraftPro EXL (7576A)
 HP 7580A, HP 7580B, HP 7585A, HP 7585B, HP 7586B
 HP DraftMaster I (7595A), HP DraftMaster II (7596A)
 IOLINE LP 3700, IOLINE LP 4000
 Generic HPGL plotter driver supports Hewlett Packard, Océ, Calcomp, Mutoh, Graphtec, Summagraphics, IOLINE, ENCAD, Benson, Schlumberger, Aristo, Zünd and most other HPGL devices.
 */

/*

Cannot use HP-IB plotters such as:

  - 7225B
  - 9872A
  -

*/



var CharacterSets = {

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

    // circumflex (we send "a", then "backspace" and then the circumflex accent)
    "â": [97, 8, 94],
    "ê": [101, 8, 94],
    "ô": [111, 8, 94],
    "û": [117, 8, 94],

    // diaresis (we send "a", then "backspace" and then the diaresis mark)
    "ä": [97, 8, 126],
    "ë": [101, 8, 126],
    "ö": [111, 8, 126],
    "ü": [117, 8, 126]
  }

};

/**
 * The `Plotter` class provides methods to interact with an HPGL-compatible plotter such as those
 * made by HP starting in the 1980s. Various other makers also use or support the HPGL protocol
 * (Calcomp, for example).
 *
 * @todo create getter that returns the size of the plottable area
 * @todo the whole processQUeue mechanism needs to be looked at in details
 * @todo use ESC.O to know if device is ready (pinch wheel down,. etc.)
 * @todo create generic model for when the model is not listed
 * @todo verify if we can prepopulate the models fields
 *
 * @class
 */
var Plotter = function() {

  /**
   * @private
   * @member {Array}
   */
  this._queue = [];

  /**
   * @private
   * @member {number}
   */
  this._queueTimeOutId = 0;

  /**
   * @private
   * @member {string}
   */
  this._buffer  = "";

  /**
   * @private
   * @member {number}
   */
  this._maxConnectionDelay = 2000;

  /**
   * @private
   * @member {number}
   */
  this._queueDelay = 100;

  /**
   * @private
   * @member {number}
   */
  this._penThickness = 0.3;

  /**
   * The paper orientation currently selected (portrait or landscape). Paper orientation is assigned
   * during the connection to the device (with the [connect()]{@link Plotter#connect} function).
   * Currently, it cannot be changed on the fly.
   *
   * @type {string}
   * @readonly
   */
  this.orientation = "landscape";

  /**
   * The format of paper currently selected (A4, letter, B, etc.). Paper format is assigned during
   * the connection to the device (with the [connect()]{@link Plotter#connect} function). Currently,
   * it cannot be changed on the fly.
   *
   * @type {string}
   * @readonly
   */
  this.paper = "A";

  /**
   * The thickness of the drawing pen's nib in millimiters. The value must be between 0.1 and 5.
   * Specifying an invalid value will set the thickness to the default value of 0.3.
   *
   * Specifying the pen's thickness is particularly important when trying to shade shapes.
   *
   * @member {Number} Plotter#penThickness
   */
  Object.defineProperty(this, 'penThickness', {

    get: () => { return this._penThickness; },

    set: (value) => {

      if (value >= 0.1 && value <= 5) {
        this._penThickness = value;
      } else {
        this._penThickness = 0.3
      }
    }

  });

  /**
   * @type {PlotterCharacteristics}
   * @readonly
   */
  this.characteristics = undefined;

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

};

util.inherits(Plotter, EventEmitter);

/**
 * Opens a serial connection to the device using the specified serial transport layer. The following
 * serial modules are supported: [serialport](https://www.npmjs.com/package/serialport) and
 * [browser-serialport](https://www.npmjs.com/package/browser-serialport).
 *
 * @param {Object} transport - A transport object compatible with the
 * [serialport](https://www.npmjs.com/package/serialport) API interface.
 * Typically, it is one of: [serialport](https://www.npmjs.com/package/serialport),
 * [browser-serialport](https://www.npmjs.com/package/browser-serialport) or
 * [virtual-serialport](https://www.npmjs.com/package/virtual-serialport).
 * @param {Object} [options={}] Options to use while setting up the device.
 * @param {string} [options.paper="A"] - The paper size to use. Choices are:
 *   - **A**: ANSI A (8.5"x11", a.k.a "letter")
 *   - **B**: ANSI B (11"x17", a.k.a "tabloid")
 *   - **A4**: ISO A4 (210mm × 297mm)
 *   - **A3**: ISO A3 (297mm × 420mm)
 * @param {string} [options.orientation="landscape"] - The orientation of the paper: *landscape* or
 * *portrait*.
 * @param {number} [options.penThickness=0.3] - The drawing pen's thickness in millimiters (between
 * 0.1mm and 5mm).
 * @param {Function} [callback=null] - A function to trigger when the connect operation has
 * completed. This function will receive an `error` parameter is an error occured.
 *
 * @todo clean up this mess
 *
 */
Plotter.prototype.connect = function(transport, options = {}, callback = null) {

  this.transport = transport;

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

    // Retrieve device model. This must be done before the other instructions because they depend
    // on the characteristics property being set.
    this.queue("OI", (data) => {
      this.characteristics = Models[data];
      this.characteristics.model = data;



      // As soon as we know the model, we can use the 'papers' and 'orientation' properties.
      if (
        options.paper &&
        this.characteristics.papers.list.includes(options.paper.toUpperCase())
      ) {
        this.paper = options.paper.toUpperCase();
      }

      // Save different orientation if specified
      if (
        options.orientation &&
        orientations.includes(options.orientation.toLowerCase())
      ) {
        this.orientation = options.orientation.toLowerCase();
      }




      // Retrieve buffer size. As per the "Output Buffer Size Instruction" documentation (when in
      // block mode), we must first send an ESC.E and read the response before sending an ESC.L to
      // retrieve buffer size.
      this.queue(String.fromCharCode(27) + ".E", () => {}, true);
      this.queue(String.fromCharCode(27) + ".L", (data) => {
        this.characteristics.buffer = data;
      }, true);

      // Retrieve device resolution
      this.queue("OF", (data) => {
        [this.characteristics.resolution.x, this.characteristics.resolution.y] = data.split(",", 2);






        // The device's default orientation changes according to paper size. For example, on the
        // HP7475A, paper sizes A (letter) and A4 use a 'landscape' orientation whereas paper sizes B
        // (tabloid) and A3 use a 'portrait' orientation... So, if we want some sort of standard we must
        // rotate the orientation to whatever is requested (no matter the paper size). Other devices
        // (7470A, for example) only have one orientation).



        // Inform device of the paper size we wish to use. This is not necessary on devices that use the
        // same orientation for all paper sizes. It should be noted that, on some devices, this affects
        // orientation (see below).
        if ( this.characteristics.papers[this.paper].hasOwnProperty("psCode") ) {
          this.queue("PS" + this.characteristics.papers[this.paper].psCode);
        }

        // Check if the user-requested orientation, matches the device's default orientation
        // (landscape).
        if (this.orientation === "landscape") {

          this.queue("RO0");    // do not rotate (or rotate back to default)

        } else {

          // Check if the device supports rotation (not all do)
          if ( this.characteristics.instructions.includes("RO") ) {
            this.queue("RO90");   // rotate to other orientation
          } else {
            throw new Error("The device does not support the '" + this.orientation + "' orientation.");
          }

        }

        this.queue("IP");       // reassign P1 and P2
        this.queue("IW");       // reset plotting window

      }, true);




    }, true);













    // Wait for buffer size, model and resolution information to be retrieved before triggering
    // user callback. If it takes too long, report error.
    // @todo change this so we can input buffer, model and res in the Models class and only
    let start = Date.now();

    let intervalId = setInterval(() => {

      if (
        this.characteristics &&
        this.characteristics.buffer &&
        this.characteristics.model &&
        this.characteristics.resolution.x
      ) {

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
 * Converts a centimeter or inches value to its plotter units equivalent.
 *
 * The device's reported resolution is used to do the conversion. Since the reported resolution can
 * be a little different than the actual resolution there may be very small differences in the
 * rendering. For example, the HP7475A reports an `x` resolution of 40 units / millimiter while the
 * actual resolution is about 40.2 units / millimiter.
 *
 * @private
 * @param {number} value The value to convert.
 * @param {Boolean} [metric=true] If true, value is considered to be in centimeters. Otherwise, it
 * is considered to be in decimal inches.
 * @return {Number} The converted value rounded to the closest **integer**.
 */
Plotter.prototype._toPlotterUnits = function(value, metric = true) {

  if (metric) {
    return Math.round(value * 10 * this.characteristics.resolution.x);
  } else {
    return Math.round(value * 3.937007874015748 * this.characteristics.resolution.x);
  }

};

/**
 *
 * @param value
 * @param metric
 * @returns {number}
 * @private
 */
Plotter.prototype._fromPlotterUnits = function(value, metric = true) {

  if (metric) {
    return value / (10 * this.characteristics.resolution.x);
  } else {
    return value / (25.4 * this.characteristics.resolution.x);
  }

};

/**
 * Disconnects from the hardware device. This will cancel ongoing and upcoming plotting instructions
 * and close the serial connection. The device will be returned to its default state.
 *
 * @param {Function} callback A function to execute once the disconnection is complete. If an error
 * occurs, this function will receive an error object as its parameter.
 */
Plotter.prototype.disconnect = function(callback = null) {

  if ( !this.transport || this.transport.connectionId === -1 ) {
    callback();
  }

  console.log(this.transport);

  // Abort graphic instruction
  this.send(String.fromCharCode(27) + ".K");

  this.send("IN", () => {
    this.transport.close((error) => {
      if (callback) { callback(error); }
    });
  });

};

/**
 * Converts a point in 2D space (x, y) whose origin is in the top-left corner (+x going right, +y
 * going down) to the HPGL coordinates system which has its origin in the bottom-left corner (+x
 * going right, + y going up).
 *
 * @todo Add the option to use the native HPGL coordinates system (bypass this)
 *
 * @private
 * @param {number} x The `x` coordinate of the point.
 * @param {number} y The `y` coordinate of the point.
 * @return {Object} An object whose **x** and **y** properties have been transformed.
 */
Plotter.prototype._toAbsoluteHpglCoordinates = function(x, y) {

  if (this.orientation === "landscape") {
    y = this.characteristics.papers[this.paper].short - y;
  } else {
    x = this.characteristics.papers[this.paper].short - x;
  }

  return {x: x, y: y};

};

/**
 * Converts a vector in 2D space (x, y) whose origin is in the top-left corner (+x going right, +y
 * going down) to the HPGL coordinates system which has its origin in the bottom-left corner (+x
 * going right, + y going up).
 *
 * @todo Add the option to use the native HPGL coordinates system (bypass this)
 *
 * @private
 * @param {number} x The `x` coordinate of the point.
 * @param {number} y The `y` coordinate of the point.
 * @return {Object} An object whose **x** and **y** properties have been transformed.
 */
Plotter.prototype._toRelativeHpglCoordinates = function(x, y) {

  if (this.orientation === "landscape") {
    y = -y;
  } else {
    x = -x;
  }

  return {x: x, y: y};

};

/**
 * @private
 * @param {Object} data
 */
Plotter.prototype._onData = function(data) {

  console.log("_onData: " + data);

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
 * @param {Object} error An object containing information about the error.
 */
Plotter.prototype._onError = function(error) {

  console.log("ERROR!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  console.log(error);

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
 * Immediately sends a single raw HPGL instruction down the serial port. The validity of the
 * instruction's syntax is not checked at all. If you need validation, use the
 * [queue()]{@link Plotter#queue} function.
 *
 * Unless you are very familiar with HPGL, this method should not be used directly. Instead, you can
 * use friendlier methods such as: [drawLines()]{@link Plotter#drawLines},
 * [drawText()]{@link Plotter#drawText}, [drawCircle()]{@link Plotter#drawCircle}, etc.
 *
 * Note: only instructions supported by the target device will be transmitted. Unsupported
 * instructions will be silently ignored and the callback will not be executed.
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

  // Check maximum instruction length (we must first check if the buffer size is available because
  // it will not be for the very first instruction which is "IN".
  if (
    this.characteristics &&
    this.characteristics.buffer &&
    instruction.length > this.characteristics.buffer
  ) {
    throw new RangeError(
      "The maximum size for a single instruction is " + this.characteristics.buffer +
      " bytes (characters)."
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
 * Draws the specified text at the current pen position. The reference point is at the text's bottom
 * left.
 *
 * @todo text direction (double check with orientation)
 * @todo Add the missing character sets.
 *
 * @param {string} text The text to write
 * @param {Object} [options={}] Options to control how the text is drawn.
 * @param {number} [options.characterWidth=0.187] The width, in centimeters, of a single character
 * of text. A negative value mirrors the text for that dimension.
 * @param {number} [options.characterHeight=0.269] The height, in centimeters, of a single character
 * of text. A negative value mirrors the text for that dimension.
 * @param {number} [options.charset=0] The numerical ID of the character set to use to print
 * the label. These sets are defined by the [IS0 646](https://en.wikipedia.org/wiki/ISO/IEC_646)
 * standard.
 *
 * Currently, only the **ANSI** (0) and the **ISO French** (34) sets are available:
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
 * @param {number} [options.rotation=0] The counter-clockwise rotation to apply to the text (in
 * degrees).
 * @param {number} [options.scale=0] The scale factor used to size the characters. For example, a
 * `scale` value of 2.0 doubles the character size while a `scale` of 0.5 makes it half as big.
 * Scaling is applied after the `characterWidth` and `characterHeight` parameters are applied (if
 * any). A negative value mirrors the character across both dimensions.
 * @param {number} [options.slant=0] The slant (italic) with which characters are lettered (in
 * degrees). A typical range of values is between -45° and +45°.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.drawText = function(text, options = {}) {

  // Defaults
  if ( ![0, 34].includes(options.charset) ) options.charset = 0;
  options.characterWidth = parseFloat(options.characterWidth) || .187;
  options.characterHeight = parseFloat(options.characterHeight) || .269;
  options.rotation = parseFloat(options.rotation) || 0;
  options.scale = parseFloat(options.scale) || 1;
  options.slant = parseFloat(options.slant) || 0;

  // Define the standard character set (CS) and select it (SS)
  this.queue("CS" + options.charset);
  this.queue("SS");

  // Assign character width and height
  this.queue(
    "SI" +
    this._toHpglDecimal(options.characterWidth * options.scale) + "," +
    this._toHpglDecimal(options.characterHeight * options.scale)
  );

  // If a 'rotation' is requested, it must be adjusted for the paper's orientation
  let radRotation = options.rotation * Math.PI / 180;

  // If we are in portrait mode, we must flip the text 180°.
  if (this.orientation !== "landscape") radRotation += Math.PI;

  this.queue(
    "DI" +
    this._toHpglDecimal( Math.cos(radRotation) ) + "," +
    this._toHpglDecimal( Math.sin(radRotation) )
  );

  // Assign correct slant
  let radSlant = options.slant * Math.PI / 180;
  this.queue("SL" + this._toHpglDecimal( Math.tan(radSlant) ) );

  // Send label command
  this.queue("LB" + this._toIso646(text, options.charset));

  return this;

};

/**
 * Converts a UTF-8 string to an ISO 646 character set.
 *
 * @private
 * @param {string} text The text to write
 * @param {number} [charset=0] The ISO 646 character set to convert the text to.
 * @returns {string} The converted text.
 */
Plotter.prototype._toIso646 = function(text, charset = 0) {

  // If no encoding is needed, bail out early.
  if (charset === 0) { return text; }

  let converted = text.split("").map((char) => {

    let found = CharacterSets[charset][char];

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
 * be between -128 and 127.9999 and must a maximum of 4 decimal places). The return value is
 * actually a string.
 *
 * @private
 * @param {number} value The text to write
 * @returns {string} The converted float.
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
  this.queue("CI" + this._toPlotterUnits(radius) + "," + Math.round(angle));
  return this;
};

/**
 * Draws a line from the current pen position to the specified destination position (x, y).
 *
 * @param {number} x The `x` coordinate of the point where the the line should end (in cm).
 * @param {number} y The `y` coordinate of the point where the the line should end (in cm).
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.drawLine = function(x, y) {

  this.drawLines([x, y]);
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

  // Since this command can be very long, we break it into chunks no larger than the buffer size
  let chunks = [[]], current = 0;

  // Check validity of line pattern
  // options.linePattern = options.linePattern || 7;
  options.linePattern = parseInt(options.linePattern);

  if (isNaN(options.linePattern) || options.linePattern < 0 || options.linePattern > 7) {
    options.linePattern = 7;
  }

  if (options.linePattern === 7) {
    this.queue("LT");
  } else {
    this.queue("LT" + options.linePattern);
  }

  // Positions are converted to plotter units and pushed in chunks no larger than the buffer
  for (var i = 0; i < positions.length; i += 2) {

    let x = this._toPlotterUnits(positions[i]);
    let y = this._toPlotterUnits(positions[i+1]);
    let p = this._toAbsoluteHpglCoordinates(x, y);

    // Chunks must be smaller than the total buffer size. For each chunk, we send "PA", then the
    // positions (separated by commas) and finally ";". So, before adding a new position, we must
    // make sure that this new position does no bring the chunk above the buffer's size. We take the
    // length for the new position, add 3 bytes for "PA" and ";" and add that to the existing length
    // of the chunk. If it exceeds the buffer's size, we create a new chunk.
    if (
      3 + chunks[current].join(",").length + ("," + p.x + "," + p.y).length
      > this.characteristics.buffer
    ) {
      current++;
      chunks[current] = [];
    }
    chunks[current].push(p.x, p.y);

  }

  // Only queue if there is actual data in the array. We lower the pen, go through each chunk and
  // then lift the pen up.
  if (chunks[0].length > 0) {

    this.queue("PD");

    chunks.forEach((chunk) => {
      this.queue("PA" + chunk.join(","));
    });

    this.queue("PU");

  }

  return this;

};

/**
 * Draws a rectangle with the specified `width` and `height` starting at the current pen position.
 * When drawing is done, the pen is returned to the starting point.
 *
 * If no `height` is specified, the `height` will be equal to the `width`, thus drawing a square.
 *
 * @todo Add 'fill' option with RR and FT
 *
 * @param {number} width The width of the rectangle (in cm).
 * @param {number} [height] The height of the rectangle (in cm).
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.drawRectangle = function(width, height) {

  if ( parseFloat(width) ) {
    if ( !parseFloat(height) ) { height = width; }
  } else {
    throw new Error ("The width must be specified.")
  }

  let target = this._toRelativeHpglCoordinates(
    this._toPlotterUnits(width),
    this._toPlotterUnits(height)
  );
  this.queue("ER" + target.x + "," + target.y);

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

  let point = this._toAbsoluteHpglCoordinates(this._toPlotterUnits(x), this._toPlotterUnits(y));
  this.queue("PU" + point.x + "," + point.y);
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

  this.queue("VS" + this._toHpglDecimal(velocity));

  return this;

};

/**
 * Returns the plottable area for the current paper and orientation.
 *
 * @param {Boolean} [metric=true] Whether to use metric (cm, default) or imperial values (inches).
 * @returns {Rectangle} A `Rectangle` object which contains information about the width, the height
 * and the position (x, y) of the plottable area.
 */
Plotter.prototype.getPlottableArea = function(metric = true) {

  let paper = this.characteristics.papers[this.paper],
      x = 0,
      y = 0,
      width = 0,
      height = 0;

  if (this.orientation === "portrait") {
    width = this._fromPlotterUnits(paper.short, metric);
    height = this._fromPlotterUnits(paper.long, metric);
  } else {
    width = this._fromPlotterUnits(paper.long, metric);
    height = this._fromPlotterUnits(paper.short, metric);
  }

  // If margins are defined
  if (paper.margins) {
    x = this._fromPlotterUnits(paper.margins[this.orientation].left);
    y = this._fromPlotterUnits(paper.margins[this.orientation].top);
  }

  return new Rectangle(x, y, width, height);

};

/**
 */
Plotter.prototype.getMargins = function(metric = true) {

  let paper = this.characteristics.papers[this.paper];
  let margins = paper.margins[this.orientation];

  margins.top = this._fromPlotterUnits(margins.top, metric);
  margins.right = this._fromPlotterUnits(margins.right, metric);
  margins.bottom = this._fromPlotterUnits(margins.bottom, metric);
  margins.left = this._fromPlotterUnits(margins.left, metric);

};

/**
 * Queues a single HPGL instruction, a single RS-232-C device control command or a series of such
 * instructions concatenated in a string. The instructions will be sent as soon as the device's
 * buffer can accept them.
 *
 * Unless you are very familiar with HPGL or RS-232-C, you should not use this method directly.
 * Instead, you can use friendlier methods such as: [drawLines()]{@link Plotter#drawLines},
 * [drawText()]{@link Plotter#drawText}, [drawCircle()]{@link Plotter#drawCircle}, etc.
 *
 * @param {string} instruction - Any valid HPGL instruction(s) or RS-232-C command(s).
 * @param {Function} [callback=null] A function to call once the data has been sent to the device
 * (default) or when an answer has been received from the device (when `waitForResponse` is true).
 * Note that if `waitForResponse` is `true`, the callback function will receive a single parameter
 * containing the data received from the device. Also note that if the instruction string contains
 * multiple commands, the callback will be fired after each command.
 * @param {boolean} [waitForResponse=false] Whether to execute the callback function immediately
 * after the data has been sent or only after an answer has been received from the device.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.queue = function(instruction, callback = null, waitForResponse = false) {

  // Check if we are dealing with a single instruction or multiple instructions concatenated in one
  // string. To do that, we build a regex that will break the string on semicolons, newlines or CTX
  // characters (for label). Then we filter out empty elements.
  let regex = new RegExp("[;\n" + String.fromCharCode(3) + "]");
  let commands = instruction.split(regex).filter(function(n) { return n.length >= 2; });

  // Add command(s) to queue (tack parameters at the end)
  commands.forEach((command) => {

    this._queue.push({
      instruction: command,
      callback: callback,
      waitForResponse: waitForResponse
    });

    console.log("Queue: " + command);

  });

  // If the queue is not set for execution, set it.
  if (this._queueTimeOutId === 0) {
    this._queueTimeOutId = setTimeout(this._processQueue.bind(this), this._queueDelay);
  }

  return this;

};

/**
 * Processes the queue of pending instructions.
 *
 * The queue is comprised of objects:...
 *
 * @private
 */
Plotter.prototype._processQueue = function() {

  console.log("Process queue");

  // Make sure any pending timeout is cancelled. We will add a new one if necessary. Exit if no
  // commands are pending.
  clearTimeout(this._queueTimeOutId);
  this._queueTimeOutId = 0;
  if (this._queue.length < 1) { return; }

  // Before sending the command, we send a request to know the available buffer space on the device.
  this.send(String.fromCharCode(27) + ".B", (data) => {

    // If there is enough buffer space, we send the instruction. Otherwise, we set a timeout to
    // delay processing until later.
    if (this._queue[0].instruction.length < data) {

      console.log("Enough buffer space: " + data);

      // Send oldest available instruction first (and keep it for later check)
      var command = this._queue.shift();
      this.send(command.instruction, command.callback, command.waitForResponse);

      // If the command must wait for a response, we have to hold the queue until then. Otherwise,
      // if more commands are in the queue, process them.
      if (command.waitForResponse) {
        this.once("data", () => {
          console.log("data");
          this._queueTimeOutId = setTimeout(this._processQueue.bind(this), this._queueDelay);
        })
      } else if (this._queue.length > 0) {
        this._queueTimeOutId = setTimeout(this._processQueue.bind(this), this._queueDelay);
        // this._processQueue();
      }

    } else {

      console.log("Not enough buffer space (instruction: " + this._queue[0].instruction.length + ", buffer: " + data);

      this._queueTimeOutId = setTimeout(this._processQueue.bind(this), this._queueDelay);
    }

  }, true);

};

module.exports.Plotter = Plotter;
