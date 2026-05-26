

let sendSuccess = function(res, message, data) {
    const response = {
        status: 1,
        message: message
    };

    if (data !== undefined) {
        response.data = data;
    }

    res.status(200).json(response);
}


let sendError = function(res) {
    res.status(500).json({
        status: 0,
        message: "server error"
    })
}


let sendAPIError = function(res, status, message) {
    res.status(status).json({
        status:0 ,
        message: message
    })
}



module.exports = {sendSuccess, sendError, sendAPIError} ;