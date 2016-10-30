# hpgl
**A Node.js library to control HPGL-compatible plotters**

> **This library is still in early stages of development. It should not be used in production.**

### About

The `hpgl` library makes it possible to interact with plotters that support the *Hewlett-Packard 
Graphics Language* (a.k.a. **hpgl**). This language is the *de facto* standard for most plotters. 

### Compatibility

So far, the library has only beed tested with an 
[HP 7475a plotter](http://hpmuseum.net/display_item.php?hw=74). If you have success with other makes
or models, [let me know](https://twitter.com/jpcote). Beware that some HP plotters are only equipped 
with a proprietary HPIB or GPIB interface. To use this library, your plotter must have a serial 
interface.

The library is currently being developed using the 
[browser-serialport](https://www.npmjs.com/package/browser-serialport) Node.js module. This module
only works inside [Chrome Apps](https://developer.chrome.com/apps/about_apps) and 
[NW.js apps](http://nwjs.io/). However, since `browser-serialport` adheres to the
[serialport](https://www.npmjs.com/package/serialport) module API, it should theoretically work with 
that module also (not tested yet!).

### Getting Started

To get started, you will need a few pieces of hardware:

- HPGL-compatible plotter with a serial interface
- USB-to-Serial adapter (unless your computer has a serial port)
- Male DB-25 to female DB-9 cable (a.k.a. null modem cable)
- Pens that fit your plotter
- Paper

Your plotter needs to be set to a line speed of 9600 baud with 
[8-N-1](https://en.wikipedia.org/wiki/8-N-1) settings. Chances are high this is already the case. If
not, you may need to adjust some dip switches on your device. Refer to the manufacturers's 
documentation.

### Example

Here is an example of how you would use the `Plotter` object from the library to draw some text. 
As stated earlier, this particular example uses the `browser-serialport` Node.js module.

```javascript
// Import a transport library compatible with the 'serialport' module. In this case, we use
// 'browser-serialport'.
var SerialPort = require("browser-serialport").SerialPort;

// Import this library's Plotter object.
var Plotter = nw.require("../src/hpgl.js").Plotter;

// Prepare a transport to be used by the Plotter object (3rd argument must be 'false' so no
// connection attempt is made automatically).
var transport = new SerialPort("/dev/tty.usbserial", {}, false);

// Instantiate the PLotter object.
var plotter = new Plotter();

// Assign a listener for the 'ready' event anc connect to the physical device.
plotter
  .on("ready", onReady)
  .connect(transport);

// When the plotter is ready, move to position and write some text.
function onReady () {
  plotter
    .moveTo(12, 2)
    .drawText("Hello, World!")
}
```
### Documentation

I'm trying hard to maintain an up-to-date [API documentation](https://cotejp.github.io/hpgl/). If 
you find errors, please [file an issue](https://github.com/cotejp/hpgl/issues).