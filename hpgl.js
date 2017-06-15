/*

hpgl v0.8.6-9

A Node.js library to communicate with HPGL-compatible devices such as plotters and printers.
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

const EventEmitter = require('events').EventEmitter;
const fs = require("fs-extra");
const util = require('util');

module.exports = {};

/**
 * Array of valid paper orientations.
 * @private
 */
const ORIENTATIONS = ["portrait", "landscape"];

const PAPER_SIZES = {
  A: {short: 21.59, long: 27.94},
  B: {short: 27.94, long: 43.18},
  C: {short: 43.18, long: 55.88},
  D: {short: 55.88, long: 86.36},
  E: {short: 86.36, long: 111.76},

  A4: {short: 21, long: 29.7},
  A3: {short: 29.7, long: 42},
  A2: {short: 42, long: 59.4},
  A1: {short: 59.4, long: 84.1},
  A0: {short: 84.1, long: 118.9}
};

/**
 * Supported character sets definitions. Currently, only French (FR1) is supported.
 * @private
 */
const CHARACTER_SETS = {

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
 * A rectangle object with position (x, y) and dimensions (width, height).
 *
 * @typedef {object} Rectangle
 * @property x {Number} - Position of the rectangle's top-left corner along the **x** axis.
 * @property y {Number} - Position of the rectangle's topl-left corner along the **y** axis.
 * @property width {Number} - Width of the rectangle.
 * @property height {Number} - Height of the rectangle.
 */
let Rectangle = function (x = 0, y = 0, width = 0, height = 0) {
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
 * @class
 */
let Models = {

  /**
   * Characteristics of the plotter
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

  /** @type {PlotterCharacteristics} */
  "GENERIC": {
    brand: "Unknown",
    model: "GENERIC",
    buffer: 60,
    papers: {
      list: ["A", "B", "A4", "A3"],
      A4: {long: 10870, short: 7600},
      A3: {long: 15970, short: 10870},
      A: {long: 10170, short: 7840},
      B: {long: 16450, short: 10170}
    },
    resolution: {
      x: 40,
      y: 40
    },
    instructions: [
      "AA", "AP", "AR", "AS", "BF", "BL", "CA", "CI", "CM", "CP", "CS", "CT", "CV", "DC", "DF",
      "DI", "DL", "DP", "DR", "DS", "DT", "EA", "EP", "ER", "ES", "EW", "FP", "FS", "FT", "GC",
      "GM", "IM", "IN", "IP", "IV", "IW", "KY", "LB", "LO", "LT", "NR", "OA", "OC", "OD", "OE",
      "OF", "OG", "OH", "OI", "OK", "OL", "OO", "OP", "OS", "OT", "OW", "PA", "PB", "PD", "PG",
      "PM", "PR", "PT", "PU", "RA", "RO", "RP", "RR", "SA", "SC", "SI", "SL", "SM", "SP", "SR",
      "SS", "TL", "UC", "UF", "VS", "WD", "WG", "XT", "YT"
    ]
  },

  /**
   * Characteristics for the **HP 7440A** plotter. This model is also know as the *Color Pro
   * Graphics* Plotter. It is an A/A4 size plotter with an 8-pen carousel.
   *
   * **Important**: this model can be fitted with an optional *Graphics Enhancement Cartridge* which
   * bumps its buffer memory to 1024 (instead of 60) bytes. The cartridge also adds support for
   * various plotting instructions which are not supported by default. For example, without the
   * cartridge, this model cannot draw rectangles, circles or arcs, it cannot set the pen thickness,
   * etc.
   *
   * @type {PlotterCharacteristics}
   */
  "7440A": {
    brand: "HP",
    model: "7440A",
    buffer: 60,
    papers: {
      list: ["A", "A4"],
      A4: {
        long: 10880,
        short: 7640
      },
      A: {
        long: 10280,
        short: 7640,
        margins: {
          portrait: {top: 240, right: 360, bottom: 640, left: 640},
          landscape: {top: 640, right: 240, bottom: 360, left: 640}
        }
      },
    },
    resolution: {
      x: 40,
      y: 40
    },
    instructions: [
      "CA", "CP", "CS", "DC", "DF", "DI", "DP", "DR", "IM", "IN", "IP", "IW", "LB", "LT", "OA",
      "OC", "OD", "OE", "OF", "OH", "OI", "OO", "OP", "OS", "OW", "PA", "PD", "PR", "PU", "RO",
      "SA", "SC", "SI", "SL", "SM", "SP", "SR", "SS", "TL", "UC", "VS", "XT", "YT"
    ]
  },

  /**
   * Characteristics for the **HP 7470A** plotter.
   *
   * @type {PlotterCharacteristics}
   */
  "7470A": {
    brand: "HP",
    model: "7470A",
    buffer: 255,
    papers: {
      list: ["A", "A4"],
      A4: {long: 10900, short: 7650},
      A: {long: 10300, short: 7650} // labeled as "US" on this model
    },
    resolution: {
      x: 40,
      y: 40
    },
    instructions: [
      "AA", "AR", "CA", "CI", "CP", "CS", "DC", "DF", "DI", "DP", "DR", "DT", "IM", "IN", "IP",
      "IW", "LB", "LT", "OA", "OC", "OD", "OE", "OF", "OI", "OO", "OP", "OS", "OW", "PA", "PD",
      "PR", "PU", "SA", "SC", "SI", "SL", "SM", "SP", "SR", "SS", "TL", "UC", "VS", "XT", "YT"
    ]
  },

  /**
   * Characteristics for the **HP 7475A** plotter. It is a A/A4 and B/A3 size plotter with a 6-pen
   * carousel.
   *
   * @type {PlotterCharacteristics}
   */
  "7475A": {
    brand: "HP",
    model: "7475A",
    buffer: 1024,
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
      x: 40,
      y: 40
    },
    instructions: [
      "AA", "AR", "CA", "CI", "CP", "CS", "DC", "DF", "DI", "DP", "DR", "DT", "EA", "ER", "EW",
      "FT", "IM", "IN", "IP", "IW", "LB", "LT", "OA", "OC", "OD", "OE", "OF", "OH", "OI", "OO",
      "OP", "OS", "OW", "PA", "PD", "PR", "PS", "PT", "PU", "RA", "RO", "RR", "SA", "SC", "SI",
      "SL", "SM", "SP", "SR", "SS", "TL", "UC", "VS", "WG", "XT", "YT"
    ]
  },

  /**
   * Characteristics for the **HP 7550A** plotter.
   *
   * @type {PlotterCharacteristics}
   */
  "7550A": {
    brand: "HP",
    model: "7550A",
    buffer: 12800,
    papers: {
      list: ["A", "B", "A4", "A3"],
      A4: {long: 10870, short: 7600},
      A3: {long: 15970, short: 10870},
      A: {long: 10170, short: 7840},
      B: {long: 16450, short: 10170}
    },
    resolution: {
      x: 40,
      y: 40
    },
    instructions: [
      "AA", "AP", "AR", "AS", "BF", "BL", "CA", "CI", "CM", "CP", "CS", "CT", "CV", "DC", "DF",
      "DI", "DL", "DP", "DR", "DS", "DT", "EA", "EP", "ER", "ES", "EW", "FP", "FS", "FT", "GC",
      "GM", "IM", "IN", "IP", "IV", "IW", "KY", "LB", "LO", "LT", "NR", "OA", "OC", "OD", "OE",
      "OF", "OG", "OH", "OI", "OK", "OL", "OO", "OP", "OS", "OT", "OW", "PA", "PB", "PD", "PG",
      "PM", "PR", "PT", "PU", "RA", "RO", "RP", "RR", "SA", "SC", "SI", "SL", "SM", "SP", "SR",
      "SS", "TL", "UC", "UF", "VS", "WD", "WG", "XT", "YT"
    ]
  },

  // "7550B": {},
  // "7550Plus": {},

  // LARGE:


  /**
   * Characteristics for the **HP 7580A** plotter.
   *
   * @type {PlotterCharacteristics}
   *
   * A and A4 sizes are loaded with the longer axis horizontal.
   * All other sizes have long axis vertical.
   * LES MARGES SONT À LA PAGE 43 DU MANUEL. ÇA PERMETTRA DE CALCULER LES GROSSEURS
   * LA PAGE 53 DIT COMMENT CHARGER LE PAPIER (DANS QUEL SENS)
   */
  "7580A": {
    brand: "HP",
    model: "7580A",
    buffer: 1024,
    // papers: {
    //   list: ["A", "B", "C", "D", "A4", "A3", "A2", "A1"],
    //   A: {long: 10170, short: 7840},
    //   B: {long: 16450, short: 10170},
    //   C: {long: ?, short: ?},
    //   D: {long: ?, short: ?},
    //   A4: {long: 10870, short: 7600},
    //   A3: {long: 15970, short: 10870},
    //   A2: {long: ?, short: ?},
    //   A1: {long: ?, short: ?}
    // },
    resolution: {
      x: 40,
      y: 40
    },
    instructions: [
      "AA", "AP", "AR", "AS", "BL", "CA", "CC", "CI", "CM", "CP", "CS", "CT", "DC", "DF", "DI",
      "DL", "DP", "DR", "DS", "DT", "EA", "EP", "ER", "ES", "EW", "FP", "FS", "FT", "GP", "IM",
      "IN", "IP", "IV", "IW", "LB", "LO", "LT", "NR", "OA", "OC", "OD", "OE", "OF", "OH", "OI",
      "OL", "OO", "OP", "OS", "OT", "OW", "PA", "PB", "PD", "PM", "PR", "PT", "PU", "RA", "RO",
      "RR", "SA", "SC", "SG", "SI", "SL", "SM", "SP", "SR", "SS", "TL", "UC", "UF", "VS", "WG",
      "XT", "YT"
    ]
  },

  /**
   * Characteristics for the **HP 7585A** plotter.
   *
   * @type {PlotterCharacteristics}
   *
   * A, C, A4, and A2 sizes are loaded with the longer axis horizontal.
   * All other sizes have long axis vertical.
   */
  "7585A": {
    brand: "HP",
    model: "7585A",
    buffer: 1024,
    // papers: {
    //   list: ["A", "B", "C", "D", "E", "A4", "A3", "A2", "A1", "A0"],
    //   A: {long: 10170, short: 7840},
    //   B: {long: 16450, short: 10170},
    //   C: {long: ?, short: ?},
    //   D: {long: ?, short: ?},
    //   E: {long: ?, short: ?},
    //   A4: {long: 10870, short: 7600},
    //   A3: {long: 15970, short: 10870},
    //   A2: {long: ?, short: ?},
    //   A1: {long: ?, short: ?}
    //   A0: {long: ?, short: ?}
    // },
    resolution: {
      x: 40,
      y: 40
    },
    instructions: [
      "AA", "AP", "AR", "AS", "BL", "CA", "CC", "CI", "CM", "CP", "CS", "CT", "DC", "DF", "DI",
      "DL", "DP", "DR", "DS", "DT", "EA", "EP", "ER", "ES", "EW", "FP", "FS", "FT", "GP", "IM",
      "IN", "IP", "IV", "IW", "LB", "LO", "LT", "NR", "OA", "OC", "OD", "OE", "OF", "OH", "OI",
      "OL", "OO", "OP", "OS", "OT", "OW", "PA", "PB", "PD", "PM", "PR", "PT", "PU", "RA", "RO",
      "RR", "SA", "SC", "SG", "SI", "SL", "SM", "SP", "SR", "SS", "TL", "UC", "UF", "VS", "WG",
      "XT", "YT"
    ]
  },

  // "7585B": {},

  /**
   * Characteristics for the **HP 7586B** plotter.
   *
   * @type {PlotterCharacteristics}
   */
  "7586B": {
    brand: "HP",
    model: "7586B",
    buffer: 1024,
    // papers: {
    //   list: ["A", "B", "C", "D", "E", "A4", "A3", "A2", "A1", "A0"],
    //   A: {long: 10170, short: 7840},
    //   B: {long: 16450, short: 10170},
    //   C: {long: ?, short: ?},
    //   D: {long: ?, short: ?},
    //   E: {long: ?, short: ?},
    //   A4: {long: 10870, short: 7600},
    //   A3: {long: 15970, short: 10870},
    //   A2: {long: ?, short: ?},
    //   A1: {long: ?, short: ?}
    //   A0: {long: ?, short: ?}
    // },
    resolution: {
      x: 40,
      y: 40
    },
    instructions: [
      "AA", "AF", "AH", "AP", "AR", "AS", "BL", "CA", "CC", "CI", "CM", "CP", "CS", "CT", "DC",
      "DF", "DI", "DL", "DP", "DR", "DS", "DT", "EA", "EC", "EP", "ER", "ES", "EW", "FP", "FR",
      "FS", "FT", "GP", "IM", "IN", "IP", "IV", "IW", "LB", "LO", "LT", "NR", "OA", "OC", "OD",
      "OE", "OF", "OH", "OI", "OL", "OO", "OP", "OS", "OT", "OW", "PA", "PB", "PD", "PG", "PM",
      "PR", "PT", "PU", "RA", "RO", "RR", "SA", "SC", "SG", "SI", "SL", "SM", "SP", "SR", "SS",
      "TL", "UC", "UF", "VS", "WG", "XT", "YT"
    ]
  }




};

/*

 b. "Automatic" is available only for the following models, and
 allows continuous plotting on rollfeed or automatically-fed media:

 7550, 7586B, DraftMasterII (7596A)

 */

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

/**
 * The `Plotter` class provides methods to interact with an HPGL-compatible plotter such as those
 * made by HP. Various other makers also use or support the HPGL protocol (Calcomp, for example).
 *
 * #### Event Handling
 *
 * This object extends Node's core [EventEmitter](https://nodejs.org/api/events.html) object. This
 * means you can use methods such as:
 * [on()](https://nodejs.org/api/events.html#events_emitter_on_eventname_listener),
 * [once()](https://nodejs.org/api/events.html#events_emitter_once_eventname_listener),
 * [removeListener()](https://nodejs.org/api/events.html#events_emitter_removelistener_eventname_listener),
 * etc.
 *
 * #### Usage examples
 *
 * Here is how you can use the `Plotter` object in a Node.js-compatible project:
 *
 * ```
 * const SerialPort = require("serialport");
 * let transport = new SerialPort("/dev/tty.usbserial", { autoOpen: false });
 *
 * const Plotter = require("hpgl").Plotter;
 * let plotter = new Plotter();
 *
 * plotter.connect(transport, {orientation: "portrait"}, function(error) {
 *
 *   if (error) {
 *     console.log(error);
 *     return;
 *   }
 *
 *   this
 *     .moveTo(2, 2)
 *     .drawText("Hello, World!")
 *     .moveTo(5, 5)
 *     .drawRectangle(4, 3)
 *
 * });
 * ```
 *
 * If you are using NW.js, you need to change the first three lines of code to this:
 *
 * ```
 * var SerialPort = nw.require("browser-serialport").SerialPort;
 * var transport = new SerialPort("/dev/tty.usbserial", {}, false);
 *
 * const Plotter = nw.require("hpgl").Plotter;
 * ```
 *
 * @todo Use OO to identify plotters with potential extended capabilities (such as 7440A)
 * @todo Create a getter that returns the size of the plottable area.
 * @todo Instructions queued with waitForResponse should timeout if the response does not come`
 * @todo The queue() function should validate if the instruction(s) is actually valid.
 * @todo Implement penThickness.
 * @todo ?? The buffer must be flushed during connect because some devices (7440A) will keep commands in the buffer
 *
 * @class
 * @fires Plotter#connected
 * @fires Plotter#data
 * @fires Plotter#error
 * @fires Plotter#ready
 * @fires Plotter#fileplotted
 */
let Plotter = function() {

  /**
   * The number of milliseconds to wait for responses to RS-232-C instructions. This value is a
   * lowest common denominator. As an example, the HP7440A's response time is around 260ms.
   *
   * @member {Number}
   * @name Plotter#DEVICE_RS232_DELAY
   * @constant
   * @default 375
   * @private
   */
  Object.defineProperty(this, "DEVICE_RS232_DELAY", {
    enumerable: true,
    writable: false,
    value: 375
  });

  /**
   * The delay to wait for between calls to process the queue.
   *
   * @member {Number}
   * @name Plotter#QUEUE_DELAY
   * @constant
   * @default 100
   * @private
   */
  Object.defineProperty(this, "QUEUE_DELAY", {
    enumerable: true,
    writable: false,
    value: 100
  });

  /**
   * The amount of time to wait for an answer from the device.
   *
   * @member {Number}
   * @name Plotter#QUEUE_DELAY
   * @constant
   * @default 1000
   * @private
   */
  Object.defineProperty(this, "MAX_RESPONSE_TIME", {
    enumerable: true,
    writable: false,
    value: 1000
  });

  /**
   * Prefix for the RS-232 instructions. It is typically made up of the `escape` character followed
   * by a period.
   *
   * @member {String}
   * @name Plotter#RS232_PREFIX
   * @constant
   * @private
   */
  Object.defineProperty(this, "RS232_PREFIX", {
    enumerable: true,
    writable: false,
    value: String.fromCharCode(27) + "."
  });

  /**
   * Queue of command objects that will be sent (one by one) to the plotter when the device's buffer
   * has enough space.
   *
   * @private
   * @member {Array}
   */
  this._queue = [];

  /**
   * ID of the timeout used to periodically process the queue.
   *
   * @private
   * @member {Number}
   */
  this._queueTimeOutId = 0;

  /**
   * Serial input buffer
   *
   * @private
   * @member {String}
   */
  this._buffer  = "";

  /**
   * Path to a file were hpgl commands should be savec.
   *
   * @private
   * @member {String}
   */
  this._outputFile = undefined;

  /**
   * Plotter pen's nib size
   *
   * @private
   * @member {Number}
   */
  this._penThickness = 0.3;

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
   * The paper orientation currently selected (portrait or landscape). Paper orientation is assigned
   * during the connection to the device (with the [connect()]{@link Plotter#connect} function) or
   * when saving to file (with the [connect()]{@link Plotter#startCapturingToFile} function).
   *
   * @type {String}
   * @default "landscape"
   * @readonly
   */
  this.orientation = "landscape";

  /**
   * Indicates whether a successful serial connection has been established or not. This does not
   * necessarily mean the device is ready to receive commands.
   *
   * To know when the device is ready to receive commands, you can check out the `ready` property or
   * listen to the [ready]{@link Plotter#event:ready} event
   *
   * @member {Number} Plotter#connected
   * @readOnly
   */
  Object.defineProperty(this, 'connected', {

    get: () => {
      return (this.transport && this.transport.isOpen()) === true;
    }

  });

  /**
   * The format of paper currently selected (A4, letter, B, etc.). Paper format is assigned during
   * the connection to the device (with the [connect()]{@link Plotter#connect} function). Currently,
   * it cannot be changed on the fly.
   *
   * @type {String}
   * @default "A"
   * @readonly
   */
  this.paper = "A";

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
   * @member {Object}
   * @readOnly
   */
  this.transport = undefined;

  /**
   * Indicates whether the device is ready to receive commands or not. The device is ready only
   * after having been successfully connected by using the [Plotter.connect()]{@link Plotter#connect}
   * function. Instructions should not be sent to the device prior to it being ready.
   *
   * The [Plotter]{@link Plotter} object triggers the [ready]{@link Plotter#event:ready} event when
   * its ready.
   *
   * @member {Boolean}
   * @readOnly
   */
  this.ready = false;

  /**
   * This is a an empty object inside which user's of this library are invited to add whatever
   * property they might find useful.
   *
   * @member {Object}
   */
  this.userData = {};

};

util.inherits(Plotter, EventEmitter);

/**
 * Opens a serial connection to the device using the specified serial transport layer. The following
 * serial modules are supported: [serialport](https://www.npmjs.com/package/serialport) and
 * [browser-serialport](https://www.npmjs.com/package/browser-serialport).
 *
 * Important: calling `connect()` will terminate any ongoing file capture. If you want to both
 * plot and save to file at the same time, call
 * [startCapturingToFile()]{@link Plotter#startCapturingToFile} only after the plotter is ready.
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
 * completed. This function will receive an `error` parameter if an error occured.
 *
 * @fires Plotter#connected
 * @fires Plotter#ready
 *
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.connect = function(transport, options = {}, callback = null) {

  this.transport = transport;

  // Terminate any ongoing file capture session (if the connection works or not)
  this.stopCapturingToFile();

  // Try to open transport layer
  this.transport.open((error) => {

    // Prepare listeners for later
    let onDataListener = this._onData.bind(this);
    let onErrorListener = this._onError.bind(this);

    // Tear down function when connection fails
    function fail(err) {
      if (this.transport.isOpen()) this.transport.close();
      this.transport.removeListener('data', onDataListener);
      this.transport.removeListener('error', onErrorListener);
      if (typeof callback === "function") callback(err);
      // this._onError(err);
    }

    // If the serial connection attempt was unsuccessful, we are done!
    if (error) {
      fail.call(this, new Error("Failed to open serial port (" + this.transport.path + ")."));
      return;
    }

    // Install listeners
    this.transport.on('data', onDataListener);
    this.transport.on('error', onErrorListener);

    // Check if RS-232-C communication with plotter works properly. This is to prevent the case
    // where we are connected to a serial port which is not a compatible device. To do that we set a
    // maximum time to receive a response.
    let timeout = setTimeout(() => {
      fail.call(
        this,
        new Error(`RS-232-C communication attempt with plotter timed out (${this.transport.path}).`)
      );
    }, this.DEVICE_RS232_DELAY);

    this.getRs232Error((err) => {

      clearTimeout(timeout);

      // If an error occured, we're done!
      if (err.code !== 0) {
        fail.call(
          this,
          new Error(
            `Plotter initialization attempt failed (${this.transport.path}). Device returned ` +
            `the following error: ${err.message}.`
          )
        );
        return;
      }

      // console.log("rs2323 err code", err.code);

      this.initialize(options, callback);

    });

  });

  return this;

};

/**
 * Reset the device to its 'power on' status using the `IN` instruction (same as `DF` plus: pen is
 * raised, errors are cleared, rotation set to 0, scaling points reset). This function can also
 * configure the plotting environments according to the `options` parameter. This operation is
 * asynchronous.
 *
 * Note: a call to this function is automatically performed when calling `connect()`.
 *
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
 * @param {Function} [callback=undefined]  A function to call once the device has been initialized.
 * In case of error, the function will receive an `Error` object
 */
Plotter.prototype.initialize = function(options, callback) {

  // Abort any lingering device instructions
  this.send(this.RS232_PREFIX + "J");

  // Abort any lingering HP-GL instructions
  this.send(this.RS232_PREFIX + "K");

  this._configurePlottingEnvironment(options, callback);

};

/**
 * Retrieves any RS-232-C errors that might have occured and passes it to the specified callback
 * function.
 *
 * @param {Function} callback A function to call once the error has been obtained from the
 * device. This function receives an object with various properties which are detailed below.
 * @param {Boolean} callback.code The error code.
 * @param {Boolean} callback.message The error message.
 *
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.getRs232Error = function(callback) {

  this.send(this.RS232_PREFIX + "E", (data) => {

    // If there is no callback, we are done!
    if (typeof callback !== "function") return;

    // Parse returned code
    let code = parseInt(data);
    let error = {};

    // We should only be checking for 0 but, despite what the documentation says, we sometines
    // receive an empty string (\r terminated) when there are no errors...
    if (data.length === 0) code = 0;

    if (code === 0 ) {
      error.message = "No error."
    } else if (code === 10) {
      error.message = "New output generated before previous output finished being transmitted."
    } else if (code === 11) {
      error.message = "Invalid character received after first two characters (ESC.)."
    } else if (code === 12) {
      error.message = "Invalid character received while parsing instruction."
    } else if (code === 13) {
      error.message = "Parameter out-of-range."
    } else if (code === 14) {
      error.message = "Too many parameters received."
    } else if (code === 15) {
      error.message = "Framing, parity or overrun error."
    } else if (code === 16) {
      error.message = "Input buffer has overflowed."
    } else {
      code = 99;
      error.message = "Unknown error"
    }
    error.code = code;

    callback(error);

  }, true);

  return this;

};

/**
 * This does:
 *
 *  1- Fetch the model from the device so we can assign the characteristics
 *
 *  2- Assign requested paper and orientation which may trigger the queuing of PS and RO
 *     instructions depending on model.
 *
 *  3- Reassign P1 and P2 and reset window to match the new setup.
 *
 *  4- Retrieve the device's actual buffer size. On some devices, optional modules can be added to
 *     increase buffer and add additional functionalities (such as extra instructions).
 *
 * @param [options={}] {Object}
 * @param [callback=null] {Function}
 * @private
 */
Plotter.prototype._configurePlottingEnvironment = function(options = {}, callback = null) {

  // Retrieve device model. This must be done before other instructions because they depend on the
  // `characteristics` property being set.
  this.getModel((data) => {

    // Assign model (or GENERIC if model cannot be found)
    if (Models[data]) {
      this.characteristics = Models[data];
    } else {
      this.characteristics = Models["GENERIC"];
    }

    // As soon as we know the model, we can use the 'papers' and 'orientation' properties.
    if (
      options.paper &&
      options.paper.toUpperCase &&
      this.characteristics.papers.list.includes(options.paper.toUpperCase())
    ) {
      this.paper = options.paper.toUpperCase();
    }

    // Save different orientation if specified
    if (
      options.orientation &&
      options.orientation.toLowerCase &&
      ORIENTATIONS.includes(options.orientation.toLowerCase())
    ) {
      this.orientation = options.orientation.toLowerCase();
    }

    // Retrieve buffer size. As per the "Output Buffer Size Instruction" documentation (when in
    // block mode), we must first send an ESC.E (hence the call to getRs232Error) and read the
    // response before sending an ESC.L to retrieve buffer size.
    this.getRs232Error((err) => {

      if (err.code !== 0) {
        if (typeof callback === "function") callback(new Error(err.message));
        return;
      }

      this.queue(this.RS232_PREFIX + "L", (data) => {

        this.characteristics.buffer = data;
        this._onReady(callback);

        // FIRST HP-GL INSTRUCTIONS START HERE!! IT IS IMPORTANT THAT THOSE INSTRUCTIONS HAPPEN
        // AFTER ESC.L BECAUSE THE HP7440A DOES NOT RETURN THE BUFFER SIZE UNLESS THE BUFFER IS
        // EMPTY!!

        // Cannot be queued (because that would trigger a buffer size verification)
        this.send("IN");

        // The device's default orientation changes according to paper size. For example, on the
        // HP7475A, paper sizes A (letter) and A4 use a 'landscape' orientation by default whereas
        // paper sizes B (tabloid) and A3 use a 'portrait' orientation by default...
        //
        // So, if we want some sort of standard we must rotate the orientation to whatever is
        // requested (no matter the paper size). Other devices (7470A, for example) only have one
        // orientation.
        //
        // Inform device of the paper size we wish to use. This is not necessary on devices that use
        // the same orientation for all paper sizes.
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

      }, {waitForResponse: true});

    });

  })

};

/**
 * Returns the dimensions of the currently selected paper size. The values returned (`width` and
 * `height`) take into account the current paper orientation.
 *
 * @param {Boolean} metric A boolean value indicating whether the dimensions should be output in cm
 * (true) or inches (false).
 * @returns {Object} An object with `width` and `height` properties.
 */
Plotter.prototype.getPaperSize = function(metric = true) {

  if (!this.connected && !this._outputFile) {
    throw new Error(
      "The plotter must be connected, or an output file specified, before retrieving paper " +
      "dimensions."
    );
  }

  let ratio = metric ? 1 : 1/2.54;
  let dimensions = {};

  if (this.orientation === "landscape") {
    dimensions.width = PAPER_SIZES[this.paper].long * ratio;
    dimensions.height = PAPER_SIZES[this.paper].short * ratio;
  } else {
    dimensions.width = PAPER_SIZES[this.paper].short * ratio;
    dimensions.height = PAPER_SIZES[this.paper].long * ratio;
  }

  return dimensions;

};

/**
 * Retrieves the model from the device using RS-232-C or HP-GL (depending on the model).
 *
 * @param callback A function to trigger once the model has been fetched. This function receives a
 * string containing the model name.
 */
Plotter.prototype.getModel = function(callback) {

  let cancel = false;

  // Advanced devices (HP7475A) will be able to respond to OI instructions even if the plotter is
  // not in "ready" state. Other devices (HP7440A), will cue such instructions for execution only
  // after the device has entered "ready" state. However, on those devices, we can use ESC.A to
  // retrieve the model. So, what we do is first try ESC.A and, if no response is received within a
  // certain timeframe, we try OI. We cannot do it the other way around because the instruction
  // would be queued for execution at a later time which is probably not a good idea.
  let timeoutId = setTimeout(() => {

    // If the timeout is triggered, the function set previously must not be carried out.
    cancel = true;

    // Since the ESC.A instruction does not exist on all devices, it triggers an error which we must
    // get rid of before proceeding. It is important to wait for the response even if we do not use
    // it because otherwise, it will pollute the next data handler.
    this.send(this.RS232_PREFIX + "E", () => {

      // We don't care about the actual error. We just need to flush it from the device.
      this.queue("OI", (data) => {
        if (typeof callback === "function") callback(data);
      }, {waitForResponse: true});

    }, true);

  }, this.DEVICE_RS232_DELAY);

  this.queue(this.RS232_PREFIX + "A", (data) => {
    clearTimeout(timeoutId);
    let [model] = data.split(",");
    if (typeof callback === "function" && !cancel) callback(model);
  }, {waitForResponse: true});

};

/**
 * @param [callback=null] {Function}
 * @private
 */
Plotter.prototype._onReady = function(callback = null) {

  this.ready = true;

  if (typeof callback === "function") { callback.call(this); }

  /**
   * Event emitted when the device is ready to receive plotting instructions.
   * @event Plotter#ready
   */
  this.emit("ready");

};

/**
 * Immediately abort any ongoing and upcoming plotting instructions.
 *
 * @param [callback] {Function} - A function to execute once the abort command has been sent to the
 * device.
 * @returns {Plotter}
 */
Plotter.prototype.abort = function(callback = null) {

  // Clear any timeout set to trigger the processing of the queue and empty it
  this._stopAndEmptyQueue();

  // Send "Abort Graphic" instruction
  this.send(this.RS232_PREFIX + "K", () => {

    /**
     * Event emitted when a plotting job is aborted.
     *
     * @event Plotter#aborted
     */
    this.emit("aborted");

    if (typeof callback === "function") callback();

  });

  return this;

};

/**
 * Stops the queue and empties it.
 * @private
 */
Plotter.prototype._stopAndEmptyQueue = function() {
  clearTimeout(this._queueTimeOutId);
  this._queue = [];
};

/**
 * Loads an HPGL file and sends all instructions found inside it to the plotter. The pen thickness,
 * paper size and orientation defined in the file have precedence over the same properties defined
 * during connection with the [connect()]{@link Plotter#connect} function (if any).
 *
 * The format for the instructions must be the HP-recommended syntax. That is:
 *
 *  * Two-letter uppercase mnemonic
 *  * Optionnally followed by comma-separated parameters
 *  * Followed by a semicolon (or the `CTX` character, in the case of the `LB` instruction)
 *
 * Newline (`\n`) characters may be used after the semicolons for readability. No other format is
 * supported. Also note that all HPGL **output** instructions (those starting with "O") will be
 * discarded. The file **cannot** include RS-232-C escape sequences.
 *
 * #### Example
 *
 * Note that the `plotFile()` function must be called after the device is ready:
 *
 * ```
 * plotter
 *   .on("ready", function() {
 *     this.plotFile("test.hpgl");
 *   })
 *   .on("fileplotted", function() {
 *     console.log("Done plotting!");
 *   })
 *   .connect(transport);
 *
 * ```
 *
 * @param file {String} - The path to the file that will be sent to the plotter.
 * @param [callback] {Plotter~statusCallback} - A function to execute when all the instructions have
 * been sent to the plotter's buffer. Depending on the size of the file and of the device's buffer,
 * this may take a while.
 *
 * @fires Plotter#fileplotted
 */
Plotter.prototype.plotFile = function(file, callback = null) {

  fs.readFile(file, 'utf8', (err, data) => {

    if (err)  {
      throw new Error("Could not read requested file: " + file);
    }

    if ( data.match(new RegExp(this.RS232_PREFIX)) ) {
      throw new Error("The file to plot cannot contain RS-232-C escape sequences.")
    }

    if (!this.ready) {
      throw new Error("The plotFile() function can only be called after the device is ready.");
    }



    this.getStatus((status) => {

      if (!status.ready) {

        if (typeof callback === "function") {

          let err = new Error("Device not ready!");
          callback(err);

          /**
           * Event emitted when the attempt to plot a file failed.
           * @event Plotter#fileaborted
           * @param err {Error} - The error that occured
           */
          this.emit("fileaborted", err);

        }

      } else {

        // Queue the whole file
        this.queue(data, null, {ignoreOutputInstructions: true});

        // Wait for the whole file to have been plotted
        this.wait(status => {

          if (typeof callback === "function") callback(undefined, status);

          /**
           * Event emitted when a file has been completely drawn by the device.
           * @event Plotter#fileplotted
           * @param status {Object} - Additional information
           * @param status.x {Object} - The ending `x` position of the pen (in cm).
           * @param status.y {Object} - The ending `y` position of the pen (in cm).
           * @param status.penDown {Boolean} - Whether the pen is down or not.
           */
          this.emit("fileplotted", status);

        });

      }

    });




  });

};

/**
 * Waits for the device to finish processing and/or drawing all previously queued instructions and
 * then executes the specified callback function.
 *
 * @param callback {Plotter~statusCallback} - The function to execute.
 */
Plotter.prototype.wait = function(callback) {

  // If the plotter is not connected we simply wait for the queue to be empty
  if (!this.connected) {

    if (this._queue.length < 1) {
      callback();
    } else {
      setTimeout(this.wait.bind(this, callback), 0)
    }

    return;

  }

  // Send a request for actual pen position and status. This means the device will have to finish
  // all queued instructions before being able to reply.
  this.queue("OA", (data) => {

    let [x, y, penDown] = data.split(",");

    let status = {
      x: this._fromPlotterUnits(x),
      y: this._fromPlotterUnits(y),
      penDown: penDown === "1"
    };

    if (typeof callback === "function") { callback(status); }

  }, {waitForResponse: true});

};

/**
 * Defines the expected signature of functions used in a `statusCallback` context. Such functions
 * basically receive a `status` object detailing the current status of the hardware device.
 *
 * @callback Plotter~statusCallback
 * @param status {Object} Hardware status information
 * @param status.x {Number} Position of the pen of the `x` axis (in plotter units)
 * @param status.y {Number} Position of the pen of the `y` axis (in plotter units)
 * @param status.penDown {Boolean} Whether the pen is down or not
 */

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

  let res = 40;

  if (
    this.characteristics &&
    this.characteristics.resolution &&
    this.characteristics.resolution.x
  )
  {
    res = this.characteristics.resolution.x;
  }

  if (metric) {
    return Math.round(value * 10 * res);
  } else {
    return Math.round(value * 25.4 * res);
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

  if (!this._outputFile) {
    this.characteristics = undefined;
    this.orientation = "landscape";
    this.paper = "A";
  }

  if ( !this.transport || this.transport.connectionId === -1 ) {
    if (typeof callback === "function") callback();
    return;
  }

  this.ready = false;

  this.abort();

  this.send("IN", () => {
    this.transport.close((error) => {
      this.transport = undefined;
      if (typeof callback === "function") { callback(error); }
    });
  });

  /**
   * Event emitted when the serial connection has been successfully closed.
   *
   * @event Plotter#connected
   */
  this.emit("disconnected");

};

/**
 * Disconnects from the hardware device. This will cancel ongoing and upcoming plotting instructions
 * and close the serial connection. The device will be returned to its default state.
 *
 * @param {Function} callback A function to execute once the disconnection is complete. If an error
 * occurs, this function will receive an error object as its parameter.
 */
Plotter.prototype.destroy = function(callback = null) {

  // Terminate any ongoing file capture session
  this.stopCapturingToFile();

  // Stop and empty queue
  this._stopAndEmptyQueue();

  this.disconnect(() => {
    // Plotter = null;
    if (typeof callback === "function") callback();
  });

};

/**
 * Converts a position whose reference origin is in the top-left corner of the paper sheet (+x going
 * right, +y going down) to the HPGL coordinates system which has its origin in the bottom-left
 * corner (+x going right, + y going up).
 *
 * Beware that the resulting position might be outside the plottable area.
 *
 * @todo Add the option to use the native HPGL coordinates system (bypass this)
 *
 * @private
 * @param {number} x The `x` coordinate of the point in plotter units.
 * @param {number} y The `y` coordinate of the point in plotter units.
 * @return {Object} An object whose **x** and **y** properties have been transformed.
 */
Plotter.prototype._toAbsoluteHpglCoordinates = function(x, y) {

  let p = this.characteristics.papers[this.paper];

  // Compensate for margins
  x -= p.margins[this.orientation].left;
  y -= p.margins[this.orientation].top;

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
 * This method is called when new data comes in from the serial port. Each time a \r is received, a
 * "data" event is dispatched. This event contains all the data that was buffered since the previous
 * dispatch.
 *
 * @private
 * @param {Object} data
 */
Plotter.prototype._onData = function(data) {

  data.toString().split("").forEach((char) => {

    if (char === "\r") {

      /**
       * Event emitted when data is received from the device.
       * @event Plotter#data
       * @param {string} data The data received.
       */
      this.emit("data", this._buffer);
      this._buffer = "";

    } else {
      this._buffer += char;
    }

  })

};

/**
 * @private
 * @param {Object} error An object containing information about the error.
 */
Plotter.prototype._onError = function(error) {

  // console.log(error);

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
 * Immediately sends a single raw HPGL or RS-232-C instruction down the serial port. The validity of
 * the instruction's syntax is not checked at all. If you need validation, use the
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

  // Check if the plotter is connected or an output file has been specified
  if (!this.connected && !this._outputFile) {
    throw new Error(
      "The Plotter must be connected or an output file specified before sending instructions."
    );
  }

  // Add termination character. A semicolon is used for HP-GL instructions unless we are printing a
  // label (which requires a special termination char: ETX). RS-232-C isntructions only need a
  // termination character when parameters are used. In this case the terminator is the colon.
  if (instruction.substring(0, 2) === "LB") {
    instruction += String.fromCharCode(3); // ETX character is label delimiter
  } else if (instruction.substring(0, 2) === this.RS232_PREFIX) {
    if (instruction.length > 3) instruction += ":";
  } else {
    instruction += ";";
  }

  // All HPGL instructions are appended to the output file (if specified)
  if (instruction.match(/^[A-Z]{2}/)) {
    this._appendToOutputFile(instruction);
  }

  // We actually send data to the device only if there is a connection. Otherwise, we assume we are
  // sending the data to the output file and simply trigger the callback.
  if (this.connected) {

    // Check maximum instruction length (we must first check if the buffer size is available because
    // it will not be for the very first instructions.
    if (
      this.characteristics &&
      this.characteristics.buffer &&
      instruction.length > this.characteristics.buffer
    ) {
      this._stopAndEmptyQueue();
      throw new RangeError(
        `Maximum HP-GL instruction length cannot be larger than device buffer. Instruction is ` +
        `${instruction.length} characters long but buffer is only ${this.characteristics.buffer}.`
      );
    }

    // Send the instruction. Wait for printer response if required
    if (waitForResponse) {

      console.log("Send and wait " + instruction);

      this.once("data", (data) => {
        // console.log("Received: " + data);
        if (typeof callback === "function") callback(data);
      });
      this.transport.write(instruction);

    } else {

      console.log("Send " + instruction);

      this.transport.write(instruction, (results) => {
        if (typeof callback === "function") callback(results);
      });

    }

  } else {

    if (typeof callback === "function") callback();

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
 * @param {Function} [callback] A function to execute when the instruction has been sent to the
 * device.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.drawText = function(text, options = {}, callback) {

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
  this.queue("LB" + this._toIso646(text, options.charset), callback);

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

    let found = CHARACTER_SETS[charset][char];

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
 * Selects the requested pen from the carousel or stall. If no pen is specified, selects the pen at
 * position 1. If the pen designated for selection is not in its stall, the plotter will attempt to
 * select a pen beginning in stall 1 and move up until a pen is found.
 *
 * Specifying a pen number of 0, stores the current pen. This is the equivalent of calling
 * [`storePen()`]{@link Plotter#storePen}.
 *
 * If the plotter does not have a carousel/stall or the specified pen number is out of range, this
 * instruction is ignored.
 *
 * @param {Number} [penNumber=1] The number of the pen to select.
 * @param {Function} [callback] A function to execute when the instruction has been sent to the
 * device.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.selectPen = function(penNumber = 1, callback) {
  this.queue("SP" + parseInt(penNumber), callback);
  return this;
};

/**
 * Stores the pen back in the carousel or stall. The plotter will try to put the pen away in the
 * appropriate stall. If the stall is occupied, the plotter will attempt to store the pen in pen
 * stall 1, then 2, then 3, etc. If all the stalls are full, the pen holder will return to its
 * previous location.
 *
 * If the plotter does not support pen storage, this instruction is ignored.
 *
 * @param {Function} [callback] A function to execute when the instruction has been sent to the
 * device.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.storePen = function(callback) {
  return this.selectPen(0, callback);
};

/**
 * Draws a circle whose center is at the current location of the pen.
 *
 * @param {number} [radius=1] The circle's radius (in centimeters).
 * @param {number} [angle=5]  An integer between -180° and 180° representing the chord angle. The
 * most commonly used values are 0-180. In this case, the smaller the angle is, the smoother the
 * circle will be. Negative values make the circle start at 180° instead of 0°.
 * @param {Object} [options={}] Additional options (none for now)
 * @param {Function} [callback] A function to execute when the instruction has been sent to the
 * device.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.drawCircle = function(radius = 1, angle = 5, options = {}, callback) {
  this.queue("CI" + this._toPlotterUnits(radius) + "," + Math.round(angle), callback);
  return this;
};

/**
 * Draws a line from the current pen position to the specified destination position (x, y).
 *
 * @param {number} x The `x` coordinate of the point where the the line should end (in cm).
 * @param {number} y The `y` coordinate of the point where the the line should end (in cm).
 * @param {Object} [options={}] Additional options
 * @param {number} [options.linePattern=7] Integer between `0` and `7`. Value `0` prints dots at
 * line extremities only. Values `1` to `6` prints various types of dotted lines. Value `7`
 * (default) is a solid line.
 * @param {number} [options.penUp=true] Whether the pen should be lifted off the paper at the end of
 * the line.
 * @param {number} [options.penDown=true] Whether the pen should be lowered on the paper before
 * starting to draw a line;
 * @param {Function} [callback] A function to execute when the instruction has been sent to the
 * device.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.drawLine = function(x, y, options = {}, callback) {

  this.drawLines([x, y], options, callback);
  return this;

};

// Plotter.prototype.drawLine = function(x, y, options = {}, callback) {
//
//   // Assign defaults
//   options.penDown = (options.penDown !== false);
//   options.penUp = (options.penUp !== false);
//
//   // // Check validity of line pattern
//   // options.linePattern = parseInt(options.linePattern);
//   //
//   // if (isNaN(options.linePattern) || options.linePattern < 0 || options.linePattern > 7) {
//   //   options.linePattern = 7;
//   // }
//   //
//   // // Assign desired line pattern
//   // if (options.linePattern === 7) {
//   //   this.queue("LT");
//   // } else {
//   //   this.queue("LT" + options.linePattern);
//   // }
//
//   // Convert poisition to plotter units
//   let p = this._toAbsoluteHpglCoordinates(this._toPlotterUnits(x), this._toPlotterUnits(y));
//
//   // Lower pen (if requested)
//   if (options.penDown) this.queue("PD");
//
//   // Send instruction and lift pen (if requested)
//   if (options.penUp) {
//     this.queue("PA" + p.x + "," + p.y);
//     this.queue("PU", callback);
//   } else {
//     this.queue("PA" + p.x + "," + p.y, callback);
//   }
//
//   return this;
//
// };

/**
 * Draws a series of lines starting at the current pen position and going, in turn, to all x/y pairs
 * specified in the array.
 *
 * @param {number[]} [positions=[]] An array of line-end positions in the form
 * `[x1, y1, x2, y2, ...]`.
 * @param {Object} [options={}] Additional options
 * @param {number} [options.linePattern=7] Integer between `0` and `7`. Value `0` only prints dots
 * at line extremities only. Values `1` to `6` prints various types of dotted lines. Value `7`
 * (default) is a solid line.
 * @param {number} [options.penUp=true] Whether the pen should be lifted off the paper after drawing
 * all the lines.
 * @param {number} [options.penDown=true] Whether the pen should be lowered on the paper before
 * drawing all the lines.
 * @param {Function} [callback] A function to execute when all the instruction(s) have been sent to
 * the device.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 *
 * @todo add linePatternLength option
 */
Plotter.prototype.drawLines = function(positions = [], options = {}, callback) {

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
  for (let i = 0; i < positions.length; i += 2) {

    let x = this._toPlotterUnits(positions[i]);
    let y = this._toPlotterUnits(positions[i+1]);
    let p = this._toAbsoluteHpglCoordinates(x, y);

    // Chunks must be smaller than the total buffer size. So, before adding a new position, we must
    // make sure that this new position does no bring the chunk above the buffer's size. If it
    // exceeds the buffer's size, we create a new chunk. Warning: if no device is connected, we rely
    // on the device's buffer size reported in the characteristics.
    if (!this.connected && !this.characteristics.buffer) {
      throw new Error(
        "The drawLines() function cannot properly chunk the instructions since the device's " +
        "buffer size has not been defined in the characteristics."
      );
    }

    // Simulate final instruction to verify length
    let instruction = "PA" + chunks[current].concat([p.x, p.y]).join(",") + ";";

    if (instruction.length > this.characteristics.buffer) {
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

    // We attach the callback to the very last instruction
    this.queue("PU", callback);

  }

  return this;

};
// Plotter.prototype.drawLines = function(positions = [], options = {}, callback) {
//
//   // Assign defaults
//   options.penDown = (options.penDown !== false);
//   options.penUp = (options.penUp !== false);
//
//   if (options.penDown) this.queue("PD");
//
//   // Draw all lines
//   for (let i = 0; i < positions.length; i += 2) {
//
//     // We attach the callback to the last instruction (if no penUp has been specified)
//     if (!options.penUp && i+1 >= positions.length) {
//       this.drawLine(positions[i], positions[i+1], {penUp: false, penDown: false}, callback);
//     } else {
//       this.drawLine(positions[i], positions[i+1], {penUp: false, penDown: false});
//     }
//
//   }
//
//   if (options.penUp) this.queue("PU", callback);
//
//
//   return this;
//
// };

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
 * @param {Object} [options={}] Additional options (none for now)
 * @param {Function} [callback] A function to execute when the instruction has been sent to the
 * device.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.drawRectangle = function(width, height, options = {}, callback) {

  if ( parseFloat(width) ) {
    if ( !parseFloat(height) ) { height = width; }
  } else {
    throw new Error ("The width must be specified.")
  }

  let target = this._toRelativeHpglCoordinates(
    this._toPlotterUnits(width),
    this._toPlotterUnits(height)
  );
  this.queue("ER" + target.x + "," + target.y, callback);

  return this;

};

/**
 * Lifts the pen and moves it to the specified `x` and `y` coordinates.
 *
 * @param x {number} - Position along the `x` axis
 * @param y {number} - Position along the `y` axis
 * @param metric {Boolean} - Whether the coordinates are in centimeters (default) or decimal inches.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.moveTo = function(x, y, metric = true) {

  let point = this._toAbsoluteHpglCoordinates(
    this._toPlotterUnits(x, metric),
    this._toPlotterUnits(y, metric)
  );
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

  velocity = parseFloat(velocity) * 38.1;

  if (isNaN(velocity) || velocity <= 0 || velocity > 38.1) {
    velocity = 38.1;
  }

  this.queue("VS" + this._toHpglDecimal(velocity));

  return this;

};

/**
 * @param content {String}
 * @param [newline=true] {Boolean} Whether to add a newline after the content
 * @private
 */
Plotter.prototype._appendToOutputFile = function(content, newline = true) {

  // If no output file has been defined, simply return.
  if (!this._outputFile) { return; }

  try {
    fs.ensureFileSync(this._outputFile);
    fs.appendFileSync(this._outputFile, content + (newline ? "\n" : ""));
  } catch (e) {
    throw new Error("Could not append to specified output file (" + this._outputFile + ").");
  }

};

/**
 * Starts appending all sent HPGL commands to the specified file. Unless a device has been
 * previously connected, it is necessary to specify the device model, the paper size and the
 * orientation in the options object.
 *
 * If you want to both plot and save at the same time, you must wait for the device to be ready
 * before calling the `startCapturingToFile()` function:
 *
 * ```
 * plotter
 *   .on("ready", function() {
 *     this.startCapturingToFile("test.hpgl");
 *   })
 *
 *   .on("error", function (err) {
 *     console.log(err);
 *   })
 *   .connect(transport);
 *
 * ```
 *
 * @param [path="job.hpgl"] {String} - The path of the file to append to.
 * @param [options] {Object} - Options affecting how the commands are captured to file.
 * @param [options.model="GENERIC"] {String} - The target device's model.
 * @param [options.orientation="landscape"] {String} The orientation of the paper: *landscape* or
 * *portrait*.
 * @param [options.paper="A"] {String} - The targeted paper size. Choices vary depending on the
 * device. Typical choices are:
 *   - **A**: ANSI A (8.5"x11", a.k.a "letter")
 *   - **B**: ANSI B (11"x17", a.k.a "tabloid")
 *   - **A4**: ISO A4 (210mm × 297mm)
 *   - **A3**: ISO A3 (297mm × 420mm)
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.startCapturingToFile = function(path = "job.hpgl", options = {}) {

  this._outputFile = path;

  // Any specified model, paper and orientation parameters are ignored if a connection is already
  // open.
  if (!this.connected) {

    // Model
    if (Models[options.model]) {
      this.characteristics = Models[options.model];
    } else {
      this.characteristics = Models["GENERIC"];
    }

    // Paper
    if (
      options.paper &&
      this.characteristics.papers.list.includes(options.paper.toUpperCase())
    ) {
      this.paper = options.paper.toUpperCase();
    }

    // Orientation
    if (
      options.orientation &&
      ORIENTATIONS.includes(options.orientation.toLowerCase())
    ) {
      this.orientation = options.orientation.toLowerCase();
    }

  }

  // Inform device of the paper size we wish to use. This is not necessary on devices that use the
  // same orientation for all paper sizes. It should be noted that, on some devices, this affects
  // orientation (see below).
  if ( this.characteristics.papers[this.paper].hasOwnProperty("psCode") ) {
    this._appendToOutputFile("PS" + this.characteristics.papers[this.paper].psCode + ";");
  }

  // Orientation
  if (this.orientation === "landscape") {

    this._appendToOutputFile("RO0;");    // do not rotate (or rotate back to default)

  } else {

    // Check if the device supports the rotation (not all do)
    if ( this.characteristics.instructions.includes("RO") ) {
      this._appendToOutputFile("RO90;");   // rotate to other orientation
    } else {
      throw new Error("The device does not support the '" + this.orientation + "' orientation.");
    }

  }

  // Reassign P1 and P2 and reset plotting window
  this._appendToOutputFile("IP;");
  this._appendToOutputFile("IW;");

};

/**
 * Stops hpgl commands from being saved to file.
 *
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.stopCapturingToFile = function() {

  if (!this.connected) {
    this.characteristics = undefined;
    this.orientation = "landscape";
    this.paper = "A";
  }

  this._outputFile = undefined;

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
 * Returns an object with `top`, `right`, `bottom` and `left` properties each containing the size of
 * the corresponding margin. The device model, the paper size and the paper orientation must have
 * been defined before calling this function, otherwise the function will return `undefined`.
 *
 * @param metric {Boolean} Whether the margin values should be returned in cm (default) or decimal
 * inches.
 * @returns {Object} An object with `top`, `right`, `bottom` and `left` properties.
 */
Plotter.prototype.getMargins = function(metric = true) {

  let paper, margins = {};

  try {
    paper = this.characteristics.papers[this.paper];
    margins.top = this._fromPlotterUnits(paper.margins[this.orientation].top, metric);
    margins.right = this._fromPlotterUnits(paper.margins[this.orientation].right, metric);
    margins.bottom = this._fromPlotterUnits(paper.margins[this.orientation].bottom, metric);
    margins.left = this._fromPlotterUnits(paper.margins[this.orientation].left, metric);
  } catch (e) {
    return undefined;
  }

  return margins;

};

/**
 * Fetches status information about the device. Once retrieved, the status information is packaged
 * in an object that is passed to the specified callback.
 *
 * The status request is not queued. It is being answered by the device in an immediate fashion. It
 * still takes a little while but does not wait for previous drawing instructions to complete. It
 * does not affect drawing in any way.
 *
 * @param {Function} callback A function to call once the status data has been obtained from the
 * device. This function receives an object with various properties which are detailed below.
 * @param {Boolean} callback.rollPaper Whether roll paper or sheet paper is being used.
 * @param {Boolean} callback.cleanPaper Whether the paper is "clean" (set after being sensed). The
 * paper is considered to not be clean if:
 *  * No paper is loaded or advanced
 *  * The pen has touched the paper
 *  * No paper was sensed before or after paper advance (end of roll)
 * @param {Boolean} callback.paperAdvance Whether a paper advance instruction has been received
 * since the last time the status was retrieved.
 * @param {Boolean} callback.bufferEmpty Whether the buffer is currently empty or not.
 * @param {Boolean} callback.ready Whether the device is ready to receive instructions or not.
 * @param {Boolean} callback.viewEngaged Whether "view" mode is currently engaged.
 * @param {Boolean} callback.coverOpen Whether the cover is currently open.
 * @param {Boolean} callback.emulateMode Whether the device is in emulate or normal mode.
 * @param {Boolean} callback.expandMode Whether expand mode is activated or not.
 *
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.getStatus = function(callback) {

  this.send(this.RS232_PREFIX + "O", (data) => {

    let n = parseInt(data);

    let status = {
      rollPaper:    (n & 0b000000001) === 1,
      cleanPaper:   (n & 0b000000010) !== 2,
      paperAdvance: (n & 0b000000100) === 4,
      bufferEmpty:  (n & 0b000001000) === 8,
      ready:        (n & 0b000110000) === 0,
      viewEngaged:  (n & 0b000110000) === 16,
      coverOpen:    (n & 0b001000000) === 64,
      emulateMode:  (n & 0b010000000) === 128,
      expandMode:   (n & 0b100000000) === 256
    };

    if (typeof callback === "function") callback(status);

  }, true);

  return this;

};

/**
 * Queues a single HPGL instruction, a series of HPGL instructions concatenated in a string or a
 * single RS-232-C device control command. The instructions will be sent as soon as the device's
 * buffer can accept them.
 *
 * Unless you are very familiar with HPGL or RS-232-C, you should not use this method directly.
 * Instead, you can use friendlier methods such as: [drawLines()]{@link Plotter#drawLines},
 * [drawText()]{@link Plotter#drawText}, [drawCircle()]{@link Plotter#drawCircle}, etc.
 *
 * @param {string} instruction - Any valid HPGL instruction(s) or RS-232-C command.
 * @param {Function} [callback=null] A function to call once the data has been sent to the device
 * (default) or when an answer has been received from the device (when `waitForResponse` is true).
 * Note that if `waitForResponse` is `true`, the callback function will receive a single parameter
 * containing the data received from the device. Also note that if the instruction string contains
 * multiple commands, the callback will be fired after each command.
 * @param {Object} [options=Object] Additional options
 * @param {Boolean} [options.waitForResponse=false] Whether to execute the callback function
 * immediately after the data has been sent or only after an answer has been received from the
 * device.
 * @param {Boolean} [options.ignoreOutputInstructions=false] Whether to ignore HPGL output
 * instructions (instructions starting with "O"). This is useful when plotting a whole file.
 * @returns {Plotter} Returns the `Plotter` object to allow method chaining.
 */
Plotter.prototype.queue = function(instruction, callback = null, options = {}) {

  // Check if we are dealing with a single instruction or multiple instructions concatenated in one
  // string. To do that, we build a regex that will break the string on semicolons, newlines or CTX
  // characters (for label). Then we filter out empty elements.
  let regex = new RegExp("[;\n" + String.fromCharCode(3) + "]");
  let commands = instruction.split(regex).filter(function(n) { return n.length >= 2; });

  // The callback is only added to the last element (if many instructions are concatenated together)
  for (let i = 0; i < commands.length; i++) {

    if (commands[i].startsWith("O") && options.ignoreOutputInstructions) {
      // console.log("Ignored: " + commands[i]);
      continue;
    }

    // console.log("Queued: " + commands[i]);

    // Make sure a single instruction is not bigger than the device's buffer. This is also checked
    // in send() but must be checked here because a command that is larger than the maximum buffer
    // size will never make it to the send() function. Important: we must add 1 to the length
    // because of the termination character that will be added by send().
    if (
      this.characteristics &&
      this.characteristics.buffer &&
      commands[i].length + 1 > this.characteristics.buffer
    ) {
      this._stopAndEmptyQueue();
      throw new RangeError(
        `Maximum HP-GL instruction length cannot be larger than device buffer. Instruction is ` +
        `${(commands[i].length + 1)} characters long but buffer is only ${this.characteristics.buffer}.`
      );
    }

    let command = { instruction: commands[i] };

    if (i === commands.length - 1) {
      command.callback = callback;
      command.waitForResponse = options.waitForResponse;
    }

    this._queue.push(command);

  }

  // If the queue is not set for execution, set it.
  if (this._queueTimeOutId === 0) {
    this._queueTimeOutId = setTimeout(this._processQueue.bind(this), this.QUEUE_DELAY);
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

  // console.log("Process queue");

  // Make sure any pending timeout is cancelled. We will add a new one if necessary. Exit if no
  // commands are pending.
  clearTimeout(this._queueTimeOutId);
  this._queueTimeOutId = 0;
  if (this._queue.length < 1) { return; }

  // Are we connected to a device? If not, simply save to file and move along
  if (!this.connected && this._outputFile) {

    // Since we are not limited by the device's buffer, exhaust all commands at once and emopty
    // queue when done.
    this._queue.forEach((command) => {
      this.send(command.instruction, command.callback);
    });
    this._queue = [];

    // Make sure the queue continues to be processed.
    this._queueTimeOutId = setTimeout(this._processQueue.bind(this), this.QUEUE_DELAY);

  } else {

    // Before sending the actual command, we first send a request to know the available buffer space
    // on the device. Since the response can sometimes be lost, we setup a timer that will retry
    // should the response never come in.
    let to = setTimeout(() => {
      console.log("Warning: Bad communication with the device. Attempting once more.");
      this._queueTimeOutId = setTimeout(this._processQueue.bind(this), this.QUEUE_DELAY);
    }, this.MAX_RESPONSE_TIME);

    this.send(this.RS232_PREFIX + "B", (data) => {

      // Remove retry timeout
      clearTimeout(to);

      // If there is enough buffer space, we send the instruction. Otherwise, we set a timeout to
      // delay processing until later.
      if (this._queue[0].instruction.length <= data) {

        // console.log("Enough buffer space: " + data);

        // Send oldest available instruction first (and keep it for later check)
        let command = this._queue.shift();
        this.send(command.instruction, command.callback, command.waitForResponse);

        // If the command must wait for a response, we have to hold the queue until then. Otherwise,
        // if more commands are in the queue, process them.
        if (command.waitForResponse) {

          console.log("Wait for response.");

          this.once("data", () => {
            this._queueTimeOutId = setTimeout(this._processQueue.bind(this), this.QUEUE_DELAY);
          })

        } else if (this._queue.length > 0) {
          this._queueTimeOutId = setTimeout(this._processQueue.bind(this), this.QUEUE_DELAY);
        }

      } else {

        this._queueTimeOutId = setTimeout(this._processQueue.bind(this), this.QUEUE_DELAY);

      }

    }, true);

  }

};

module.exports.Plotter = Plotter;
