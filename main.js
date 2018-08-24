var osc = require('node-osc');

const confListen = {
  "time series": {
    port: 12345,
    host: "127.0.0.1"
  },
  "fft": {
    port: 123456,
    host: "127.0.0.1",
  },
  "band power": {
    port: 12347,
    host: "127.0.0.1"
  },  
}

const confSend = {
  "time series": {
    active: false,
    port: 8002,
    host: "127.0.0.1"
  },
  "spikes": {
    active: true,
    port: 8001,
    host: "127.0.0.1",
  },
  "headspikes": {
    active: true,
    port: 8003,
    host: "127.0.0.1"
  },
  "adjusted bands": {
    active: true,
    port: 8000,
    host: "127.0.0.1"
  },
}

var oscServer = new osc.Server(confListen["time series"].port, confListen["time series"].host); // listen time series
var oscServer2 = new osc.Server(confListen["fft"].port, confListen["fft"].host); // listen fft
var oscServer3 = new osc.Server(confListen["band power"].port, confListen["band power"].host); // listen band power

let conf = {}

conf = confSend["time series"]
if (conf.active) {
  var clientTimeSeriesLocal = new osc.Client(conf.host, conf.port); //send
  //var clientTimeSeriesRemote = new osc.Client('192.168.1.104', 8000); //send  
}

conf = confSend["spikes"]
if (conf.active) {
  var clientSpikeLocal = new osc.Client(conf.host, conf.port); //send
  //var clientSpikeRemote = new osc.Client('192.168.1.104', 8001); //send
}

conf = confSend["headspikes"]
if (conf.active) {
  var clientHeadSpikeLocal = new osc.Client(conf.host, conf.port); //send
  //var clientSpikeRemote = new osc.Client('192.168.1.104', 8001); //send
}


conf = confSend["adjusted bands"]
if (conf.active) {
  var clientBandLocal = new osc.Client(conf.host, conf.port); //send
  //var clientBandRemote = new osc.Client('192.168.1.104', 8000); //send
}

// var clientFftMainLocal = new osc.Client('127.0.0.1', 6450); //send
// var clientFftMainRemote = new osc.Client('192.168.5.106', 6450); //send

console.log("Listening to:")
for (let x in confListen) {
  console.log(`  ${confListen[x].host}:${confListen[x].port} - ${x}`)
}

console.log("Sending to:")
for (let x in confSend) {
  console.log(`  ${confSend[x].host}:${confSend[x].port} - ${x}`)
}

console.log("")


//const source = "/openbci"
const target = "/wek/inputs"

const channel = 7;
const band = [1,2,3,4,5];

const timeSeriesAvgWindow = 100 // 1 sec = 250

let timeSeriesArray = new Array(timeSeriesAvgWindow)
let timeSeriesArrayIndex = 0

let timeSeriesOut = 0
let bandOut = new Array(band.length).fill(0)
let fftMain = 0

let previousMax = 0

const spikeThresh = 700
const spikeMin = 685

console.log("Press CTRL-C to exit")

const action = function (msg, rinfo) {

  const sender = msg.shift()
  const length = msg.length

  // 8 -> time series
  // 6 -> band power
  // 126 -> fft

  // console.log(length)


  if (length == 8) {

    //console.log("time series")
    makeStats("time series")

    timeSeriesArray[timeSeriesArrayIndex] = msg[channel-1]

    avg = average(timeSeriesArray)
    //console.log(msg[channel-1], avg)

    var value = msg[channel-1]

    timeSeriesOut = [
      msg[channel-1] - avg,
    ]

    timeSeriesArrayIndex++
    if (timeSeriesArrayIndex >= timeSeriesAvgWindow) timeSeriesArrayIndex = 0

    if (timeSeriesOut!==0) {
      //console.log(/*average(timeSeriesArray), */timeSeriesOut[0])

      let max = timeSeriesOut[0]
      if ( max > spikeThresh && previousMax <= spikeThresh && previousMax > spikeMin) {
        //console.log("spike", max, previousMax)
        console.log("\007");
        makeStats("sent hspike")
        
        clientSpikeLocal.send(target, [1], function (a,b) {});             
        if (typeof clientSpikeRemote != "undefined") clientSpikeRemote.send(target, [1], function (a,b) {});             
      }

      if ( value*1.3 > avg ) { // max/2 > (avg>0 ? avg : 0) && max > 0 && avg > 0
        //console.log("headspike", value, avg )
        makeStats("sent headspike")
        
        clientHeadSpikeLocal.send(target, [1], function (a,b) {});             
        if (typeof clientHeadSpikeLocal != "undefined") clientHeadSpikeLocal.send(target, [1], function (a,b) {});             
      }


      previousMax = max
      makeStats("sent time series")
      if (typeof clientTimeSeriesLocal != "undefined") clientTimeSeriesLocal.send(target, timeSeriesOut, function () {});        
      if (typeof clientTimeSeriesRemote != "undefined") clientTimeSeriesRemote.send(target, timeSeriesOut, function () {});             
      timeSeriesOut = 0
    }
  }


  if (length == 6) {
    
    makeStats("band power")
    
    const inputChannel = msg.shift()
    if (inputChannel == channel) {
      for (const [index, b] of band.entries()) {
        bandOut[index] = msg[b-1]
      }
    }

    if (bandOut.every( b => b!==0)) {
      //console.log(out)
      makeStats("sent band power")
      /*if (typeof(bandMax)=="undefined")*/ bandMax = 0
      
      // console.log(bandOut)
      bandOut = bandOut.map(b => (b/3)>20 ? 20 : (b/3))
      
      bandMax = Math.max(...bandOut,bandMax)
      
      // console.log("bands:", bandOut)
      // console.log("band max:", bandMax)
      clientBandLocal.send(target, bandOut, function () {});        
      if (typeof clientBandRemote != "undefined") clientBandRemote.send(target, bandOut, function () {});             
      bandOut = bandOut.fill(0)
    }

  }




  if (length == 126) {
    
    makeStats("fft")

    const inputChannel = msg.shift()
    if (inputChannel == channel) {
      fftMaxPower = Math.max(...msg)
      fftMainIndex = msg.indexOf(Math.max(...msg));
      fftMainBoth = Math.max(msg.map( (p,i) => ( p*parseFloat(i) ) ))
      fftMain = fftMainIndex
    }

    if (fftMain !==0) {
      // console.log(fftMain)
      makeStats("sent fft main")
      if (typeof clientFftMainLocal != "undefined") clientFftMainLocal.send(target, fftMain, function () {});        
      if (typeof clientFftMainRemote != "undefined") clientFftMainRemote.send(target, fftMain, function () {});             
      fftMain = 0
    }

  }
}


oscServer.on("message", action)
oscServer2.on("message", action)
oscServer3.on("message", action)

let stats = {}

makeStats = (type) => {
  if (!stats[type]) {
    stats[type] = 0
  }
  stats[type]++
}

outputStats = () => {
  const ordered = {};
  Object.keys(stats).sort().forEach(function(key) {
    ordered[key] = stats[key] + "/s";
  });
  console.log(ordered)
  stats = {}
}

setInterval(outputStats, 1000)

var average = arr => arr.reduce( ( p, c ) => p + c, 0 ) / arr.length;

