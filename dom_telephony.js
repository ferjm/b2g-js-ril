/**
 * Singleton object that talks to the RIL worker.
 * 
 * This simply multiplexes incoming messages from the RIL worker to all
 * navigator.mozTelephony objects it knows about, and it provides an
 * API for navigator.mozTelephony objects to send messages to the RIL.
 */
function nsRadioInterface(worker) {
  this.worker = worker;
  this.worker.addEventListener("message", function onmessage(event) {
    this.handleMessage(event.data);
  }.bind(this));

  this._callbacks = [];
}
nsRadioInterface.prototype = {

  //QueryInterface: XPCOMUtils.generateQI([Ci.nsITelephonyWorker,
  //                                       Ci.nsIRadioInterface]);

  handleMessage: function handleMessage(message) {
    let methodname = "on" + message.type;
    let value;
    switch (message.type) {
      case "signalstrengthchange":
        value = message.signalStrength;
        break;
      case "operatorchange":
        value = message.operator;
        break;
      case "onradiostatechange":
        value = message.radioState;
        break;
      case "cardstatechange":
        value = message.cardState;
        break;
      case "callstatechange":
        value = message.callState;
        break;
      default:
        // Got some message from the RIL worker that we don't know about.
    }
    this._callbacks.forEach(function (callback) {
      let method = callback[methodname];
      if (typeof method != "function") {
        return;
      }
      method.call(callback, value);
    });
  },

  sendMessage: function sendMessage(message) {
    this.worker.postMessage(message, "*");//XXX
  },

  // nsITelephonWorker

  worker: null,

  // nsIRadioInterface

  dial: function dial(number) {
    this.sendMessage({type: "dial", number: number});
  },

  _callbacks: null,

  registerCallback: function registerCallback(callback) {
    this._callbacks.push(callback);
  },

  unregisterCallback: function unregisterCallback(callback) {
    let index = this._callbacks.indexOf(callback);
    if (index == -1) {
      throw "Callback not registered!";
    }
    this._callbacks.splice(index, 1);
  },

};


//let gRadioInterface = Cc[...].getService(Ci.nsIRadioInterface);
let gRadioInterface;

/**
 * Define an event listener slot on an object, e.g.
 * 
 *   obj.onerror = function () {...}
 * 
 * will register the function as an event handler for the "error" event
 * if the "error" slot was defined on 'obj' or its prototype.
 */
function defineEventListenerSlot(object, event_type) {
  let property_name = "on" + event_type;
  let hidden_name = "_on" + event_type;
  let bound_name = "_bound_on" + event_type;
  object.__defineGetter__(property_name, function getter() {
    return this[hidden_name];
  });
  object.__defineSetter__(property_name, function setter(handler) {
    let old_handler = this[bound_name];
    if (old_handler) {
      this.removeEventListener(event_type, old_handler);
    }
    // Bind the handler to the object so that its 'this' is correct.
    let bound_handler = handler.bind(this);
    this.addEventListener(event_type, bound_handler);
    this[hidden_name] = handler;
    this[bound_name] = bound_handler;
  });
}


/**
 * Base object for event targets.
 */
function EventTarget() {}
EventTarget.prototype = {

  addEventListener: function addEventListener(type, handler) {
    //TODO verify that handler is an nsIDOMEventListener (or function)
    if (!this._listeners) {
      this._listeners = {};
    }
    if (!this._listeners[type]) {
      this._listeners[type] = [];
    }
    this._listeners[type].push(handler);
  },

  removeEventListener: function removeEventListener(type, handler) {
     let list, index;
     if (this._listeners &&
         (list = this._listeners[type]) &&
         (index = list.indexOf(handler) != -1)) {
       list.splice(index, 1);
       return;
     }
     throw "XXX TODO some error";
  },

  dispatchEvent: function dispatchEvent(event) {
    //TODO this does not deal with bubbling, defaultPrevented, canceling, etc.
    let list = this._listeners[event.type];
    if (!list) {
      return;
    }
    event.target = this;
    list.forEach(function (handler) {
      switch (typeof handler) {
        case "function":
          handler(event);
          break;
        case "object":
          handler.handleEvent(event);
          break;
      }
    });
  }
};

/**
 * Callback object that Telephony registers with nsIRadioInterface.
 * Telephony can't use itself because that might overload event handler
 * attributes ('onfoobar').
 */
function TelephonyRadioCallback(telephony) {
  this.telephony = telephony;
}
TelephonyRadioCallback.prototype = {

  //QueryInterface: XPCOMUtils.generateQI([Ci.nsIRadioCallback]);

  // nsIRadioCallback

  onsignalstrengthchange: function onsignalstrengthchange(signalStrength) {
    this.telephony.signalStrength = signalStrength;
    this.telephony._dispatchEventByType("signalstrengthchange");
  },

  onoperatorchange: function onoperatorchange(operator) {
    this.telephony.operator = operator;
    this.telephony._dispatchEventByType("operatorchange");
  },

  onradiostatechange: function onradiostatechange(radioState) {
    this.telephony.radioState = radioState;
    this.telephony._dispatchEventByType("radiostatechange");
  },

  oncardstatechange: function oncardstatechange(cardState) {
    this.telephony.cardState = cardState;
    this.telephony._dispatchEventByType("cardstatechange");
  },

  oncallstatechange: function oncallstatechange(callState) {
    //TODO
  },

};

/**
 * The navigator.mozTelephony object.
 */
function Telephony(window) {
  this.init(window);
}
Telephony.prototype = {

  __proto__: EventTarget.prototype,

  //QueryInterface: XPCOMUtils.generateQI([Ci.mozIDOMTelephony]);

  init: function init(window) {
    this.window = window;
    this.radioCallback = new TelephonyRadioCallback(this);
    window.addEventListener("unload", function onunload(event) {
      gRadioInterface.unregisterCallback(this.radioCallback);
      this.radioCallback = null;
      this.window = null;
    }.bind(this));
    gRadioInterface.registerCallback(this.radioCallback);
    this.liveCalls = [];
  },

  _dispatchEventByType: function _dispatchEventByType(type) {
    let event = this.window.document.createEvent("Event");
    event.initEvent(type, false, false);
    //event.isTrusted = true;
    this.dispatchEvent(event);
  },

  // mozIDOMTelephony

  liveCalls: null,

  dial: function dial(number) {
    gRadioInterface.dial(number);
    return new TelephonyCall(number, DOM_CALL_READYSTATE_DIALING);
  },

  // Additional stuff that's useful.

  signalStrength: null,
  operator: null,
  radioState: DOM_RADIOSTATE_UNAVAILABLE,
  cardState: DOM_CARDSTATE_UNAVAILABLE,

};
defineEventListenerSlot(Telephony.prototype, "radiostatechange");
defineEventListenerSlot(Telephony.prototype, "cardstatechange");
defineEventListenerSlot(Telephony.prototype, "signalstrengthchange");
defineEventListenerSlot(Telephony.prototype, "operatorchange");
defineEventListenerSlot(Telephony.prototype, "incoming");


function TelephonyCall(number, initialState) {
  this.number = number;
  this.readyState = initialState;
}
TelephonyCall.prototype = {

  __proto__: EventTarget.prototype,

  number: null,
  readyState: null,

  answer: function answer() {
    //TODO
  },

  disconnect: function disconnect() {
    //TODO
  },

};
defineEventListenerSlot(TelephonyCall.prototype, "connect");
defineEventListenerSlot(TelephonyCall.prototype, "disconnect");
defineEventListenerSlot(TelephonyCall.prototype, "busy");
