/**
 * Created with IntelliJ IDEA.
 * User: saravanacp
 * Date: 10/16/13
 * Time: 10:46 PM
 * To change this template use File | Settings | File Templates.
 */
"use strict";
var ID_LENGTH = 8; //ID length
var KEY_LENGTH = 43; //encryption key length
var secret = "";
var msgID = "";
var msgPIN = "";
var msgShareOption = "URL_PIN_separate";

function checkUrl() {
    var temp = window.location.hash.substring(1).split(",");

    if (temp.length < 2 || temp.length > 3) {
        warnWrongUrl();
    }
    secret = temp[0];
    msgID = temp[1];
    if (temp.length != 2) {
        msgPIN = temp[2];
        $("#enter_pin").hide(0, 0);
        if (validatePinLength(msgPIN) || validatePinNumeric(msgPIN)) {
            warnWrongPin();
            return;
        }
        msgShareOption = "URL_PIN_combined";
        showMessage(msgID, msgPIN, secret, msgShareOption);
    }
    else {
        if (warnWrongID(msgID) || warnWrongKey(secret)) {
            return;
        }
    }
}

$(window).load(
    function () {
        $('#pin_submit').click(
            function () {
                $(document).trigger("clear-alerts");
                msgPIN = $('#pin').val()
                if (validatePinLength(msgPIN) || validatePinNumeric(msgPIN)) {
                    return;
                }
                showMessage(msgID, msgPIN, secret, msgShareOption)

            });
        clearAlerts();
    });


function showMessage(id, pin, secret, messageShareOption) {

    $('#loading_image').show();
    $.ajax({
        url: "/get",
        data: {
            "id": id,
            "pin": pin,
            "messageShareOption": messageShareOption
        },
        success: function (ajaxResponse) {
            var currentTime = Math.round((new Date()).getTime() / 1000);
            $('#loading_image').hide();
            if (ajaxResponse.response && ajaxResponse.response.data) {
                ajaxResponse = ajaxResponse.response;
                $("#msg_text_area")[0].value = decryptMsg(ajaxResponse.data, secret);
                $("#enter_pin").hide(0, 0);
                $("#display_message").show(0, 0);
                /*
                 * Start the expiry countdown now and update the countdown timer every one minute
                 */
                $("#display_countdown").show(0, 0);
                $('#countdown').countdown({until: ajaxResponse.expireTime - currentTime});
                self.setInterval(function () {
                    displayCounter(ajaxResponse.expireTime);
                }, 60 * 1000);
            }
            else {
                warnServerError(ajaxResponse.error);
            }
        }
    });

}

function displayCounter(expireTime) {
    var currentTime = Math.round((new Date()).getTime() / 1000);
    var timeLeft = expireTime - currentTime;
    if (timeLeft > 0) {
        $('#countdown').countdown({until: timeLeft});
        if (timeLeft < 60) {
            /*
             * Since we update the countdown timer every 1 minute,
             * clear the countdown counter when the time expires
             */
            self.setTimeout(clearCounter(), timeLeft * 1000);
        }
    } else {
        clearCounter();
    }
}

function clearCounter() {
    $('#countdown').countdown('destroy');
    self.clearInterval();
    warnServerError("Content Expired");
}


function warnServerError(errorMessage) {
    clearAlerts();
    $(document).trigger("add-alerts", [
        {
            'message': errorMessage,
            'priority': 'error'
        }
    ]);
}

function validatePinLength(pin) {
    if (pin.length !== 6) {
        $(document).trigger("add-alerts", [
            {
                'message': "PIN length should be six",
                'priority': 'error'
            }
        ]);
        return true;
    }
}

function validatePinNumeric(pin) {
    if (!$.isNumeric(pin)) {
        $(document).trigger("add-alerts", [
            {
                'message': "PIN cannot be non-numeric",
                'priority': 'error'
            }
        ]);
        return true;
    }
}

function warnWrongUrl() {
    clearAlerts();
    $(document).trigger("add-alerts", [
        {
            'message': "URL incorrect, use complete URL",
            'priority': 'error'
        }
    ]);
}

function warnWrongPin() {
    warnWrongUrl();
}

function warnWrongID(id) {
    clearAlerts();
    if (id.length !== ID_LENGTH) {
        warnWrongUrl();
        return true;
    }
}

function warnWrongKey(key) {
    clearAlerts();
    if (key.length !== KEY_LENGTH) {
        warnWrongUrl();
        return true;
    }
}

function clearAlerts() {
    $(document).trigger("clear-alerts");
    $("#display_message").hide(0, 0);
    $("#display_countdown").hide(0, 0);
}

$(window).load(checkUrl);


$(function () {
    $("#about").popover();
});
$(function () {
    $("#contact").popover();
});

function createnewmessage() {
    window.location.href = '/';
}

/**
 * Google analytics
 */

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



