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

/* 7bit Default Alphabet: http://dreamfabric.com/sms/default_alphabet.html */
let alph7bit = new Array('@', '£', '$', '¥', 'è', 'é', 'ù', 'ì', 'ò', 'Ç', 
                        '\n', 'Ø', 'ø', '\r','Å', 'å','\u0394', '_', 
                        '\u03a6', '\u0393', '\u039b', '\u03a9', '\u03a0',
                        '\u03a8', '\u03a3', '\u0398', '\u039e','€', 'Æ',
                        'æ', 'ß', 'É', ' ', '!', '"', '#', '¤', '%', '&',
                        '\'', '(', ')','*', '+', ',', '-', '.', '/', '0',
                        '1', '2', '3', '4', '5', '6', '7','8', '9', ':',
                        ';', '<', '=', '>', '?', '¡', 'A', 'B', 'C', 'D',
                        'E','F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 
                        'O', 'P', 'Q', 'R', 'S','T', 'U', 'V', 'W', 'X', 
                        'Y', 'Z', 'Ä', 'Ö', 'Ñ', 'Ü', '§', '¿', 'a','b', 
                        'c','d', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 
                        'm', 'n', 'o','p', 'q', 'r', 's', 't', 'u', 'v', 
                        'w', 'x', 'y', 'z', 'ä', 'ö', 'ñ','ü', 'à');
                                    
/**
 * This object exposes the functionality to parse and serialize PDU strings
 *
 * The PDU string contains not only the message, but also a lot of 
 * meta-information  about the sender, his SMS service center, the time stamp
 * etc. It is all in the form of hexa-decimal octets or decimal semi-octets.
 *
 * A detailed description of the PDU Format can be found at 
 * http://www.dreamfabric.com/sms/
 */ 
