"use strict";
var KEY_LENGTH = 43; //encryption key length 43 base 64 chars will give 258 bits of entropy
var ADATA_LENGTH = 20; //length of authentication data used to check the itegrity of the encrypted data
var MESSAGE_BOX = "#input_txt";
var isPinGenerated = false; //state variable to denote if message is secured and, url and pin has been generated
var shareUrl = "";
var shareId = "";
var sharePin = "";
var encryptionKey = "";

/**
 * Populate URL and PIN in the respective text box
 */
function populateUrlPin() {
    var separately = $("input:radio[name=share_option]")[0].checked;
    if (isPinGenerated) {
        if (separately) {
            $("#share_url_txt")[0].value = shareUrl;
            $("#share_pin_txt")[0].value = sharePin;
        } else {
            if (shareUrl !== "") {
                $("#share_url_txt")[0].value = shareUrl + "," + sharePin;
            }
        }
    }
    if (separately) {
        $('#share_pin_box1').show(0);
    } else {
        $('#share_pin_box1').hide(0, 0);
    }

    /**
     * We would have disabled the button till we process the request.
     * Enable it now.
     */
    $("#secure_btn")[0].style.display = "inline";
    $('html, body').css("cursor", "auto");

}

/**
 * Generate URL for sharing with key and ID
 * @param baseURL
 * @param params - Key, ID, PIN
 * @returns url for sharing
 */
function generateURL(baseURL, params) {
    var url = baseURL + "?";
    for (var k in params) {
        if (params.hasOwnProperty(k)) {
            url = url + encodeURIComponent(k) + "=" + encodeURIComponent(params[k]) + "&";
        }
    }
    return url;
}

/**
 * Generates body text for URL sharing through email for different email providers.
 * @param platform
 * @returns {string}
 */
function generateBodyUrl(platform) {
    var body = "View the message here ";
    switch (platform) {
        case "yahoo":
            body = body + window.location.protocol + "//" + window.location.host + "/s%23" + encryptionKey + "," + shareId;
            break;
        default:
            body = body + window.location.protocol + "//" + window.location.host + "/s#" + encryptionKey + "," + shareId;
    }
    if ($("input:radio[name=share_option]")[1].checked) {
        body = body + "," + sharePin;
    }
    body = body + " . Send messages securely using " + window.location.protocol + "//" + window.location.host;
    return body;
}

/**
 * Generates body text for PIN sharing through email for different email providers.
 * @returns {string}
 */
function generateBodyPin() {
    return "I have sent you a confidential message, use this pin to view it. Pin: " + sharePin;
}

/**
 * Gives a visual clue to the user that the message box has no text
 */
function warnUserEmptyMsg() {
    var element = $(MESSAGE_BOX)[0];
    if (element.value === "") {
        element.focus();
        element.placeholder = "Please enter your message here before sharing";
        return true;
    }
    return false;
}

/**
 * Share url and pin via email and SMS
 * @param platform
 * @param content
 */
function shareEmailPin(platform, content) {

    var baseURL = "";
    var params = {};
    var body;

    if (content === 'url') {
        body = generateBodyUrl(platform);
    } else {
        body = generateBodyPin();
    }

    switch (platform) {
        case "gmail":
            baseURL = "https://mail.google.com/mail/";
            params = {
                "view": "cm",
                "fs": "1",
                "ui": "2",
                "tf": "1",
                "body": body
            };
            break;
        case "yahoo":
            baseURL = "https://compose.mail.yahoo.com/";
            params = {
                "body": body
            };
            break;
        case "hotmail":
            baseURL = "https://mail.live.com/default.aspx";
            params = {
                "body": body,
                "view": 1
            };
            break;
        case "sms":
            var phoneNumber = "+" + $('#sms_country').val() + $('#phone_no').val();
            console.log("Phone no: " + phoneNumber);
            //TBD phone number validation
            $.ajax({
                url: "/sendPinSMS",
                data: {
                    "id": shareId,
                    "phoneNumber": phoneNumber
                },
                success: function (ajaxResponse) {
                    var errorMsg = "SMS not sent retry and check phone number";
                    if (ajaxResponse.status !== "success") {
                        if (ajaxResponse.errorCode) {
                            if (ajaxResponse.errorCode === "phone") {
                                errorMsg = "Too many messages sent to this phone number. Please try after some time.";
                            } else if (ajaxResponse.errorCode === "ip") {
                                errorMsg = "Too many messages sent from this IP address. Please try after some time.";
                            }
                        }
                        $("#sms_status").html(errorMsg).show().delay(3000).fadeOut(2000).show();

                        return;
                    }
                    $("#sms_status").html("SMS sent successfully").show().delay(3000).fadeOut(2000);
                }
            });
            return;
    }
    window.open(generateURL(baseURL, params), "secure_share_url");
}

