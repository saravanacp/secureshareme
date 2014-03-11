"use strict";
var UPLOAD_SIZE_LIMIT = 32 * 1024;

/**
 * Compute number of bytes in human readable format
 * @param bytes - number of bytes
 * @returns {string} - human readable format of the input
 */
function bytesToSize(bytes) {
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    if (bytes === 0) {
        return 'Size zero data';
    }
    var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
    return ((i === 0) ? bytes : (bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
}
if (typeof module !== 'undefined') {
    module.exports.bytesToSize = bytesToSize;
}

function uploadSizeLimitReached(size) {
    if (size > UPLOAD_SIZE_LIMIT) {
        return true;
    } else {
        return false;
    }
}
if (typeof module !== 'undefined') {
    module.exports.uploadSizeLimitReached = uploadSizeLimitReached;
}

function randomKeyTimeStamped(keyLength) {
    var now = new Date();
    var timeStamp = now.getFullYear() + makeLength(now.getMonth(), 2) + makeLength(now.getDate(), 2);
    return timeStamp + "_" + generateRandomKey(keyLength);
}
if (typeof module !== 'undefined') {
    module.exports.randomKeyTimeStamped = randomKeyTimeStamped;
}

function makeLength(s, length) {
    s = s.toString();
    var n = s.length;
    while (length - n >= 0) {
        s = "0" + s;
        length = length - 1;
    }
    return s;
}
if (typeof module !== 'undefined') {
    module.exports.makeLength = makeLength;
}

function bin2String(array) {
    return String.fromCharCode.apply(String, array);
}
if (typeof module !== 'undefined') {
    module.exports.bin2String = bin2String;
}

/**
 * Generate random key for the given key length and key space (what set of characters to use in the key)
 * @param keyLength
 * @param keySpace
 * @returns {string}
 */
function generateRandomKey(keyLength, keySpace) {
    var charSpace = {
        "base64": ['-', '_', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'],
        "alphanumeric": ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'],
        "alphanumeric_upper_case": ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
        "alphanumeric_lower_case": ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'],
        "numeric": ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
    };

    if (charSpace[keySpace] === null) {
        console.error("keySpace value doesn't match defined values.");
        return null;
    } else if (keySpace === null) {
        keySpace = "base64"; //defaulting to base64
    }

    var key = "";
    var charSet = charSpace[keySpace];
    var rnd = 0;
    for (var i = 0; i < keyLength; i++) {
        rnd = generateRandomNumbers(1)[0];
        key = key + charSet[Math.round(Math.floor(rnd % charSet.length))];
    }
    return key;
}
if (typeof module !== 'undefined') {
    module.exports.generateRandomKey = generateRandomKey;
}

function generateRandomNumbers(count) {
    var rand = new Uint32Array(count);
    //node js
    if (typeof crypto !== "undefined" && typeof crypto.randomBytes !== "undefined") {
        for (var i = 0; i < rand.length; i++) {
            rand[i] = crypto.randomBytes(4).readUInt32BE(0);
        }
    }
    //browser crypto support
    else if (typeof window !== "undefined" && typeof window.crypto.randomBytes !== "undefined" && typeof window.crypto.getRandomValues !== "undefined") {
        window.crypto.getRandomValues(rand);
    }
    //fallback to Math.random
    else {
        for (var i = 0; i < rand.length; i++) {
            rand[i] = Math.random() * 4294967295;
        }
    }
    return rand;
}

function parsePhoneNumber(phoneNumber) {
    return phoneNumber.replace(/[^0-9^+]/g, "");
}
if (typeof module !== 'undefined') {
    module.exports.parsePhoneNumber = parsePhoneNumber;
}

function validateId(id) {
    return id.length === 8;
}

//ref:http://stackoverflow.com/questions/14382725/how-to-get-the-correct-ip-address-of-a-client-into-a-node-socket-io-app-hosted-o
function getClientIp(req) {
    var ipAddress;
    // Amazon EC2 / Heroku workaround to get real client IP
    var forwardedIpsStr = req.header('x-forwarded-for');
    if (forwardedIpsStr) {
        // 'x-forwarded-for' header may return multiple IP addresses in
        // the format: "client IP, proxy 1 IP, proxy 2 IP" so take the
        // the first one
        var forwardedIps = forwardedIpsStr.split(',');
        if (forwardedIps && forwardedIps.length > 0) {
            ipAddress = forwardedIps[forwardedIps.length - 1]; //getting the last ip address as this is only set by heroku and trustable
        }
    }
    if (!ipAddress) {
        // Ensure getting client IP address still works in
        // development environment
        ipAddress = req.connection.remoteAddress;
    }
    return ipAddress;
}

if (typeof module !== 'undefined') module.exports.getClientIp = getClientIp;
