
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



const ADB_DEFAULT_HOST = "127.0.0.1";
const ADB_DEAFULT_PORT = "5037";
const ADB_REQUEST_LENGTH_LEN = 4;
const ADB_RESPONSE_STATUS_LEN = 4;
const ADB_PACKET_LENGTH_LEN = 4;
const ADB_STATUS_OKAY = "OKAY";
const ADB_STATUS_FAIL = "FAIL";


function ADBRequest(host, port) {
  this.host = host;
  this.port = port;
}
ADBRequest.prototype = {

  host: null,
  port: null,
  socket: null,

  inputStream: null,
  binaryInputStream: null,
  outputStream: null,
  binaryOUtputStream: null,

  connect: function connect() {
    this.socket = gTransportService.createTransport(null, 0, this.host,
                                                    this.port, null);
    this.inputStream = this.socket.openInputStream(0, 0, 0);
    this.binaryInputStream = BinaryInputStream(this.inputStream);
    this.outputStream = this.socket.openOutputStream(0, 0, 0);
    this.binaryOutputStream = BinaryOutputStream(this.outputStream);
    this.inputStream.asyncWait(this, 0, 0, Services.tm.currentThread);
    this.connected = true;
    debug("Connected to " + host + ":" + port);
  },

  disconnect: function disconnect() {
    this.connected = false;
    this.socket.close(0);
    this.socket = null;
    this.inputStream = null;
    this.binaryInputStream = null;
    this.outputStream = null;
    this.binaryOutputStream = null;
  },

  transmit: function transmit(data) {
    debug("Transmitting " + data);
    this.binaryOutputStream.writeBytes(data, data.length);
    this.binaryOutputStream.flush();
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
        this.disconnect();
        this.handleReadError(ex);
        return;
      }
      this.processData(data);
    }
    this.inputStream.asyncWait(this, 0, 0, Services.tm.currentThread);
  },

  handleReadError: function handleReadError(error) {
    debug("Error");
    debug(error);
    //TODO dispatch to either oncomplete or onerror
  },

  /**
   * Incoming read buffer.
   */
  buffer: "",

  /**
   * Transient attributes.
   */
  responseStatus: null,
  packetLength: null,
  responseDispatched: false,

  processData: function processData(data) {
    debug("Received " + data.length + " bytes: " + JSON.stringify(data));
    this.buffer += data;
    while (true) {
      // If we don't know the response status yet, try to read it from
      // the buffer. This is the very first thing that gets sent back
      // and only once per connection.
      if (this.responseStatus == null) {
        if (this.buffer.length < ADB_RESPONSE_STATUS_LEN) {
          return;
        }
        this.responseStatus = this.buffer.slice(0, ADB_RESPONSE_STATUS_LEN);
        this.buffer = this.buffer.slice(ADB_RESPONSE_STATUS_LEN);
      }

      // If we don't know the current packet's length yet, try to read
      // it from the buffer. This gets reset to null every time we have
      // handled a packet.
      if (this.packetLength == null) {
        if (this.buffer.length < ADB_RESPONSE_LENGTH_LEN) {
          return;
        }
        let lengthstr = this.buffer.slice(0, ADB_RESPONSE_LENGTH_LEN);
        this.packetLength = parseInt(lengthstr, 16);
        this.buffer = this.buffer.slice(ADB_RESPONSE_LENGTH_LEN);
      }

      // Bail if we haven't received the whole packet yet.
      if (this.buffer.length < this.packetLength) {
        return;
      }

      let data = this.buffer.slice(0, this.packetLength);
      this.buffer = this.buffer.slice(this.packetLength);
      try {
        if (this.responseDispatched) {
          this.onincremental(data);
        } else {
          this.responseDispatched = true;
          this.onresponse(this.responseStatus, data);
        }
      } catch (ex) {
        debug("Exception while calling event handlers:");
        debug(ex);
      }
      this.packetLength = null;
    }
  },

  /**
   * Public API
   */

  /**
   * Indicate whether the socket is still open.
   */
  connected: false,

  /**
   * One of "OKAY", "FAIL", etc.
   */
  status: null,

  /**
   * Send the request.
   * 
   * @param request
   *        String specifying the request
   */
  send: function send(request) {
    this.connect();
    let length = ("000" + request.length.toString(16))
                 .slice(-ADB_REQUEST_LENGTH_LEN);
    request = length + request;
    this.transmit(request);
  },

  onresponse: function onresponse(status, data) {
  },

  onincremental: function onincremental(data) {
  },

  oncomplete: function oncomplete() {
  },

  onerror: function onerror(error) {
  },

};


function ADBClient(host, port) {
  if (!host) {
    this.host = ADB_DEFAULT_HOST;
  }
  if (!port) {
    this.port = ADB_DEFAULT_PORT;
  }
}
ADBClient.prototype = {

  newRequest: function newRequest() {
    return new ADBRequest(this.host, this.port);
  },

  simpleRequest: function simpleRequest(request, callback) {
    let request = this.newRequest();
    request.onresponse = function onresponse(status, response) {
      request.disconnect();
      callback(status, response);
    };
    return request;
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
    this.simpleRequest("host:track-devices", function (status, response) {
      if (status != ADB_STATUS_OKAY) {
        callback(status);
        return;
      }
      let devices = this.parseDeviceData(response.data);
      debug("Devices: " + JSON.stringify(devices));
      callback(null, devices);
    }.bind(this));
  },

  trackDevices: function trackDevices(callback) {
    //XXX
    this.newRequest("host:track-devices", function (response) {
      let devices = this.parseDeviceData(response.data);
      debug("Devices: " + JSON.stringify(devices));
      callback(devices);
    }.bind(this));
  },

  setDevice: function setDevice(serial, callback) {
    //XXX
    this.sendRequest("host:transport:" + serial, function (response) {
      debug("setDevice:");
      debug(response);
    });
  },

  getEventLog: function getEventLog(callback) {
    //XXX
    this.sendRequest("log:event", function (response) {
      debug("eventlog:");
      debug(response);
    });
  },

  getLogcat: function getLogcat(callback) {
    //XXX
    this.sendRequest("log:radio", function (response) {
      debug("logcat:");
      debug(response);
    });
  },

};
