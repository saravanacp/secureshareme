"use strict";

//load aws client
var config = require("config");
var AWS = require('aws-sdk');
AWS.config.update({accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, region: process.env.AWS_REGION});
var s3 = new AWS.S3();
var dynamodb = new AWS.DynamoDB();
var utils = require('../public/javascripts/utils.js');

//load twilio client
var client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

//load logger
var winstonLogger = require("../lib/winstonLogger");
var logger = winstonLogger.logger;

//load counters
var dynamoDBCounter = require("../lib/dynamoDBCounter.js");
var Step = require("step");

var expireOptions = {
    "+5m": -300,
    "24h": 24 * 3600,
    "1w": 7 * 24 * 3600,
    "1m": 30 * 24 * 3600
};

exports.webEvent = function (req, res) {
    logger.info("WEBEVENT received. Event Name: " + req.body.eventName +
        " Event timestamp: " + req.body.eventTime + " Event Data: " +
        req.body.eventData);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.write(JSON.stringify({"message": "webEvent logged!"}));
    res.end();
};

exports.uploadSizeLimitCheck = function (req, res, next) {
    if (utils.uploadSizeLimitReached(req.body.txt.length)) {
        var errorMsg = "Your message exceeds upload size limit of 5MB.";
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.write(JSON.stringify({"error": errorMsg}));
        res.end();
        return;
    } else {
        next();
    }
};

exports.setCookies = function (req, res, next) {
    var cookies = req.signedCookies;
    if (cookies === undefined || cookies.ID === undefined) {
        /*
         * New user. We need to set cookies for the first time
         */
        var randNum = utils.generateRandomKey(Number(config.SERVER.COOKIE_LENGTH), config.SERVER.COOKIE_TYPE);
        var cookieValue = new Date().toJSON().toString() + "_" + new Date().getTime() + "_" + randNum;
        res.cookie('ID', cookieValue, { maxAge: 1000 * 24 * 3600 * 1000, signed: true});
    }
    next();
};

exports.put = function (req, res) {
    //id is the db key used to store the content, consider this as the username
    var id = utils.generateRandomKey(Number(config.COMMON.ID_LENGTH), config.COMMON.ID_TYPE);
    //pin is used to check validity of the request, consider this as the password
    var pin = utils.generateRandomKey(Number(config.COMMON.PIN_LENGTH), config.COMMON.PIN_TYPE);
    var body = req.body.txt;
    var expire = req.body.expire;

    //TBD do a input validation here
    var expireTime;
    var prefix = expire;
    var unixTime = Math.round((new Date()).getTime() / 1000);
    var timestamp = unixTime.toString();
    if (expireOptions[expire] > 0) {
        expireTime = unixTime + expireOptions[expire];
    } else if (expireOptions[expire] < 0) {
        expireTime = expireOptions[expire];
    } else {
        prefix = '1m';
        expireTime = unixTime + expireOptions['1m'];
    }
    var s3Id = prefix + "_" + id;
    var params = {
        Key: s3Id,
        Body: body,
        Bucket: process.env.S3_BUCKET_NAME,
        ContentType: "text/plain"
    };
    //store s3 first so that failure in s3 wont result in invalid record in dynamodb
    //need to parallelize storage to s3 and dynamodb, after all it is node.js
    logger.profile("s3 putObject");
    s3.putObject(params, function (err) {
        logger.profile("s3 putObject");
        if (err) {
            console.log(err);
            res.status = 500;
            res.write(JSON.stringify({error: "Internal Server Exception."}));
            res.end();
        }
        else {
            //store the metadata in dynamodb
            logger.info("Successfully uploaded data to " + process.env.S3_BUCKET_NAME + "/" + s3Id + " msg_size=" + req.body.txt.length + " expire_option=" + expire);
            var item = {
                "TableName": process.env.ID_PIN_TABLE_NAME,
                "Item": {
                    "id": {"S": id},
                    "createdDate": {"N": timestamp},
                    "modifiedDate": {"N": timestamp},
                    "failedTries": {"N": "0"},
                    "views": {"N": "0"},
                    "pin": {"S": pin},
                    "s3Id": {"S": s3Id},
                    "expireDate": {"N": expireTime.toString()}
                }
            };
            logger.profile("dynamodb putitem");
            dynamodb.putItem(item, function (err) {
                logger.profile("dynamodb putitem");
                if (err) {
                    //TBD - delete the content from s3
                    logger.error(err);
                    res.status = 500;
                    res.write(JSON.stringify({error: "Internal Server Exception."}));
                } else {
                    //give them id(username) and pin(password) back
                    res.write(JSON.stringify({"response":{"id": id, "pin": pin}}));
                }
                res.end();
            });
        }
    });
};

