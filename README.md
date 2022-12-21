# hpgl
**A Node.js library to control HPGL-compatible plotters**

[![npm](https://img.shields.io/npm/v/hpgl.svg)](https://www.npmjs.com/package/hpgl)
[![npm](https://img.shields.io/npm/dt/hpgl.svg)](https://www.npmjs.com/package/hpgl)

### About

The `hpgl` library makes it possible to interact with plotters that support the *Hewlett-Packard 
Graphics Language* (a.k.a. **hpgl**). This language is the *de facto* standard for most plotters. 

**Warning: This library is still in early stages of development. It should not be used in 
production.**

### Compatibility

This library relies on external modules for serial communication. To use it in a pure Node.js, 
environment, you will need to install and use the 
[serialport](https://www.npmjs.com/package/serialport) module. If you want to use this library 
inside [Chrome Apps](https://developer.chrome.com/apps/about_apps) or [NW.js](http://nwjs.io/)
applications, you will need to install the [browser-serialport](https://www.npmjs.com/package/browser-serialport) 
module instead (**version 2.1.0 or greater**). 

> *Note: it is possible to use `node-serialport` within NW.js and Electron projects but it needs to 
> be specifically recompiled for those environment.*

So far, the library has only beed tested with [HP 7475A](http://hpmuseum.net/display_item.php?hw=74), 
[HP 7440A](http://hpmuseum.net/display_item.php?hw=80) and 
[Roland DXY-1300](https://archive.org/details/rolanddxy130012001100commandreferencemanualaf**) 
plotters. If you have success with other makes or models, [let me know](https://twitter.com/djipco). 
Beware that some HP plotters are only equipped with a proprietary HPIB or GPIB interface. To use 
this library, your plotter must have a **serial** interface (RS-232-C).

### Coordinate System

The plotting coordinate system is anchored in the top-left corner, just like a computer screen. 
This means positive `x` goes right and positive `y` goes down. By default, plotters usually work 
differently, but I find it easier to stick with the computer screen standard.

### Getting Started

To get started, you will need a few pieces of hardware:

- HPGL-compatible plotter with a serial interface;
- USB-to-Serial adapter (unless your computer has a serial port);
- Male DB-25 to female DB-9 cable (a.k.a. null modem cable);
- Pens that fit your plotter;
- Paper.

Your plotter needs to be set to a line speed of 9600 baud with 
[8-N-1](https://en.wikipedia.org/wiki/8-N-1) settings. Chances are high this is already the case. If
not, you may need to adjust some dip switches on your device. Refer to the manufacturers's 
documentation.

### Example

The first thing you need to do to get plotting is instantiate the object used for serial 
communication. If you are working on a Node.js project using the `serialport` module, this is how 
you would do it:

```javascript
// Import the 'serialport' module and instantiate it. Do not forget to set 'autoOpen' to false in 
// the options.
const SerialPort = require("serialport");
var transport = new SerialPort("/dev/tty.usbserial", {autoOpen: false});

```

If you are working on a Chrome or NW.js application, the procedure is slightly different:

```javascript
// Import the 'browser-serialport' module and instantiate it. Pass 'false' as the third parameter of
// the SerialPort constructor so no automatic connection attempt is made.
const SerialPort = require("browser-serialport").SerialPort;
var transport = new SerialPort("/dev/tty.usbserial", {}, false);
```

Once the `transport` variable is ready, the remainining of the code is exactly the same no matter
which transport you use. For example, here is the code necessary to draw "Hello, World!".

```javascript

// Import the 'Plotter' class and instantiate it
const Plotter = require("hpgl").Plotter;
var plotter = new Plotter();

// Connect the device and add a callback to draw some text.
plotter.connect(transport, {}, function(error) {

  if (error) {
    console.log(error);
    return;
  }

  this
    .moveTo(1, 1)
    .drawText("Hello, World!");

});
```

As you can see above, you first need to create a `Plotter` object and call its `connect()` method 
passing in the `transport` variable, some optionnal settings and a function to trigger once the 
device is ready. Note that `this` is bound to the `Plotter` object and that plotting methods are 
chainable.

### Using Multiple Plotters

This library can be used to connect several plotters to the same host. However, not all 
USB-to-Serial chipsets support this. 

For example, the Prolific 2303 driver crashes my computer when I try use more than one adapter. On 
the other hand, the Texas Instrument/TI driver works beautifully with multiple devices.

### Documentation

I will try to maintain an up-to-date [API documentation](https://djipco.github.io/hpgl/). A good
place to start is the [Plotter class](https://djipco.github.io/hpgl/Plotter.html). If you find
errors, please [file an issue](https://github.com/djipco/hpgl/issues) on GitHub.

## Support the Project

If you find this library useful, you can 💜 [**sponsor the project**](https://github.com/sponsors/djipco)
as a token of your appreciation. This would automatically make you even more awesome than you already 
are!

Cheers!
