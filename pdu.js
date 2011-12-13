/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is RIL JS Worker.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Kyle Machulis <kyle@nonpolynomial.com>
 *   Philipp von Weitershausen <philipp@weitershausen.de>
 *   Fernando Jimenez <ferjmoreno@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

"use strict";

// TODO: consts must be completed with 3GPP doc and placed in another file

const DEBUG = true;

/**
 * PDU TYPE-OF-ADDRESS
 * http://www.dreamfabric.com/sms/type_of_address.html
 */
const PDU_TOA_UNKNOWN       = 0x80; // Unknown. This is used when the user or
                                    // network has no a priori information about
                                    // the numbering plan.
const PDU_TOA_ISDN          = 0x81; // ISDN/Telephone numbering
const PDU_TOA_DATA_NUM      = 0x83; // Data numbering plan
const PDU_TOA_TELEX_NUM     = 0x84; // Telex numbering plan
const PDU_TOA_NATIONAL_NUM  = 0x88; // National numbering plan
const PDU_TOA_PRIVATE_NUM   = 0x89; // Private numbering plan
const PDU_TOA_ERMES_NUM     = 0x8A; // Ermes numbering plan
const PDU_TOA_INTERNATIONAL = 0x90; // International number
const PDU_TOA_NATIONAL      = 0xA0; // National number. Prefix or escape digits
                                    // shall not be included
const PDU_TOA_NETWORK_SPEC  = 0xB0; // Network specific number This is used to
                                    // indicate administration/service number
                                    // specific to the serving network
const PDU_TOA_SUSCRIBER     = 0xC0; // Suscriber number. This is used when a
                                    // specific short number representation is
                                    // stored in one or more SCs as part of a
                                    // higher layer application
const PDU_TOA_ALPHANUMERIC  = 0xD0; // Alphanumeric, (coded according to GSM TS
                                    // 03.38 7-bit default alphabet)
const PDU_TOA_ABBREVIATED   = 0xE0; // Abbreviated number

/**
* First octet of the SMS-DELIVER PDU
* http://www.dreamfabric.com/sms/deliver_fo.html
* RP:     0   Reply Path parameter is not set in this PDU
*         1   Reply Path parameter is set in this PDU
*
* UDHI:   0   The UD field contains only the short message
*         1   The beginning of the UD field contains a header in addition of
*             the short message
*
* SRI: (is only set by the SMSC)
*         0    A status report will not be returned to the SME
*         1    A status report will be returned to the SME
*
* MMS: (is only set by the SMSC)
*         0    More messages are waiting for the MS in the SMSC
*         1    No more messages are waiting for the MS in the SMSC
*
* MTI:   bit1    bit0    Message type
*         0       0       SMS-DELIVER (SMSC ==> MS)
*         0       0       SMS-DELIVER REPORT (MS ==> SMSC, is generated
*                         automatically by the M20, after receiving a
*                         SMS-DELIVER)
*         0       1       SMS-SUBMIT (MS ==> SMSC)
*         0       1       SMS-SUBMIT REPORT (SMSC ==> MS)
*         1       0       SMS-STATUS REPORT (SMSC ==> MS)
*         1       0       SMS-COMMAND (MS ==> SMSC)
*         1       1       Reserved
*/
const PDU_RP    = 0x80;       // Reply path. Parameter indicating that
                              // reply path exists.
const PDU_UDHI  = 0x40;       // User data header indicator. This bit is
                              // set to 1 if the User Data field starts
                              // with a header
const PDU_SRI_SRR = 0x20;     // Status report indication (SMS-DELIVER)
                              // or request (SMS-SUBMIT)
const PDU_VPF_ABSOLUTE = 0x18;// Validity period aboslute format
                              // (SMS-SUBMIT only)
const PDU_VPF_RELATIVE = 0x10;// Validity period relative format
                              // (SMS-SUBMIT only)
const PDU_VPF_ENHANCED = 0x8; // Validity period enhance format
                              // (SMS-SUBMIT only)
const PDU_MMS_RD       = 0x04;// More messages to send. (SMS-DELIVER only) or
                              // Reject duplicates (SMS-SUBMIT only)

/* MTI - Message Type Indicator */
const PDU_MTI_SMS_STATUS_COMMAND  = 0x02;
const PDU_MTI_SMS_SUBMIT          = 0x01;
const PDU_MTI_SMS_DELIVER         = 0x00;

