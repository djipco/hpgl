'use strict';

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
 * @param {Object} transport A transport object compatible with node-serialport's interface.
 * @param {Object} options
 * @param {Function} callback
 */
var Plotter = function(transport, options = {}, callback) {

  this.transport = transport;

  this.transport.open(function (error) {

    if (error) {
      alert('Could not connect to the requested serial port:\n' + this.transport.path);
    } else {
      this.init();
      callback();
    }

  }.bind(this));




  // /**
  //  * [read-only] Array of all the devices supported by this library.
  //  * @property supportedDevices
  //  * @type {string[]}
  //  * @readOnly
  //  */
  // Object.defineProperty(this, 'supportedDevices', {
  //   enumerable: true,
  //   writable: false,
  //   value: [
  //     'PhidgetInterfaceKit',
  //     'PhidgetBridge',
  //     'PhidgetLED',
  //     'PhidgetRFID',
  //     'PhidgetStepper'
  //   ]
  // });

  /**
   * The interval (in milliseconds) to wait before sending a new instruction (so as to not overflow
   * the serial connection).
   *
   * @property queueDelay
   * @type {int}
   * @default 100
   */
  this.queueDelay = 100;


  this._queue = [];
  this._queueTimeOutId = 0;

};


// util.inherits(Phidget, EventEmitter);

/**
 *
 * @method init
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 * @chainable
 */
Plotter.prototype.init = function() {

  this.transport.on('data', function(data) {
    console.log('Data received: ' + data);
  });

  this.transport.on('error', function(error) {
    console.log('Error received: ' + error);
  });

};

/**
 *
 * Immediately sends an HPGL instruction to the connected device. The instruction is automatically
 * terminated with a semicolon.
 *
 * @method send
 * @param {String} instruction The instruction to send
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 * @chainable
 */
Plotter.prototype.send = function(instruction) {

  this.transport.write(instruction + ";", function(err, results) {
    console.log('err ' + err);
    console.log('results ' + results);
  });

  return this;

};

/**
 *
 * Queues an HPGL instruction to be sent to the connected device. If present, parameters are
 * appended to the mnemonic and separated by commas.
 *
 * @method queue
 * @param {String} mnemonic 2-letter code for the HPGL command to send
 * @param {Array} params
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 * @chainable
 */
Plotter.prototype.queue = function(mnemonic, params = []) {
  this._queue.push(mnemonic + params.join(","));

  if (this._queueTimeOutId === 0) {
    this._queueTimeOutId = setTimeout(this._processQueue, this.queueDelay);
  }

  return this;
};

/**
 *
 // * @method send
 // * @param {String} mnemonic 2-letter code for the HPGL command to send
 // * @param {Array} params
 // * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 // * @chainable
 */
Plotter.prototype._processQueue = function() {


  if (this._queue.length > 0) {

  }

};

module.exports.Plotter = Plotter;