/**
 * Makes an ajax call to store the encrypted message
 * @param encryptedTxt - encrypted message
 * @param expireOption
 * @param callback
 */
function storeTxt(encryptedTxt, expireOption, callback) {
    $.ajax({
        url: "/put",
        type: "POST",
        data: {
            "txt": encryptedTxt,
            "expire": expireOption
        },
        success: function (ajaxResponse) {
            if (ajaxResponse.response === null) {
                var errorMsg = (ajaxResponse.error !== null) ? ajaxResponse.error : "Try again later.";
                alert("Error communicating to the server!" + "\n" + errorMsg);
                return;
            }
            ajaxResponse = ajaxResponse.response;
            shareUrl = window.location.protocol + "//" + window.location.host + "/s#" + encryptionKey + "," + ajaxResponse.id;
            shareId = ajaxResponse.id;
            sharePin = ajaxResponse.pin;
            isPinGenerated = true;
            populateUrlPin();
            $('#loading_image').hide();
            if (typeof callback === "function") {
                callback();
            }
        }
    });
}

/**
 * Encrypts the message in the text_area_object and stores in the server.
 * @param textAreaObject
 * @param callback
 */
function encryptMsg(textAreaObject, callback) {
    var text = $(textAreaObject)[0].value;
    if (text.length === 0) {
        warnUserEmptyMsg();
        return;
    }

    if (uploadSizeLimitReached(text.length)) {
        alert("The upload limit is 5MB. Your message size is " + bytesToSize(text.length) + ".");
        return;
    }

    $('#loading_image').show();

    encryptionKey = generateRandomKey(KEY_LENGTH, "base64");
    var adata = generateRandomKey(ADATA_LENGTH, "base64");
    var options = { v: 1, iter: 1000, ks: 256, ts: 128, mode: "ccm", adata: adata, cipher: "aes" };
    var rp = {};
    var encryptedMsg = sjcl.encrypt(encryptionKey, text, options, rp);
    storeTxt(encryptedMsg, $("#expire_option")[0].value, callback);
}

/**
 * Decrypts the message with the key
 * @param text
 * @param key
 * @returns {string} - decrypted message
 */
function decryptMsg(text, key) {
    if (text.length === 0) {
        alert("nothing to decrypt");
        return "";
    }
    var clearMsg = sjcl.decrypt(key, text);
    return clearMsg;
}

/**
 * Check if message has been secured
 */
function warnUserNotSecuredMsg() {
    if (isPinGenerated === false) {

        $(document).trigger("clear-alerts");
        $(document).trigger("add-alerts", [
            {
                'message': "Secure message by clicking on secure button",
                'priority': 'error'
            }
        ]);
        return true;
    }
    return false;
}

/**
 * Get phone number from user for SMS
 */
function inputPhoneNumber() {
    if (warnUserEmptyMsg() || warnUserNotSecuredMsg()) {
        return;
    }
    var smsInput=$('#sms_input');
    smsInput.toggle(smsInput.is(':hidden'));
}

/**
 * Share URL and PIN via different email providers and SMS
 * @param platform
 * @param content
 */
function shareVia(platform, content) {
    if (warnUserEmptyMsg() || warnUserNotSecuredMsg()) {
        return;
    }
    shareEmailPin(platform, content);
}

$(window).load(function () {
    $("#sms_input").hide(0, 0);
});

$(window).load(function () {
    $("#sms_status").hide(0, 0);
});

$(window).load(function () {
    $('#sms_send').click(function () {
        shareVia('sms', 'pin');
        $("#sms_input").hide(0, 0);
    });
});

$(window).load(function () {
    $("input:radio[name=share_option]").click(populateUrlPin);
});

$(window).load(function () {
    $('#country_code').html("+1");
    $('#sms_country').change(function () {
        $('#country_code').html("+" + $('#sms_country').val())
    });
});

$(window).load(function () {
    sjcl.random.startCollectors();
});

$(window).load(function () {
    $("#contact").popover();
});


$(window).load(function () {
    $("#input_txt").bind("input propertychange", function () {
        isPinGenerated = false;
        shareUrl = "";
        sharePin = "";
        $("#share_url_txt")[0].value = shareUrl;
        $("#share_pin_txt")[0].value = sharePin;
    });
});

$(window).load(function () {
    (function (i, s, o, g, r, a, m) {
        i['GoogleAnalyticsObject'] = r;
        i[r] = i[r] || function () {
            (i[r].q = i[r].q || []).push(arguments)
        }, i[r].l = 1 * new Date();
        a = s.createElement(o),
            m = s.getElementsByTagName(o)[0];
        a.async = 1;
        a.src = g;
        m.parentNode.insertBefore(a, m)
    })(window, document, 'script', '//www.google-analytics.com/analytics.js', 'ga');

    ga('create', 'UA-44941941-1', 'secureshareme.com');
    ga('send', 'pageview');
});