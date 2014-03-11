"use strict";

exports.deny = function (req, res, errorMsg) {
    res.statusCode = 403;
    res.write(JSON.stringify({"error_message":errorMsg}));
    res.end();
};