/* User Data max length in octets*/
const MAX_LENGTH_7BIT = 160;

/* DCS - Data Coding Scheme */
const PDU_DCS_MSG_CODING_7BITS_ALPHABET = 0xF0;
const PDU_DCS_MSG_CODING_8BITS_ALPHABET = 0xF4;
const PDU_DCS_MSG_CODING_16BITS_ALPHABET= 0x08;
const PDU_DCS_MSG_CLASS_ME_SPECIFIC     = 0xF1;
const PDU_DCS_MSG_CLASS_SIM_SPECIFIC    = 0xF2;
const PDU_DCS_MSG_CLASS_TE_SPECIFIC     = 0xF3;

/* 7bit Default Alphabet: http://dreamfabric.com/sms/default_alphabet.html */
const alphabet_7bit = [
  "@",      // COMMERCIAL AT
  "\xa3",   // POUND SIGN
  "$",      // DOLLAR SIGN
  "\xa5",   // YEN SIGN
  "\xe8",   // LATIN SMALL LETTER E WITH GRAVE
  "\xe9",   // LATIN SMALL LETTER E WITH ACUTE
  "\xf9",   // LATIN SMALL LETTER U WITH GRAVE
  "\xec",   // LATIN SMALL LETTER I WITH GRAVE
  "\xf2",   // LATIN SMALL LETTER O WITH GRAVE
  "\xc7",   // LATIN CAPITAL LETTER C WITH CEDILLA
  "\n",     // LINE FEED
  "\xd8",   // LATIN CAPITAL LETTER O WITH STROKE
  "\xf8",   // LATIN SMALL LETTER O WITH STROKE
  "\r",     // CARRIAGE RETURN
  "\xc5",   // LATIN CAPITAL LETTER A WITH RING ABOVE
  "\xe5",   // LATIN SMALL LETTER A WITH RING ABOVE
  "\u0394", // GREEK CAPITAL LETTER DELTA
  "_",      // LOW LINE
  "\u03a6", // GREEK CAPITAL LETTER PHI
  "\u0393", // GREEK CAPITAL LETTER GAMMA
  "\u039b", // GREEK CAPITAL LETTER LAMBDA
  "\u03a9", // GREEK CAPITAL LETTER OMEGA
  "\u03a0", // GREEK CAPITAL LETTER PI
  "\u03a8", // GREEK CAPITAL LETTER PSI
  "\u03a3", // GREEK CAPITAL LETTER SIGMA
  "\u0398", // GREEK CAPITAL LETTER THETA
  "\u039e", // GREEK CAPITAL LETTER XI
  "\u20ac", // (escape to extension table)
  "\xc6",   // LATIN CAPITAL LETTER AE
  "\xe6",   // LATIN SMALL LETTER AE
  "\xdf",   // LATIN SMALL LETTER SHARP S (German)
  "\xc9",   // LATIN CAPITAL LETTER E WITH ACUTE
  " ",      // SPACE
  "!",      // EXCLAMATION MARK
  "\"",     // QUOTATION MARK
  "#",      // NUMBER SIGN
  "\xa4",   // CURRENCY SIGN
  "%",      // PERCENT SIGN
  "&",      // AMPERSAND
  "'",      // APOSTROPHE
  "(",      // LEFT PARENTHESIS
  ")",      // RIGHT PARENTHESIS
  "*",      // ASTERISK
  "+",      // PLUS SIGN
  ",",      // COMMA
  "-",      // HYPHEN-MINUS
  ".",      // FULL STOP
  "/",      // SOLIDUS (SLASH)
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  ":",      // COLON
  ";",      // SEMICOLON
  "<",      // LESS-THAN SIGN
  "=",      // EQUALS SIGN
  ">",      // GREATER-THAN SIGN
  "?",      // QUESTION MARK
  "\xa1",   // INVERTED EXCLAMATION MARK
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
  "\xc4",   // LATIN CAPITAL LETTER A WITH DIAERESIS
  "\xd6",   // LATIN CAPITAL LETTER O WITH DIAERESIS
  "\xd1",   // LATIN CAPITAL LETTER N WITH TILDE
  "\xdc",   // LATIN CAPITAL LETTER U WITH DIAERESIS
  "\xa7",   // SECTION SIGN
  "\xbf",   // INVERTED QUESTION MARK
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
  "\xe4",   // LATIN SMALL LETTER A WITH DIAERESIS
  "\xf6",   // LATIN SMALL LETTER O WITH DIAERESIS
  "\xf1",   // LATIN SMALL LETTER N WITH TILDE
  "\xfc",   // LATIN SMALL LETTER U WITH DIAERESIS
  "\xe0"    // LATIN SMALL LETTER A WITH GRAVE
];

