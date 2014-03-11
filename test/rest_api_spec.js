"use strict";
var frisby = require('frisby');
var config = require("config");
var host = "http://localhost:3000/";

frisby.create('testing headers')
    .get(host)
    .expectStatus(200)
    .expectHeaderContains('content-type', 'text/html')
    .toss();


var randText = Math.random().toString();

frisby.create('testing put')
    .post(host + 'put', {
        txt: randText,
        expire: "+5m"
    })
    .expectStatus(200)
    .expectHeaderContains('content-type', 'application/jso')
    .inspectBody()
    .expectJSON({"response":function (response) {
            expect(response.pin.length).toEqual(config.COMMON.PIN_LENGTH);
            expect(response.id.length).toEqual(config.COMMON.ID_LENGTH);
            testGet(response.id, response.pin);
        }
    }
    )
    .toss();

function testGet(id, pin, expiry) {
    frisby.create('testing get')
        .get(host + 'get?pin=' + pin + '&id=' + id)
        .expectStatus(200)
        .expectHeaderContains('content-type', 'application/jso')
        .expectJSON({
        })
        .toss();
}

//testing for expired content
frisby.create('testing expired content')
    .get(host + 'get?id=pknhw2td&pin=727258')
    .expectStatus(200)
    .expectHeaderContains('content-type', 'application/jso')
    .expectJSON({"error":"Content expired"})
    .toss();

//testing for invalid id
frisby.create('testing invalid id')
    .get(host + 'get?id=12dsf&pin=727258')
    .expectStatus(200)
    .expectHeaderContains('content-type', 'application/jso')
    .expectJSON({"error":"Invalid ID."})
    .toss();

frisby.create('sending sms pin')
    .get(host + 'get?id=12dsf&pin=727258')
    .expectStatus(200)
    .expectHeaderContains('content-type', 'application/jso')
    .expectJSON({"error":"Invalid ID."})
    .toss();