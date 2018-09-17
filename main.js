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
    port: 49342,
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

/**** START TRANSMISSIONS ****/

conf = confSend["time series"]
if (conf.active) {
  var clientTimeSeriesLocal = new osc.Client(conf.host, conf.port); //send
}

conf = confSend["spikes"]
if (conf.active) {
  var clientSpikeLocal = new osc.Client(conf.host, conf.port); //send
}

conf = confSend["headspikes"]
if (conf.active) {
  var clientHeadSpikeLocal = new osc.Client(conf.host, conf.port); //send
}

conf = confSend["adjusted bands"]
if (conf.active) {
  var clientBandLocal = new osc.Client(conf.host, conf.port); //send
}

// var clientFftMainLocal = new osc.Client('127.0.0.1', 6450); //send
// var clientFftMainRemote = new osc.Client('192.168.5.106', 6450); //send


/**** SETUP ****/

//const source = "/openbci"
const target = "/wek/inputs"

const channelOrder = [1,2,3,4,5,6,7,8];
let channel = channelOrder[0];
const band = [1,2,3,4,5];

const timeSeriesAvgWindow = 100 // 1 sec = 250

let timeSeriesArray = new Array(timeSeriesAvgWindow)
let timeSeriesArrayIndex = 0

let timeSeriesOut = 0
let bandOut = new Array(band.length).fill(0)
let fftMain = 0

let channelActivity = {}
let activeChannels = {}

let avg = 0

let previousMax = 0

const spikeThresh = 700
const spikeMin = 685

console.log("Press CTRL-C to exit")

/**** PROCESS INPUT ****/

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
    
    // console.log(msg[channel-1], avg)
    // console.log(avg)

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
        // console.log("\007");
        makeStats("sent spike")
        
        clientSpikeLocal.send(target, [1], function (a,b) {});             
        if (typeof clientSpikeRemote != "undefined") clientSpikeRemote.send(target, [1], function (a,b) {});             
      }

      if ( value*1.3 > avg ) { // max/2 > (avg>0 ? avg : 0) && max > 0 && avg > 0
        //console.log("headspike", value, avg )
        
        if (typeof(clientHeadSpikeLocal) != "undefined") {
          makeStats("sent headspike")
          clientHeadSpikeLocal.send(target, [1], function (a,b) {
          });             
        }
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

    // console.log(msg)
    
    const inputChannel = msg.shift()

    channelActivity[inputChannel] = (msg[0] + msg[1] + msg[2] + msg[3] + (channelActivity[inputChannel] || 0)) / 2

    if (inputChannel == channel) {
      for (const [index, b] of band.entries()) {
        bandOut[index] = msg[b-1]
      }
    }

    if (bandOut.every( b => b !== 0)) {
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
  console.log("stats", ordered)
  // stats = {}
  for (let i in stats) {
    stats[i] = "-"
  }
}

outputInfo = () => {
  const info = {
    channel
  }

  console.log("info", info)
}

outputData = () => { // output everything

  process.stdout.write('\033c');
  process.stdout.write('\x1Bc');

  outputConfig()
  console.log()
  
  outputInfo()
  console.log()
  
  outputStats()

}

outputConfig = () => {
  console.log("Listening to:")
  for (let x in confListen) {
    console.log(`  ${confListen[x].host}:${confListen[x].port} - ${x}`)
  }
  
  console.log("Sending to:")
  for (let x in confSend) {
    console.log(`  ${confSend[x].host}:${confSend[x].port} - ${x}`)
  }  
}

cycleChannel = () => {
  if (channel < 8) channel = channel+1
  else channel = 1
}

chooseChannel = () => {
  for (let c in channelActivity) {
    const value = channelActivity[c]
    //console.log(c, value)
    activeChannels[c] =  value > 0.2
  }

  // console.log(activeChannels)

  for (let c of channelOrder) {
    if (activeChannels[c]) {
      channel = c;
      break;
    }
  }
}

setInterval(outputData, 1000)
setInterval(chooseChannel, 500)


var average = arr => arr.reduce( ( p, c ) => p + c, 0 ) / arr.length;