exports.get = function (req, res) {
    var id = req.query.id;
    var pin = req.query.pin;
    var s3Params = {
        "Key": id,
        "Bucket": process.env.S3_BUCKET_NAME
    };
    var dbParams = {
        "TableName": process.env.ID_PIN_TABLE_NAME,
        "Key": {
            "id": {
                "S": id
            }
        }
    };
    var currentTime = Math.round((new Date()).getTime() / 1000);

    logger.info(req.query);
    logger.profile("dynamodb getitem");
    dynamodb.getItem(dbParams, function (err, data) {
        logger.profile("dynamodb getitem");
        if (err) {
            logger.error(err);
            res.write(JSON.stringify({"error": "Internal Exception."}));
            res.end();
        } else if (typeof data.Item === 'undefined') {
            logger.error("Invalid ID " + id);
            res.write(JSON.stringify({"error": "Invalid ID."}));
            res.end();
        } else {
            //two scenarios from here, either to return the encrypted content or return an error
            var errorMsg;
            if (data.Item.s3Id !== undefined) {
                s3Params.Key = data.Item.s3Id.S;
            }

            //check for pin failure
            var pinFailure = (pin !== data.Item.pin.S);
            if (pinFailure) {
                errorMsg = "Wrong PIN";
            }

            //check for expiration and data corrupt
            var expireDate = Number(data.Item.expireDate.N);
            var expired = false;
            if (expireDate < 0 && Number(data.Item.views.N) > 0) {
                logger.error("data corrupt, expired<0 and views>0." + JSON.stringify(data.Item));
                errorMsg = "Data corrupt";
            }
            expired = currentTime > expireDate && expireDate > 0;
            if (expired) {
                errorMsg = "Content expired";
            }

            //check for brute force attack on pin
            var bruteForceAttack = Number(data.Item.failedTries.N) >= config.SERVER.FAILED_TRIES_THRESHOLD;
            if (bruteForceAttack) {
                errorMsg = "Brute force attack detected.";
            }

            if (bruteForceAttack || expired) {
                //delete the message stored in s3
                logger.profile("s3 deleteitem");
                s3.deleteObject(s3Params, function (err) {
                    logger.profile("s3 deleteitem");
                    if (err) {
                        logger.error(err);
                        res.status = 500;
                        res.write(JSON.stringify({error: "Internal Server Exception."}));
                        res.end();
                    } else {
                        res.write(JSON.stringify({"error": errorMsg}));
                        res.end();
                    }
                });
            } else if (pinFailure) {
                //update the #failed tries field
                dbParams = {
                    "TableName": process.env.ID_PIN_TABLE_NAME,
                    "Key": {
                        "id": {
                            "S": id
                        }
                    },
                    "AttributeUpdates": {
                        "failedTries": {
                            "Value": {
                                "N": "1"
                            },
                            "Action": "ADD"
                        }
                    }
                };
                logger.profile("dynamodb updateItem");
                dynamodb.updateItem(dbParams, function (err, data) {
                    logger.profile("dynamodb updateItem");
                    if (err) {
                        logger.error(err);
                        res.status = 500;
                        res.write(JSON.stringify({error: "Internal Server Exception."}));
                        res.end();
                    }
                    else {
                        logger.error("Wrong pin. Res:" + JSON.stringify(data));
                        res.write(JSON.stringify({"error": errorMsg}));
                        res.end();
                    }
                });
            } else {
                //get the encrypted content
                logger.profile("s3 getObject");
                s3.getObject(s3Params, function (err, s3Data) {
                    logger.profile("s3 getObject");
                    if (err) {
                        logger.error(err);
                        res.status = 500;
                        res.write(JSON.stringify({error: "Internal Server Exception."}));
                        res.end();
                    }
                    else {
                        dbParams = {
                            "TableName": process.env.ID_PIN_TABLE_NAME,
                            "Key": {
                                "id": {
                                    "S": id
                                }
                            },
                            "AttributeUpdates": {
                                "views": {
                                    "Value": {
                                        "N": "1"
                                    },
                                    "Action": "ADD"
                                }
                            }
                        };
                        if (expireDate < 0) {
                            expireDate = currentTime - expireDate;
                            dbParams.AttributeUpdates.expireDate = {
                                "Value": {
                                    "N": (expireDate).toString()
                                },
                                "Action": "PUT"
                            };
                        }
                        logger.profile("dynamodb updateItem");
                        dynamodb.updateItem(dbParams, function (err) {
                            logger.profile("dynamodb updateItem");
                            if (err) {
                                logger.error(err);
                                res.status = 500;
                                res.write(JSON.stringify({error: "Internal Server Exception."}));
                                res.end();
                            }
                            else {
                                logger.info(JSON.stringify(s3Data));
                                res.write(JSON.stringify({"response":{data: utils.bin2String(s3Data.Body),
                                    expireTime: expireDate}}));
                                res.end();
                            }
                        });
                    }
                });
            }
        }
    });
};

