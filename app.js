var config = require('./config')(),
  express = require("express"),
  app = express(),
  Twit = require('twit'),
  mongo = require('mongodb'),
  io = require('socket.io'),
  _ = require('underscore'),
  _socket;


var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    //res.header('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    res.header("Access-Control-Allow-Headers", "origin, x-requested-with, x-name, x-count,x-cursor, content-type");
     // intercept OPTIONS method

    if ('OPTIONS' == req.method) {
      res.send(200);
    } else{
      next();
    }
};

//set active twitter account config obj
var activeTwitterAppConfig = config.twitterApps[0];


var twit = new Twit({
  consumer_key:         activeTwitterAppConfig.consumerKey,
  consumer_secret:      activeTwitterAppConfig.consumerSecret,
  access_token:         activeTwitterAppConfig.accessToken,
  access_token_secret:  activeTwitterAppConfig.accessSecret
});

//configure express server
app.configure(function(){
  app.use(allowCrossDomain);
  app.use(express.bodyParser());
  app.use(app.router);
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});




//start server
var port = process.env.PORT || 3001;
var server = require('http').createServer(app);
server.listen(port);
console.log('sxbc server started on port '+port);




//start the websocket listener
var io = io.listen(server);
// Workaround for Heroku not supporting true websockets
// https://devcenter.heroku.com/articles/using-socket-io-with-node-js-on-heroku
io.configure(function () {
  io.set("transports", ["xhr-polling"]);
  io.set("polling duration", 10);
});
//reduce socket.io logs
io.set('log level', 1);


//get list of twitter id's to watch from the config
var twitterAccountIds = [];
for (var i = 0; i < config.twitterApps.length; i++) {
  var appConfig = config.twitterApps[i];
  twitterAccountIds.push(appConfig.id);
}

//connect to twitter stream
var stream = twit.stream('statuses/filter',{follow:twitterAccountIds});

//on connection to twitter stream
stream.on('connect',function(request){
  console.log('connected to twitter stream');
});

stream.on('tweet', function (tweet) {
  //send the tweet out to all connected websockets
  io.sockets.emit('tweet', tweet);
});





//connect to the mongo db
var mongo_uri = 'mongodb://heroku_app12779874:i3og9s4csabetbn8la6m0vt5uu@ds037907.mongolab.com:37907/heroku_app12779874';
var tweetCollection;

mongo.connect(mongo_uri, {}, function(error, db){
  db.addListener("error", function(error){
    console.log("Error connecting to MongoLab");
  });
  //create the mongo collection if it doesnt exist
  db.createCollection('tweets', function(err, collection){
    db.collection('tweets', function(err, collection){
      tweetCollection = collection;
      //db ready, init the websockets

    });
  });
});



initRoutes();

//init routes
function initRoutes(){

  app.post('*', function(req, res){
    var message = req.body.message;
    var ip = req.connection.remoteAddress;
    var wordFound = false;

    //return error if @ is found
    if(message.match('@')){
      res.json(403,customErrorMessage(403,"Sorry, no @'s"));
      return;
    }

    //post the tweet
    twit.post('statuses/update', { status: message}, function(err, reply) {
      if(err) {
        res.json(err.statusCode,{error:err});
        console.log('twitter error:'+message);
        return;
      }

      var tweetData = reply;
      res.json(200,{success:tweetData});

      //add tweet to the local db
      tweetCollection.insert(tweetData, function(error, result){
        if(err) {
          console.log('error adding to the db:'+message);
          return;
        }
      });

    });
  });


  app.get('/get_tweets',function(req,res){
    //get request settings from headers
    var reqSettings = {
      screen_name: req.headers['x-name'],
      count: req.headers['x-count']
    };
    //get the cursor to use as max_id
    if(req.headers['x-cursor']) reqSettings.max_id = req.headers['x-cursor'];

    twit.get('statuses/user_timeline', reqSettings,  function (err, reply) {
      if(err) {
        var twitterError = JSON.parse(err.data).errors[0];
        if(err.statusCode == 429 && twitterError.code == 88){
          console.log('rate limit!!!!');
          res.json(err.statusCode,err);
          return;
        }
        res.json(err.statusCode,err.twitterReply);
        console.log(err);
        return;
      }
      res.json(200,reply);
    });
  });

  //get database contents
  app.get('/db',function(req,res){
    tweetCollection.find().toArray(function(err, items) {
      res.json(200,items);
    });
  });
};


function customErrorMessage(code,message){
  return {
    "error":{
      "data":"{\"errors\":[{\"code\":"+code+",\"message\":\""+message+"\"}]}",
      "statusCode":code,
      "statusText":message
    }
  }
}




