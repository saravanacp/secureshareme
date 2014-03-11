"use strict";

var AWS = require('aws-sdk');
AWS.config.update({accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, region: process.env.AWS_REGION});
var dynamoDB = new AWS.DynamoDB();

//load logger
var winstonLogger = require("./winstonLogger");
var logger = winstonLogger.logger;

function dynamoDBCounter(tableName, intervalSeconds) {
    this.tableName = tableName;
    this.intervalMs = intervalSeconds * 1000;
    this.incrementByValue = function (attribute, val, callback) {
        var time, valS, dbParams;
        time = (Math.floor((new Date()).getTime() / this.intervalMs) * this.intervalMs).toString();
        valS = val.toString();
        dbParams = {
            "TableName": this.tableName,
            "Key": {
                "id": {
                    "S": attribute
                },
                "time": {
                    "N": time
                }
            },
            "AttributeUpdates": {
                "count": {
                    "Value": {
                        "N": valS
                    },
                    "Action": "ADD"
                }
            },
            "ReturnValues": "ALL_NEW"
        };
        dynamoDB.updateItem(dbParams, function (err, data) {
            if (err !== null) {
                logger.error("Error in incrementing count for " + attribute + " Inc value: " + val + " Table:" + tableName + " " + JSON.stringify(err));
                callback(err, null);
            } else {
                var count = Number(data.Attributes.count.N);
                logger.info("Incremented " + attribute + " by " + val + " count=" + count);
                callback(err, count);
            }
        });
    };
}

exports.dynamoDBCounter = dynamoDBCounter;