/**
 * This object exposes the functionality to parse and serialize PDU strings
 *
 * The PDU string contains not only the message, but also a lot of
 * meta-information about the sender, his SMS service center, the time stamp
 * etc. It is all in the form of hexa-decimal octets or decimal semi-octets.
 *
 * A detailed description of the PDU Format can be found at
 * http://www.dreamfabric.com/sms/
 */
let PDU = new function () {

  function semiOctetToString(semiOctet) {
    let out = "";
    for (let i = 0; i < semiOctet.length; i += 2) {
      let tmp = semiOctet.substring(i, i+2);
      out += tmp.charAt(1) + tmp.charAt(0);
    }
    return out;
  }

  function getOctet(n) {
    if (n == undefined) {
      n = 1;
    };
    return mPdu.substring(mCurrent, mCurrent += n*2);
  }

  /**
   * User data can be 7 bit (default alphabet) data, 8 bit data, or 16 bit
   * (UCS2) data.This function currently supports only the default alphabet.
   */
  function getUserData(udOctet, dataCodingScheme) {
    let userData = "";
    // Get encoding scheme according to http://www.dreamfabric.com/sms/dcs.html
    let encoding = 7; // 7 bit is the default encoding
    let dataCodingSchemeHex = parseInt(dataCodingScheme, 16);
    switch (dataCodingSchemeHex & 0xC0) {
      case 0x0:
        // bits 7..4 = 00xx
        switch (dataCodingSchemeHex & 0xC) {
          case 0x4:
            encoding = 8;
            break;
          case 0x8:
            encoding = 16;
            break;
        }
        break;
      case 0xC0:
        // bits 7..4 = 11xx
        switch (dataCodingSchemeHex & 0x30) {
          case 0x20:
            encoding = 16;
            break;
          case 0x30:
            if (!dataCodingScheme & 0x4) {
              encoding = 8;
            }
            break;
        }
        break;
      default:
        // Falling back to default encoding.
        break;
    }

    if (DEBUG) debug("PDU: message encoding is " + encoding + " bit.");
    switch (encoding) {
      case 7:
        // 7 bit encoding allows 140 octets, which means 160 characters
        // ((140x8) / 7 = 160 chars)
        if (udOctet.length > MAX_LENGTH_7BIT) {
          debug("PDU error: user data is too long: " + udOctet.length);
          return null;
        }
        let udOctetsArray = [];
        let udRestArray = [];
        let udSeptetsArray = [];
        let index = 1;
        for (let i = 0; i < udOctet.length; i += 2) {
          // Split into binary octets, septets and rest bits
          // XXX: could probably be done faster with split + regex
          let udBinOctet = ("00000000" + (parseInt(udOctet.substring(i, i + 2), 16).
                            toString(2))).slice(-8);
          udOctetsArray.push(udBinOctet);
          udRestArray.push(udBinOctet.substring(0, (index % 8)));
          udSeptetsArray.push(udBinOctet.substring((index % 8), 8));
          if (index == 7) {
            index = 1;
          } else {
            index += 1;
          }
        }
        for (let i = 0; i < udRestArray.length; i++) {
          // Parse septets + rest
          if (i % 7 == 0) {
            if (i != 0) {
              userData += alphabet_7bit[parseInt(udRestArray[i - 1], 2)];
            }
            userData += alphabet_7bit[parseInt(udSeptetsArray[i], 2)];
          } else {
            userData += alphabet_7bit[parseInt(udSeptetsArray[i] + udRestArray[i - 1], 2)];
          }
        }
        break;
      case 8:
        //TODO
        return null;
        break;
      case 16:
        //TODO
        return null;
        break;
    }
    return userData;
  }

  function serializeAddress(address, smsc) {
    if(address == undefined) {
      return "00";
    }
    // International format
    let addressFormat;
    if (address[0] == '+') {
      addressFormat = PDU_TOA_INTERNATIONAL | PDU_TOA_ISDN; // 91
      address = address.substring(1);
    } else {
      addressFormat = PDU_TOA_ISDN; // 81
    }
    // Add a trailing 'F'
    if (address.length % 2 == 0) {
      address += 'F';
    }
    // Convert into string
    let address = semiOctetToString(address);
    let addressLength = ("00" + parseInt((addressFormat.toString(16) + "" + address).length / 2)).slice(-2);
    return addressLength + "" + addressFormat.toString(16) + "" + address;
  }

  function charTo7BitCode(c) {
    for (let i = 0; i < alphabet_7bit.length; i++) {
      if (alphabet_7bit[i] == c) {
        return i;
      }
    }
    debug("PDU warning: No character found in default 7 bit alphabet for " + c);
    return null;
  }

  let mCurrent = 0;
  let mPdu = "";

  // Given a PDU string, this function returns a PDU object containing the
  // SMSC, sender, message and timestamp or validity period
  // TODO: return error codes instead of false
  this.parse = function (pdu) {
    mPdu = pdu;
    // Get rid of blank spaces
    mPdu = mPdu.split(' ').join('');
    // Allow only hexadecimal
    if (mPdu.search(/[^a-fA-F0-9]/) != -1) {
      debug("PDU error: invalid characters in PDU message: " + mPdu);
      return null;
    }
    mCurrent = 0;
    // SMSC info
    let smscLength = parseInt(getOctet(), 16);
    let smscNumber;
    if (smscLength > 0) {
      let smscTypeOfAddress = getOctet();
      smscNumber = semiOctetToString(getOctet(((smscLength) - 1)));
      if ((parseInt(smscTypeOfAddress, 16) >> 4) == (PDU_TOA_INTERNATIONAL >> 4)) {
        smscNumber = '+' + smscNumber;
      }
      if (smscNumber.charAt(smscNumber.length - 1) == 'F') {
        smscNumber = smscNumber.slice(0,-1);
      }
    }

    // First octet of this SMS-DELIVER or SMS-SUBMIT message
    let firstOctet = getOctet();
    // if the sms is of SMS-SUBMIT type it would contain a TP-MR
    let isSmsSubmit = firstOctet & PDU_MTI_SMS_SUBMIT;
    let messageReference;
    if (isSmsSubmit) {
      messageReference = getOctet(); // TP-Message-Reference
    }

    // - Sender Address info -
    // Address length
    let senderAddressLength = parseInt(getOctet(), 16);
    if (senderAddressLength <= 0) {
      debug("PDU error: invalid sender address length: " + senderAddressLength);
      return null;
    }
    // Type-of-Address
    let senderTypeOfAddress = getOctet();
    if (senderAddressLength % 2 == 1) {
      senderAddressLength += 1;
    }
    let senderNumber = semiOctetToString(getOctet((senderAddressLength / 2)));
    if (senderNumber.length <= 0) {
      debug("PDU error: no sender number provided");
      return null;
    }
    if ((parseInt(senderTypeOfAddress, 16) >> 4) == (PDU_TOA_INTERNATIONAL >> 4)) {
      senderNumber = '+' + senderNumber;
    }
    if (senderNumber.charAt(senderNumber.length -1) == 'F') {
      senderNumber = senderNumber.slice(0, -1);
    }

    // - TP-Protocolo-Identifier -
    let protocolIdentifier = getOctet();

    // - TP-Data-Coding-Scheme -
    let dataCodingScheme = getOctet();

    // SMS of SMS-SUBMIT type contains a TP-Service-Center-Time-Stamp field
    // SMS of SMS-DELIVER type contains a TP-Validity-Period octet
    let validityPeriod;
    if (isSmsSubmit) {
      //  - TP-Validity-Period -
      //  The Validity Period octet is optional. Depends on the SMS-SUBMIT
      //  first octet
      //  Validity Period Format. Bit4 and Bit3 specify the TP-VP field
      //  according to this table:
      //  bit4 bit3
      //    0   0 : TP-VP field not present
      //    1   0 : TP-VP field present. Relative format (one octet)
      //    0   1 : TP-VP field present. Enhanced format (7 octets)
      //    1   1 : TP-VP field present. Absolute format (7 octets)
      if (firstOctet & (PDU_VPF_ABSOLUTE | PDU_VPF_RELATIVE | PDU_VPF_ENHANCED)) {
        validityPeriod = getOctet();
      }
      //TODO: check validity period
    } else {
      // - TP-Service-Center-Time-Stamp -
      let scTimeStamp = semiOctetToString(getOctet(7));
      var scTimeStampString = scTimeStamp.substring(4,6) + "/" +
                              scTimeStamp.substring(2,4) + "/" +
                              scTimeStamp.substring(0,2) + " " +
                              scTimeStamp.substring(6,8) + ":" +
                              scTimeStamp.substring(8,10) + ":" +
                              scTimeStamp.substring(10,12);
    }

    // - TP-User-Data-Length -
    let userDataLength = parseInt(getOctet(), 16);

    // - TP-User-Data -
    if (userDataLength > 0) {
      let userDataOctet = getOctet(userDataLength);
      // Get the user message
      var userDataString = getUserData(userDataOctet, dataCodingScheme);
      if (userDataString == null) {
        debug("PDU error: Not supported encoding ");
        return null;
      }
    }

    let ret = {
      SMSC: smscNumber,
      sender: senderNumber,
      message: userDataString
    };

    if (isSmsSubmit) {
      ret.validity = validityPeriod;
    } else {
      ret.timestamp = scTimeStampString;
    }
    return ret;
  }; //this.parse

  // Get a SMS-SUBMIT PDU for a destination address and a message using the
  // specified encoding.
  this.getSubmitPdu = function(scAddress,
                              destinationAddress,
                              message,
                              validity,
                              messageClass,
                              encoding) {
    // - SMSC -
    let smsc;
    if (scAddress != 0) {
      smsc = serializeAddress(scAddress);
    } else {
      scAddress = "00";
    }

    // - PDU-TYPE and MR-
    let firstOctetAndMR;
    if (validity) {
      firstOctetAndMR = "0100";
    } else {
      firstOctetAndMR = "1100";
    }

    // - Destination Address -
    if (destinationAddress == undefined) {
      debug("PDU error: no destination address provided");
      return null;
    }
    let smsReceiver = serializeAddress(destinationAddress);

    // - Protocol Identifier -
    let protocolID = "00";

    // - Data coding scheme -
    // For now it assumes bits 7..4 = 1111 except for the 16 bits use case
    let dcs = 0x00;
    switch (messageClass) {
      case 1:
        // Message class 1 - ME Specific
        dcs |= PDU_DCS_MSG_CLASS_ME_SPECIFIC;
        break;
      case 2:
        // Message class 2 - SIM Specific
        dcs |= PDU_DCS_MSG_CLASS_SIM_SPECIFIC;
        break;
      case 3:
        // Message class 3 - TE Specific
        dcs |= PDU_DCS_MSG_CLASS_TE_SPECIFIC;
        break;
    }
    switch (encoding) {
      case 7:
        dcs |= PDU_DCS_MSG_CODING_7BITS_ALPHABET;
        break;
      case 8:
        dcs |= PDU_DCS_MSG_CODING_8BITS_ALPHABET;
        break;
      case 16:
        dcs |= PDU_DCS_MSG_CODING_16BITS_ALPHABET;
        break;
    }

    // - Validity Period -
    // TODO: Not supported for the moment

    // - User Data Length -
    // Phones allows empty sms
    if (message == undefined) {
      debug("PDU warning: message is empty");
    }
    let userDataLength = message.length.toString(16);

    // - User Data -
    let userData = "";
    switch(encoding) {
      case 7:
        let octet = "";
        let octetst = "";
        let octetnd = "";
        for (let i = 0; i < message.length; i++) {
          if (i == message.length) {
            if (octetnd.length) {
              userData = userData + parseInt(octetnd, 2).toString(16);
            }
          }
          let charcode = charTo7BitCode(message.charAt(i)).toString(2);
          octet = ("00000000" + charcode).slice(-7);
          if (i != 0 && i % 8 != 0) {
            octetst = octet.substring(7 - (i) % 8);
            userData = userData + parseInt((octetst + octetnd), 2).toString(16).toUpperCase();
          }
          octetnd = octet.substring(0, 7 - (i) % 8);
        }
        break;
      case 8:
        //TODO:
        break;
      case 16:
        //TODO:
        break;
    }

    return smsc + "" +
          firstOctetAndMR + "" +
          smsReceiver + "" +
          protocolID + "" +
          dcs + "" +
          userDataLength + "" +
          userData;
  };

};
