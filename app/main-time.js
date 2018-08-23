var osc = require('node-osc');

var oscServer = new osc.Server(12345, '127.0.0.1'); // listen

var clientLocal = new osc.Client('0.0.0.0', 6448); //send
var clientRemote = new osc.Client('192.168.1.5', 6448); //send

const source = "/openbci"
const channel = 5
const target = "/wek/inputs"
// # of output channels: 1

oscServer.on("message", function (msg, rinfo) {
			if (msg[0] != source) return;

			//console.log(msg[0], msg.length)

			// 9 -> time series


			const msgAmp = msg.map( v => v * 100)
      	// console.log(msg);	
      	const out = [
      		msg[channel+1],
      	]
      	//console.log(out);	
				clientLocal.send(target, out, function () {});      	
				clientRemote.send(target, out, function () {});      	
      
      //console.log(msgAmp);



});

