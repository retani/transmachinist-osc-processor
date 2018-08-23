var osc = require('node-osc');

var oscServer = new osc.Server(12345, '127.0.0.1'); // listen

var client = new osc.Client('0.0.0.0', 6448); //send

const source = "/time"
const channel = 5
const target = "/wek/inputs"
// # of output channels: 5

var client = new osc.Client('127.0.0.1', 3333);

var oscServer = new osc.Server(12345, '127.0.0.1');
oscServer.on("message", function (msg, rinfo) {
			const msgAmp = msg.map( v => v * 100)
      if (msg[1] == 1) {
      	// console.log(msg);	
      	const out = [
      		msg[2],
      		msg[3],
      		msg[4],
      		msg[5],
      		msg[6],
      	]
      	console.log(out);	
				client.send('/e1', out, function () {
				});      	
      }
      
      //console.log(msgAmp);



});

