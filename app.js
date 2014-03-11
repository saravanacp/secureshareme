"use strict";
/**
 * check for required env variables
 */
var envVars = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER", "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY", "SMS_COUNTER_TABLE_NAME", "ID_PIN_TABLE_NAME", "S3_BUCKET_NAME", "COOKIE_SIGNATURE",
    "AWS_REGION"];
var exitFlag = false;
for (var i in envVars) {
    if (process.env[envVars[i]] === undefined) {
        console.log('Required environment variable ' + envVars[i] + ' is not found.');
        exitFlag = true;
    }
}
if (exitFlag) {
    return;
}

var express = require('express'),
    staticFiles = require('./routes/static'),
    action = require('./routes/action'),
    http = require('http'),
    path = require('path'),
    winstonLogger = require("./lib/winstonLogger"),
    logger = winstonLogger.logger,
    config = require("config"),
    app = express(),
    errors = require('./routes/errors');

// all environments
app.set('port', process.env.PORT || config.SERVER.PORT);
app.use(express.favicon());
app.use(express.bodyParser());
app.use(express.cookieParser(process.env.COOKIE_SIGNATURE));
app.use(action.setCookies);
app.use(winstonLogger.expressLogger);
app.use(express.methodOverride());
app.use(app.router);
app.use(require('stylus').middleware(__dirname + '/public'));
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' === app.get('env')) {
    app.use(express.errorHandler());
}

if ('production' === app.get('env')) {
    // redirect all requests to https
    app.all('*', function (req, res, next) {
        if (req.headers['x-forwarded-proto'] !== 'https') {
            if (req.url.substring(0, 1) === '/') {
                res.redirect('https://' + config.SERVER.HOST_NAME + req.url);
            }
            else {
                res.redirect('https://' + config.SERVER.HOST_NAME + '/' + req.url);
            }
        }
        else {
            next();
        }
    });

    // accept reqs only for specific hosts
    /*app.all('*',function(req,res,next){
     if(host_pattern.test(req.headers['Host']))
     next();
     else
     erros.deny(req,res,"Request is not coming for a valid host. Got request for '" + req.headers['Host']+"'");
     });*/
}

//set common headers - http://en.wikipedia.org/wiki/List_of_HTTP_header_fields
app.all('*', function (req, res, next) {
    if (req.path === '/put' || req.path === '/get' || req.path === '/sendPinSMS') {  //set it only for json endpoints
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store');
    }
    //production headers
    if ('production' === app.get('env')) {
        //strict https header  - http://en.wikipedia.org/wiki/HTTP_Strict_Transport_Security
        res.setHeader('Strict-Transport-Security', 'max-age=131536000; includeSubDomains');
    }
    next();
});

app.get('/', staticFiles.index);
app.get('/s', staticFiles.show);
app.post('/put', action.uploadSizeLimitCheck, action.put);
app.get('/get', action.get);
app.get('/sendPinSMS', action.sendPinSms);
app.post('/webEvent', action.webEvent);

http.createServer(app).listen(app.get('port'), function () {
    logger.info('Express server listening on port ' + app.get('port'));
});
