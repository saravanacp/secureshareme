"use strict";
var fs = require('fs');

function writeFile(res, fileName) {
    fs.readFile(fileName, function (error, content) {
        if (error) {
            res.writeHead(500);
            res.end();
        }
        else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
        }
    });
}

exports.index = function(req, res){
    writeFile(res, './public/html/index.html');
};


exports.show = function (req, res) {
    writeFile(res, './public/html/show.html');
};