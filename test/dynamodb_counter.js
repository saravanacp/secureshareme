var dynamo_db_counter=require("../lib/dynamoDBCounter.js");
var counter = new dynamo_db_counter.DynamoDBCounter("counter-test1",20);

var s= require('http').createServer();
s.listen(9999);

exports.testIncrement = function(test){
    test.expect(1);
    counter.incrementByValue(Math.random().toString(),1,function(count){
        console.log(count);
        test.ok(count==2,"Increment failed for new entry");
        test.done();
    });
};