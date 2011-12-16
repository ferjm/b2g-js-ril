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

// Because service center timestamp omit the century. Yay.
const PDU_TIMESTAMP_YEAR_OFFSET = 2000;

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

  /**
   * Semi octets are decimal. Each pairs of digits needs to be swapped.
   *
   * TODO can we get rid of this? only needed by serialization at this point
   */
  function semiOctetToString(semiOctet) {
    let out = "";
    for (let i = 0; i < semiOctet.length; i += 2) {
      out += semiOctet.charAt(i + 1) + semiOctet.charAt(i);
    }
    return out;
  }

  /**
   * Read a single hex-encoded octet from the PDU.
   */
  function readOctet() {
    if (mCurrent >= mPdu.length) {
      if (DEBUG) debug("Ran out of data.");
      return null;
    }
    let octet = parseInt(mPdu[mCurrent], 16) << 4 |
                parseInt(mPdu[mCurrent + 1], 16);
    mCurrent += 2;
    return octet;
  }

  /**
   * Read a *swapped nibble* binary coded decimal (BCD)
   *
   * @param length
   *        Number of nibble *pairs* to read.
   */
  function readBCD(length) {
    let number = 0;
    for (let i = 0; i < length; i++) {
      let octet = readOctet();
      // If the first nibble is an "F" , only the second nibble is to be taken
      // into account.
      if ((octet & 0xf0) == 0xf0) {
        number *= 10;
        number += octet & 0x0f;
        continue;
      }
      number *= 100;
      number += octetToBCD(octet);
    }
    return number;
  }

  /**
   * Convert an octet (number) to a BCD number.
   *
   * Any nibbles that are not in the BCD range count as 0.
   *
   * @param octet
   *        The octet (a number, as returned by getOctet())
   *
   * @return the corresponding BCD number.
   */
  function octetToBCD(octet) {
    return ((octet & 0xf0) <= 0x90) * ((octet >> 4) & 0x0f) +
           ((octet & 0x0f) <= 0x09) * (octet & 0x0f) * 10;
  }

  /**
   * Read data and convert to septets.
   *
   * @param length
   *        Number of septets to read (*not* octets)
   *
   * TODO rewrite this helper
   */
  function readSeptets(length) {
    let byteLength = Math.ceil(length * 7 / 8);
    let userData = "";
    let udOctetsArray = [];
    let udRestArray = [];
    let udSeptetsArray = [];
    let index = 1;
    for (let i = 0; i < byteLength; i++) {
      let octet = readOctet();
      // Split into binary octets, septets and rest bits
      let udBinOctet = ("00000000" + octet.toString(2)).slice(-8);
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
    return userData;
  }

  /**
   * User data can be 7 bit (default alphabet) data, 8 bit data, or 16 bit
   * (UCS2) data.
   * 
   * TODO: This function currently supports only the default alphabet.
   */
  function readUserData(length, codingScheme) {
    if (DEBUG) {
      debug("Reading " + length + " bytes of user data.");
      debug("Coding scheme: " + codingScheme);
    }
    // Get encoding scheme according to http://www.dreamfabric.com/sms/dcs.html
    let encoding = 7; // 7 bit is the default encoding
    switch (codingScheme & 0xC0) {
      case 0x0:
        // bits 7..4 = 00xx
        switch (codingScheme & 0xC) {
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
        switch (codingScheme & 0x30) {
          case 0x20:
            encoding = 16;
            break;
          case 0x30:
            if (!codingScheme & 0x4) {
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
        if (length > MAX_LENGTH_7BIT) {
          if (DEBUG) debug("PDU error: user data is too long: " + length);
          return null;
        }
        return readSeptets(length);
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
  }

  function serializeAddress(address, smsc) {
    if (address == undefined) {
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
    let addressLength = address.length;
    if (addressLength % 2 != 0) {
      address += 'F';
    }
    // Convert into string
    let address = semiOctetToString(address);
    // Not sure why, but the addressLength is handled in a different way
    // if it is an smsc address
    if (smsc) {
      addressLength = ("00" + parseInt((addressFormat.toString(16) + "" + address).length / 2)).slice(-2);
    } else {
      addressLength = ("00" + addressLength.toString(16)).slice(-2).toUpperCase();
    }
    return addressLength + "" + addressFormat.toString(16) + "" + address;
  }

  function charTo7BitCode(c) {
    for (let i = 0; i < alphabet_7bit.length; i++) {
      if (alphabet_7bit[i] == c) {
        return i;
      }
    }
    if (DEBUG) debug("PDU warning: No character found in default 7 bit alphabet for " + c);
    return null;
  }

  let mCurrent = 0;
  let mPdu = "";

  /**
  * Public API
  */

  /**
  * Given a PDU string, this function returns a PDU object containing the
  * SMSC, sender, message and timestamp or validity period
  * TODO: return error codes instead of false
  */
  this.parse = function (pdu) {
    mPdu = pdu;
    mCurrent = 0;

    // Allow only hexadecimal
    //TODO replace this with in-place checks when reading data
    if (mPdu.search(/[^a-fA-F0-9]/) != -1) {
      if (DEBUG) debug("PDU error: invalid characters in PDU message: " + mPdu);
      return null;
    }

    let ret = {
      SMSC:      null,
      sender:    null,
      message:   null,
      validity:  null,
      timestamp: null
    };

    // SMSC info
    let smscLength = readOctet();
    if (smscLength > 0) {
      let smscTypeOfAddress = readOctet();
      // Subtract the type-of-address octet we just read from the length.
      ret.SMSC = readBCD(smscLength - 1).toString();
      if ((smscTypeOfAddress >> 4) == (PDU_TOA_INTERNATIONAL >> 4)) {
        ret.SMSC = '+' + ret.SMSC;
      }
    }

    // First octet of this SMS-DELIVER or SMS-SUBMIT message
    let firstOctet = readOctet();
    // if the sms is of SMS-SUBMIT type it would contain a TP-MR
    let isSmsSubmit = firstOctet & PDU_MTI_SMS_SUBMIT;
    let messageReference;
    if (isSmsSubmit) {
      messageReference = readOctet(); // TP-Message-Reference
    }

    // - Sender Address info -
    // Address length
    let senderAddressLength = readOctet();
    if (senderAddressLength <= 0) {
      if (DEBUG) debug("PDU error: invalid sender address length: " + senderAddressLength);
      return null;
    }
    // Type-of-Address
    let senderTypeOfAddress = readOctet();
    if (senderAddressLength % 2 == 1) {
      senderAddressLength += 1;
    }
    ret.sender = readBCD(senderAddressLength / 2).toString();
    if (ret.sender.length <= 0) {
      if (DEBUG) debug("PDU error: no sender number provided");
      return null;
    }
    if ((senderTypeOfAddress >> 4) == (PDU_TOA_INTERNATIONAL >> 4)) {
      ret.sender = '+' + ret.sender;
    }

    // - TP-Protocolo-Identifier -
    let protocolIdentifier = readOctet();

    // - TP-Data-Coding-Scheme -
    let dataCodingScheme = readOctet();

    // SMS of SMS-SUBMIT type contains a TP-Service-Center-Time-Stamp field
    // SMS of SMS-DELIVER type contains a TP-Validity-Period octet
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
        ret.validity = readOctet();
      }
      //TODO: check validity period
    } else {
      // - TP-Service-Center-Time-Stamp -
      let year   = readBCD(1) + PDU_TIMESTAMP_YEAR_OFFSET;
      let month  = readBCD(1) - 1;
      let day    = readBCD(1) - 1;
      let hour   = readBCD(1) - 1;
      let minute = readBCD(1) - 1;
      let second = readBCD(1) - 1;
      ret.timestamp = Date.UTC(year, month, day, hour, minute, second);

      // If the most significant bit of the least significant nibble is 1,
      // the timezone offset is negative (fourth bit from the right => 0x08).
      let tzOctet = readOctet();
      let tzOffset = octetToBCD(tzOctet & ~0x08) * 15 * 60 * 1000;
      if (tzOctet & 0x08) {
        ret.timestamp -= tzOffset;
      } else {
        ret.timestamp += tzOffset;
      }
    }

    // - TP-User-Data-Length -
    let userDataLength = readOctet();

    // - TP-User-Data -
    if (userDataLength > 0) {
      ret.message = readUserData(userDataLength, dataCodingScheme);
    }

    return ret;
  };

  /**
  *   Get a SMS-SUBMIT PDU for a destination address and a message using the
  *   specified encoding.
  *
  *   @param scAddress
  *          String containing the address (number) of the SMS Service Center
  *   @param destinationAddress
  *          String containing the address (number) of the SMS receiver
  *   @param message
  *          String containing the message to be sent as user data
  *   @param validity
  *          TBD
  *   @param udhi
  *          User Data Header information
  *
  *   SMS-SUBMIT Format
  *   -----------------
  *
  *   SMSCA - Service Center Address - 1 to 10 octets
  *   PDU Type & Message Reference - 1 octet
  *   DA - Destination Address - 2 to 12 octets
  *   PID - Protocol Identifier - 1 octet
  *   DCS - Data Coding Scheme - 1 octet
  *   VP - Validity Period - 0, 1 or 7 octets
  *   UDL - User Data Length - 1 octet
  *   UD - User Data - 140 octets
  */
  this.getSubmitPdu = function(scAddress,
                              destinationAddress,
                              message,
                              encoding,
                              validity,
                              udhi) {
    // - SMSCA -
    let smsca;
    if (scAddress != 0) {
      smsca = serializeAddress(scAddress, true);
    } else {
      scAddress = "00";
    }

    // - PDU-TYPE and MR-

    // +--------+----------+---------+---------+--------+---------+
    // | RP (1) | UDHI (1) | SRR (1) | VPF (2) | RD (1) | MTI (2) |
    // +--------+----------+---------+---------+--------+---------+
    // RP:    0   Reply path parameter is not set
    //        1   Reply path parameter is set
    // UDHI:  0   The UD Field contains only the short message
    //        1   The beginning of the UD field contains a header in adittion
    //            of the short message
    // SRR:   0   A status report is not requested
    //        1   A status report is requested
    // VPF:   bit4  bit3
    //        0     0     VP field is not present
    //        0     1     Reserved
    //        1     0     VP field present an integer represented (relative)
    //        1     1     VP field present a semi-octet represented (absolute)
    // RD:        Instruct the SMSC to accept(0) or reject(1) an SMS-SUBMIT
    //            for a short message still held in the SMSC which has the same
    //            MR and DA as a previously submitted short message from the
    //            same OA
    // MTI:   bit1  bit0    Message Type
    //        0     0       SMS-DELIVER (SMSC ==> MS)
    //        0     1       SMS-SUBMIT (MS ==> SMSC)

    // PDU type. MTI is set to SMS-SUBMIT
    let firstOctetAndMR = 1;
    // Validity period
    if (validity) {
      firstOctetAndMR |= 0x10;
    }
    if (udhi) {
      firstOctetAndMR |= 0x40;
    }
    // Message reference
    firstOctetAndMR += "00";

    // - Destination Address -
    if (destinationAddress == undefined) {
      if (DEBUG) debug("PDU error: no destination address provided");
      return null;
    }
    let smsReceiver = serializeAddress(destinationAddress);

    // - Protocol Identifier -
    let protocolID = "00";

    // - Data coding scheme -
    // For now it assumes bits 7..4 = 1111 except for the 16 bits use case
    let dcs = 0;
    switch (encoding) {
      case 8:
        dcs |= PDU_DCS_MSG_CODING_8BITS_ALPHABET;
        break;
      case 16:
        dcs |= PDU_DCS_MSG_CODING_16BITS_ALPHABET;
        break;
    }
    dcs = ("00" + dcs.toString(16).toUpperCase()).slice(-2);

    // - Validity Period -
    // TODO: Encode Validity Period. Not supported for the moment

    // - User Data Length -
    // Phones allows empty sms
    if (message == undefined) {
      if (DEBUG) debug("PDU warning: message is empty");
    }
    let userDataLength = ("00" + message.length.toString(16)).slice(-2).toUpperCase();

    // - User Data -
    let userData = "";
    switch(encoding) {
      case 7:
        let octet = "";
        let octetst = "";
        let octetnd = "";
        for (let i = 0; i <= message.length; i++) {
          if (i == message.length) {
            if (octetnd.length) {
              userData = userData + ("00" + parseInt(octetnd, 2).toString(16)).slice(-2);
            }
            break;
          }
          let charcode = charTo7BitCode(message.charAt(i)).toString(2);
          octet = ("00000000" + charcode).slice(-7);
          if (i != 0 && i % 8 != 0) {
            octetst = octet.substring(7 - (i) % 8);
            userData = userData + parseInt((octetst + octetnd), 2).toString(16);
          }
          octetnd = octet.substring(0, 7 - (i) % 8);
        }
        userData = userData.toUpperCase();
        break;
      case 8:
        //TODO:
        break;
      case 16:
        //TODO:
        break;
    }

    return smsca + "" +
          firstOctetAndMR + "" +
          smsReceiver + "" +
          protocolID + "" +
          dcs + "" +
          userDataLength + "" +
          userData;
  };

};
