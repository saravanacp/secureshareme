"use strict";

var util = require('util');
var utils = require('../public/javascripts/utils');
var winston = require('winston');
var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({json: false, timestamp: function () {
            return new Date();
        } }),
        new (winston.transports.File)({ filename: 'secureshare.log', json: false, timestamp: function () {
            return new Date();
        } })
    ]
});

function expressLogger(req, res, next) {
    var requestHeader, cookies, id, logMsg, end;
    requestHeader = "";
    for (var header in req.headers) {
        if (req.headers.hasOwnProperty(header) && header !== 'cookie') {
            requestHeader = requestHeader + header + ":'" + req.headers[header] + "' ";
        }
    }
    cookies = req.signedCookies;
    if (cookies !== undefined && cookies.ID !== undefined) {
        id = cookies.ID;
    }

    logMsg = util.format("%s %s %s HTTP%s ID:'%s' %s", utils.getClientIp(req), req.method, req.url, req.httpVersion, id, requestHeader);
    req.startTime = new Date();
    end = res.end;
    res.end = function (chunk, encoding) {
        res.end = end;
        res.end(chunk, encoding);
        var responseTime = (new Date()) - req.startTime;
        logger.info(util.format("%s %s %s ms", logMsg, res.statusCode, responseTime));
    };
    next();
}

exports.expressLogger = expressLogger;
exports.logger = logger;
