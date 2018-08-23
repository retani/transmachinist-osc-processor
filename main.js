var osc = require('node-osc');

var oscServer = new osc.Server(12345, '127.0.0.1'); // listen time series
var oscServer2 = new osc.Server(12346, '127.0.0.1'); // listen fft
var oscServer3 = new osc.Server(12347, '127.0.0.1'); // listen band power

var clientTimeSeriesLocal = new osc.Client('127.0.0.1', 6448); //send
//var clientTimeSeriesRemote = new osc.Client('192.168.1.104', 8000); //send

var clientSpikeLocal = new osc.Client('127.0.1.1', 8001); //send
//var clientSpikeRemote = new osc.Client('192.168.1.104', 8001); //send

var clientBandLocal = new osc.Client('127.0.0.1', 8000); //send
//var clientBandRemote = new osc.Client('192.168.1.104', 8000); //send

// var clientFftMainLocal = new osc.Client('127.0.0.1', 6450); //send
// var clientFftMainRemote = new osc.Client('192.168.5.106', 6450); //send


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

    timeSeriesOut = [
      msg[channel-1] - average(timeSeriesArray),
    ]

    timeSeriesArrayIndex++
    if (timeSeriesArrayIndex >= timeSeriesAvgWindow) timeSeriesArrayIndex = 0

    if (timeSeriesOut!==0) {
      //console.log(/*average(timeSeriesArray), */timeSeriesOut[0])

      let max = timeSeriesOut[0]
      if ( max > spikeThresh && previousMax <= spikeThresh && previousMax > spikeMin) {
        console.log("spike", max, previousMax)
        console.log("\007");
        
        clientSpikeLocal.send(target, [1], function (a,b) {});             
        if (typeof clientSpikeRemote != "undefined") clientSpikeRemote.send(target, [1], function (a,b) {});             
      }

      previousMax = max
      makeStats("sent time series")
      clientTimeSeriesLocal.send(target, timeSeriesOut, function () {});        
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

