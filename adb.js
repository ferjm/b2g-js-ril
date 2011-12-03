
const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/Services.jsm");

const gTransportService = Cc["@mozilla.org/network/socket-transport-service;1"]
                            .getService(Ci.nsISocketTransportService);

const BinaryInputStream = Components.Constructor(
  "@mozilla.org/binaryinputstream;1",
  "nsIBinaryInputStream",
  "setInputStream");

const BinaryOutputStream = Components.Constructor(
  "@mozilla.org/binaryoutputstream;1",
  "nsIBinaryOutputStream",
  "setOutputStream");





const ADB_REQUEST_PREFIX_LEN = 4;
const ADB_RESPONSE_PREFIX_LEN = 4;

const isUnsolicited = /[0-9abcdef]{4}/;



let ADB = {

  connected: false,

  listen: function listen(host, port, errorCallback) {
    this.errorCallback = errorCallback;
    this.socket = gTransportService.createTransport(null, 0, host, port, null);
    this.inputStream = this.socket.openInputStream(0, 0, 0);
    this.binaryInputStream = BinaryInputStream(this.inputStream);
    this.outputStream = this.socket.openOutputStream(0, 0, 0);
    this.binaryOutputStream = BinaryOutputStream(this.outputStream);
    this.inputStream.asyncWait(this, 0, 0, Services.tm.currentThread);
    this.connected = true;
    debug("Connected to " + host + ":" + port);
  },

  stop: function stop() {
    debug("Stopping socket");
    this.connected = false;
    this.socket.close(0);
  },

  /**
   * nsIInputStreamCallback
   */
  onInputStreamReady: function onInputStreamReady() {
    if (!this.connected) {
      return;
    }
    while (true) {
      let data;
      try {
        let length = this.inputStream.available();
        if (!length) {
          break;
        }
        data = this.binaryInputStream.readBytes(length);
      } catch(ex) {
        this.stop();
        this.errorCallback(ex);
        return;
      }
      this.processData(data);
    }
    this.inputStream.asyncWait(this, 0, 0, Services.tm.currentThread);
  },

  requestCbs: [],
  buffer: "",
  response: null,

  processData: function processData(data) {
    debug("Received " + data.length + " bytes: " + JSON.stringify(data));
    this.buffer += data;
    while (true) {
      let response = this.response;
      if (response == null) {
        if (this.buffer.length < 2 * ADB_RESPONSE_PREFIX_LEN) {
          return;
        }
        response = this.response = {};
        let status_or_length = this.buffer.slice(0, ADB_RESPONSE_PREFIX_LEN);
        response.solicited = !isUnsolicited.test(status_or_length);
        if (response.solicited) {
          response.status = status_or_length;
          let lengthstr = this.buffer.slice(ADB_RESPONSE_PREFIX_LEN,
                                            2 * ADB_RESPONSE_PREFIX_LEN);
          response.length = parseInt(lengthstr, 16);
          this.buffer = this.buffer.slice(2 * ADB_RESPONSE_PREFIX_LEN);         
        } else {
          response.length = parseInt(status_or_length, 16);
          this.buffer = this.buffer.slice(ADB_RESPONSE_PREFIX_LEN);
        }
      }

      if (this.buffer.length < response.elngth) {
        return;
      }

      response.data = this.buffer.slice(0, this.response.length);
      this.buffer = this.buffer.slice(response.length);
      this.response = null;

      if (response.solicited) {
        let callback = this.requestCbs.shift();
        callback(response);
      } else {
        this.handleUnsolicited(response);
      }
    }
  },

  sendData: function sendData(data) {
    debug("Sending " + data);
    this.binaryOutputStream.writeBytes(data, data.length);
    this.binaryOutputStream.flush();
  },

  sendRequest: function sendRequest(request, callback) {
    // Create an ASCII string preceeded by four hex digits. The opening "####"
    // is the length of the rest of the string, encoded as ASCII hex.
    let length = ("000" + request.length.toString(16))
                 .slice(-ADB_REQUEST_PREFIX_LEN);
    request = length + request;
    this.sendData(request);
    this.requestCbs.push(callback);
  },

  handleUnsolicited: function handleUnsolicited(response) {
    debug("Unsolicited:");
    debug(response);
    //TODO
  },

  parseDeviceData: function parseDeviceData(data) {
    let lines = data.split("\n");
    let devices = [];
    lines.forEach(function (line) {
      if (!line) {
        return;
      }
      let data = line.split("\t");
      devices.push({serial: data[0],
                    state:  data[1]});
    });
    return devices;
  },

  /**
   * API
   */

  getDevices: function getDevices(callback) {
    this.sendRequest("host:track-devices", function (response) {
      let devices = this.parseDeviceData(response.data);
      debug("Devices: " + JSON.stringify(devices));
      callback(devices);
    }.bind(this));
  },

  setDevice: function setDevice(serial, callback) {
    this.sendRequest("host:transport:" + serial, function (response) {
      debug("setDevice:");
      debug(response);
    });
  },

  getEventLog: function getEventLog(callback) {
    this.sendRequest("log:event", function (response) {
      debug("eventlog:");
      debug(response);
    });
  },

  getLogcat: function getLogcat(callback) {
    this.sendRequest("log:radio", function (response) {
      debug("logcat:");
      debug(response);
    });
  },

};
