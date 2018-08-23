var osc = require('node-osc');

var oscServer = new osc.Server(12345, '127.0.0.1'); // listen
oscServer.on("message", function (msg, rinfo) {
     	console.log(msg);	
});