exports.sendPinSms = function (req, res) {
    //TBD input validation
    var id = req.query.id;
    var phoneNumber = utils.parsePhoneNumber(req.query.phoneNumber);

    var dbParams = {
        "TableName": process.env.ID_PIN_TABLE_NAME,
        "Key": {
            "id": {
                "S": id
            }
        }
    };
    logger.info(req.query);
    var counter = new dynamoDBCounter.dynamoDBCounter(process.env.SMS_COUNTER_TABLE_NAME, config.SERVER.SMS_COUNTER_TIME_INTERVAL);

    logger.profile("dynamodb getItem");

    //here we use step to parallelize and serialize operations
    Step(
        //incrementing the counters parallel, should look in to how to do this as a batch update operation on the Dynamodb
        function increment() {
            counter.incrementByValue("ph:" + phoneNumber, 1, this.parallel());
            counter.incrementByValue("ip:" + utils.getClientIp(req), 1, this.parallel());
        },
        //check the IP and phhone number thresholds for abuse
        function checkThresholds(err, phCount, ipCount) {
            logger.profile("dynamodb getItem");
            if (err) {
                throw err;
            }
            if (phCount > config.SERVER.PHONE_NUMBER_THRESHOLD) {
                logger.info("Reject send sms request due to phone threshold violation by " + phoneNumber + " threshold=" + config.SERVER.PHONE_NUMBER_THRESHOLD + " count=" + phCount);
                this({error: "Internal Server Exception.", errorCode: "phone"});
            } else if (ipCount > config.SERVER.IP_THRESHOLD) {
                logger.info("Reject send sms request due to IP threshold violation by " + utils.getClientIp(req) + " threshold=" + config.SERVER.IP_THRESHOLD + " count=" + ipCount);
                this({error: "Internal Server Exception.", errorCode: "ip"});
            }
            this(null);
        },
        //profiling
        function profile(error) {
            if (error) {
                res.status = 500;
                res.write(JSON.stringify(error));
                res.end();
            }
            logger.profile("dynamodb getItem");
            return error;
        },
        //get pin from dynamodb using the id. We are not getting the pin from the browser for security purpose.
        function getPin(error) {
            if (!error) {
                dynamodb.getItem(dbParams, this);
            } else {
                this(error);
            }
        },
        //send sms using TWILIO
        function sendSms(err, data) {
            logger.profile("dynamodb getItem");
            if (err) {
                //checking for already written output
                if (res.status !== 500) {
                    logger.error(err);
                    res.status = 500;
                    res.write(JSON.stringify({error: "Internal Server Exception."}));
                    res.end();
                }
                this(err);
            } else {
                var pin = data.Item.pin.S;
                //Send an SMS text message
                logger.profile("TWILIO sendSms");
                client.sendSms({
                    to: phoneNumber, // Any number Twilio can deliver to
                    from: process.env.TWILIO_PHONE_NUMBER, // A number you bought from Twilio and can use for outbound communication
                    body: 'Pin for your secret message: ' + pin // body of the SMS message

                }, this);
            }
        },
        //send the response to the browser
        function sendResponse(err) {
            logger.profile("TWILIO sendSms");
            if (!err) {
                res.write(JSON.stringify({"status": "success"}));
                res.end();
            } else {
                if (res.status !== 500) {
                    logger.info("Error in sending sms to: " + phoneNumber + " TWILIO error: " + JSON.stringify(err));
                    res.status = 500;
                    res.write(JSON.stringify({error: "Internal Server Exception."}));
                    res.end();
                }
            }
        });
};