let PDU =  new function () {
  
  function phoneNumberMap (character) {
    if((character >= '0') && (character <= '9')) return character;
    switch(character.toUpperCase()) {
      case '*': return 'A';
      case '#': return 'B';
      case 'A': return 'C';
      case 'B': return 'D';
      case 'C': return 'E';
      default: return 'F';
    }
  }
  
  function semiOctetToString (semiOctet) {
    let out = "";
    for(let i = 0; i < semiOctet.length; i+=2) {
      let tmp = semiOctet.substring(i, i+2);
      out += phoneNumberMap(tmp.charAt(1)) + phoneNumberMap(tmp.charAt(0));
    }
    return out;
  }
  
  function getOctet (n) {
    if(typeof n == "undefined") n = 1;
    return mPdu.substring(mCurrent, mCurrent += n*2);
  }

  function parseHex (hex) {
    return parseInt("0x" + hex, 16);
  }

  function fillOctet (octet) {
    while (octet.length < 8) octet = "0" + octet;
    return octet;
  }

  // User data can be 7 bit (default alphabet) data, 8 bit data, or 16 bit 
  // (UCS2) data.This function currently supports only the default alphabet.
  // TODO: Add support for 8bit and 16bit data
  function getUserData(udOctet, dataCodingScheme) {
    let userData = "";
    // Get encoding scheme according to http://www.dreamfabric.com/sms/dcs.html    
    let encoding = 7; // 7 bit is the default encoding
    let dataCodingSchemeHex;    
    switch((dataCodingSchemeHex = parseHex(dataCodingScheme)) & 0xC0) {      
      case 0x0:
        // bits 7..4 = 00xx
        switch(dataCodingSchemeHex & 0xC) {          
          case 0x4: encoding = 8; break;
          case 0x8: encoding = 16; break;
        }
        break;
      case 0xC0:
        // bits 7..4 = 11xx
        switch(dataCodingSchemeHex & 0x30) {
          case 0x20: encoding = 16; break;
          case 0x30: 
            if(!dataCodingScheme & 0x4) encoding = 8;
            break;                                   
        }
        break;
    }    
    
    switch(encoding) {      
      case 7:
        // 7 bit encoding allows 140 octets, which means 160 characters 
        // ((140x8) / 7 = 160 chars)
        if(udOctet.length <= MAX_LENGTH_7BIT) {                 
          let udOctetsArray = new Array();
          let udRestArray = new Array();
          let udSeptetsArray = new Array();
          let index = 1;
          for(let i = 0; i < udOctet.length; i += 2) {
            // Split into binary octets, septets and rest bits
            // XXX: could probably be done faster with split + regex
            let udBinOctet = fillOctet(parseHex(udOctet.substring(i, i + 2)).toString(2));
            udOctetsArray.push(udBinOctet);           
            udRestArray.push(udBinOctet.substring(0, (index % 8)));           
            udSeptetsArray.push(udBinOctet.substring((index % 8), 8));
            if(index == 7) index = 1; else index += 1;            
          }
          for(let i = 0; i < udRestArray.length; i++) {
            // Parse septets + rest
            if(i % 7 == 0) {
              if(i != 0) userData += alph7bit[parseInt(udRestArray[i - 1], 2)];              
              userData += alph7bit[parseInt(udSeptetsArray[i], 2)]; 
            } else {
              userData += alph7bit[parseInt(udSeptetsArray[i] + udRestArray[i - 1], 2)]; 
            }
          } 
        } else return false;
        break;
    }
    return userData;
  }
  
  var mCurrent = 0;
  var mPdu = "";
  
  // Given a PDU string, this function returns a PDU object containing the 
  // SMSC, sender, message and timestamp or validity period 
  // TODO: return error codes instead of false  
  this.parse = function (pdu) {
    if(typeof(pdu) != "string") return false; 
    mPdu = pdu;
    // Get rid of blank spaces
    mPdu = mPdu.split(' ').join('');
    // Allow only hexadecimal
    if(mPdu.split("[a-fA-F0-9]").length > 1) return false;
    // SMSC info
    {
      let smscLength;
      if((smscLength = parseHex(getOctet())) > 0) {          
          let smscTypeOfAddress = getOctet();
          var smscNumber = semiOctetToString(getOctet(((smscLength) - 1)));
          if((parseHex(smscTypeOfAddress) >> 4) == (PDU_TOA_INTERNATIONAL >> 4)) 
            smscNumber = '+' + smscNumber;
          if(smscNumber.charAt(smscNumber.length - 1) == 'F') 
            smscNumber = smscNumber.slice(0,-1);
      }
    }

    // First octet of this SMS-DELIVER or SMS-SUBMIT message   
    let firstOctet;
    // if the sms is of SMS-SUBMIT type it would contain a TP-MR
    var isSmsSubmit;
    if(isSmsSubmit = ((firstOctet = getOctet()) & PDU_MTI_SMS_SUBMIT)) 
      var messageReference = getOctet(); // TP-Message-Reference
     
    // - Sender Address info -
    // Address length
    let senderAddressLength = parseHex(getOctet());
    if(senderAddressLength <= 0) return false;
    // Type-of-Address
    let senderTypeOfAddress = getOctet();
    if(senderAddressLength % 2 == 1) senderAddressLength += 1;
    var senderNumber = semiOctetToString(getOctet((senderAddressLength / 2)));
    if(senderNumber.length <= 0) return false;
    if ((parseHex(senderTypeOfAddress) >> 4) == (PDU_TOA_INTERNATIONAL >> 4))
      senderNumber = '+' + senderNumber;
    if(senderNumber.charAt(senderNumber.length -1) == 'F')
      senderNumber = senderNumber.slice(0,-1);    

    // - TP-Protocolo-Identifier -
    let protocolIdentifier = getOctet();

    // - TP-Data-Coding-Scheme -
    let dataCodingScheme = getOctet();

    // SMS of SMS-SUBMIT type contains a TP-Service-Center-Time-Stamp field
    // SMS of SMS-DELIVER type contains a TP-Validity-Period octet
    if(isSmsSubmit) {
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
      if(firstOctet & (PDU_VPF_ABSOLUTE | PDU_VPF_RELATIVE | PDU_VPF_ENHANCED))
        var validityPeriod = getOctet();
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
    let userDataLength = parseHex(getOctet());

    // - TP-User-Data -
    if(userDataLength > 0) {
      let userDataOctet = getOctet(userDataLength);
      // Get the user message
      var userDataString = getUserData(userDataOctet, dataCodingScheme);
    }
        
    var ret = {
      SMSC: smscNumber,
      sender: senderNumber,
      message: userDataString           
    }

    if(isSmsSubmit)
      ret.validity = validityPeriod;
    else  
      ret.timestamp = scTimeStampString;
    return ret;   
  }, //this.parse

  /* Get a SMS-SUBMIT PDU for a destination address and a message using the
  // specified encoding.
  this.getSubmitPdu = function(scAddress, 
                              destinationAddress, 
                              message,
                              encoding) {
    // SMSC 
    if(scAddress != 0) {
      // International format
      var smscFormat;
      if(scAddress[0] == '+') {
        smscFormat = PDU_TOA_INTERNATIONAL;
        scAddress = scAddress.substring(1);
      }
      // Add a trailing 'F'
      if(scAddress.length % 2 == 0) scAddress += 'F';
      // Convert into string
      var smsc = semiOctetToString(scAddress);
    }
  }*/

}
