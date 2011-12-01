/**
 * Singleton object that talks to the RIL worker.
 * 
 * This simply multiplexes incoming messages from the RIL worker to all
 * navigator.mozTelephony objects it knows about, and it provides an
 * API for navigator.mozTelephony objects to send messages to the RIL.
 */
function nsTelephonyWorker(worker) {
  this.worker = worker;
  this.worker.addEventListener("message", function onmessage(event) {
    this.handleMessage(event.data);
  }.bind(this));

  this._telephony_listeners = [];
}
nsTelephonyWorker.prototype = {

  handleMessage: function handleMessage(message) {
    this._telephony_listeners.forEach(function (listener) {
      listener.handleMessage(message);
    });
  },

  sendMessage: function sendMessage(message) {
    this.worker.postMessage(message, "*");//XXX
  },

  _telephony_listeners: null,

  addTelephonyListener: function addTelephonyListener(telephony) {
    this._telephony_listeners.push(telephony);
  },

  removeTelephonyListener: function removeTelephonyListener(telephony) {
    let index = this._telephony_listeners.indexOf(telephony);
    if (index == -1) {
      throw "Telephony listener not registered!";
    }
    this._telephony_listeners.splice(index, 1);
  },

};


//let gTelephonyWorker = Cc[...].getService(Ci.nsITelephonyWorker);
let gTelephonyWorker;

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
console.log(Error().stack);
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

const DOM_RADIOSTATE_UNAVAILABLE = "unavailable";
const DOM_RADIOSTATE_OFF         = "off";
const DOM_RADIOSTATE_READY       = "ready";
   
const DOM_CARDSTATE_UNAVAILABLE    = "unavailable";
const DOM_CARDSTATE_ABSENT         = "absent";
const DOM_CARDSTATE_PIN_REQUIRED   = "pin_required";
const DOM_CARDSTATE_PUK_REQUIRED   = "puk_required";
const DOM_CARDSTATE_NETWORK_LOCKED = "network_locked";
const DOM_CARDSTATE_NOT_READY      = "not_ready";
const DOM_CARDSTATE_READY          = "ready";

/**
 * The navigator.mozTelephony object.
 */
function Telephony(window) {
  this.window = window;
  window.addEventListener("unload", function onunload(event) {
    this.window.removeEventListener("unload", this);
    gTelephonyWorker.removeTelephonyListener(this);
    this.window = null;
  }.bind(this));
  gTelephonyWorker.addTelephonyListener(this);
  this.liveCalls = [];
}
Telephony.prototype = {

  __proto__: EventTarget.prototype,

  handleMessage: function handleMessage(message) {
    if (message.type == "callstatechange") {
      this.handleCallStateChange(message);
      return;
    }
    switch (message.type) {
      case "signalstrengthchange":
        this.signalStrength = message.signalStrength;
        break;
      case "operatorchange":
        this.operator = message.operator;
        break;
      case "radiostatechange":
        this.radioState = message.radioState;
        break;
      case "cardstatechange":
        this.cardState = message.cardState;
        break;
    }

    let event = this.window.document.createEvent("Event");
    event.initEvent(message.type, false, false);
    this.dispatchEvent(event);
  },

  handleCallStateChange: function handleCallStateChange(message) {
    //TODO
  },

  // nsIDOMEventListener

  handleEvent: function handleEvent(event) {
    switch (event.type) {
      case "unload":
        this.window.removeEventListener("unload", this);
        gTelephonyWorker.removeTelephonyListener(this);
        this.window = null;
    }
  },

  // mozIDOMTelephony

  liveCalls: null,

  dial: function dial(number) {
    gTelephonyWorker.sendMessage({type:  "dial",
                                  number: number});
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


const DOM_CALL_READYSTATE_DIALING   = "dialing";
const DOM_CALL_READYSTATE_DOM_CALLING   = "calling";
const DOM_CALL_READYSTATE_INCOMING  = "incoming";
const DOM_CALL_READYSTATE_CONNECTED = "connected";
const DOM_CALL_READYSTATE_CLOSED    = "closed";
const DOM_CALL_READYSTATE_BUSY      = "busy";

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
