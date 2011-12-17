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


let PDU = {

  /**
   * Serializing
   */

  /**
   * Semi octets are decimal. Each pairs of digits needs to be swapped.
   *
   * TODO can we get rid of this? only needed by serialization at this point
   */
  stringToBCDString: function stringToBCDString(semiOctet) {
    let out = "";
    for (let i = 0; i < semiOctet.length; i += 2) {
      out += semiOctet.charAt(i + 1) + semiOctet.charAt(i);
    }
    return out;
  },

  serializeAddress: function serializeAddress(address, smsc) {
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
    let address = this.stringToBCDString(address);
    // Not sure why, but the addressLength is handled in a different way
    // if it is an smsc address
    if (smsc) {
      addressLength = ("00" + parseInt((addressFormat.toString(16) + "" + address).length / 2)).slice(-2);
    } else {
      addressLength = ("00" + addressLength.toString(16)).slice(-2).toUpperCase();
    }
    return addressLength + "" + addressFormat.toString(16) + "" + address;
  },

  charTo7BitCode: function charTo7BitCode(c) {
    for (let i = 0; i < alphabet_7bit.length; i++) {
      if (alphabet_7bit[i] == c) {
        return i;
      }
    }
    if (DEBUG) debug("PDU warning: No character found in default 7 bit alphabet for " + c);
    return null;
  },


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
  *   @return and object with the SMSC address and the message PDU
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
  writeMessage: function writeMessage(scAddress,
                                      destinationAddress,
                                      message,
                                      encoding,
                                      validity,
                                      udhi) {
    // Empty message object. It gets filled bellow with the Short Message
    // Service Center address in PDU format (if available) and with the
    // message PDU and then returned.
    let sms = {
      SMSC: null,
      msg:  null
    };

    // - SMSCA -
    if (scAddress != 0) {
      sms.SMSC = this.serializeAddress(scAddress, true);
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
    {
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
      sms.msg = ("0000" + firstOctetAndMR).slice(-4);
    }
    // - Destination Address -
    if (destinationAddress == undefined) {
      if (DEBUG) debug("PDU error: no destination address provided");
      return null;
    }
    sms.msg += this.serializeAddress(destinationAddress);

    // - Protocol Identifier -
    sms.msg += "00";

    // - Data coding scheme -
    // For now it assumes bits 7..4 = 1111 except for the 16 bits use case
    {
      let dcs = 0;
      switch (encoding) {
        case 8:
          dcs |= PDU_DCS_MSG_CODING_8BITS_ALPHABET;
          break;
        case 16:
          dcs |= PDU_DCS_MSG_CODING_16BITS_ALPHABET;
          break;
      }
      dcs = ("00" + dcs.toString(16)).slice(-2);
      sms.msg += dcs;
    }

    // - Validity Period -
    // TODO: Encode Validity Period. Not supported for the moment

    // - User Data Length -
    // Phones allow empty sms
    if (message == undefined) {
      if (DEBUG) debug("PDU warning: message is empty");
    }
    sms.msg += ("00" + message.length.toString(16)).slice(-2);

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
              sms.msg = sms.msg + ("00" + parseInt(octetnd, 2).toString(16)).slice(-2);
            }
            break;
          }
          let charcode = this.charTo7BitCode(message.charAt(i)).toString(2);
          octet = ("00000000" + charcode).slice(-7);
          if (i != 0 && i % 8 != 0) {
            octetst = octet.substring(7 - (i) % 8);
            sms.msg = sms.msg + parseInt((octetst + octetnd), 2).toString(16);
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
    sms.msg = sms.msg.toUpperCase();
    return sms;
  }

};
