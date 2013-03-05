var express = require("express"),
  app = express(),
  Twit = require('twit'),
  mongo = require('mongodb'),
  io = require('socket.io'),
  _socket;



var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    //res.header('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    res.header("Access-Control-Allow-Headers", "origin, x-requested-with, content-type");
     // intercept OPTIONS method

    if ('OPTIONS' == req.method) {
      res.send(200);
    } else{
      next();
    }
};

//twitter credentials
//get from https://dev.twitter.com/apps/
var TWITTER_CONSUMER_KEY = 'PryPxesQscYFUx9NahNFFg';
var TWITTER_CONSUMER_SECRET = 'qKWPyqsopMi0cP1cHG1RWeVTMpzhlzEyOC52YfzqIe0';
var TWITTER_ACCESS_TOKEN = '1145788693-XaqqH06lzZ0VyUAWwqMoPOhItUie1RLxB5FEJ7J';
var TWITTER_ACCESS_SECRET = 'iCtcmJichJTsHiOINdpGZkOgncbsJB1xIM52p9mPvQ';

//init twitter middleware
var twit = new Twit({
  consumer_key: TWITTER_CONSUMER_KEY,
  consumer_secret:      TWITTER_CONSUMER_SECRET,
  access_token:         TWITTER_ACCESS_TOKEN,
  access_token_secret:  TWITTER_ACCESS_SECRET
});

//configure express server
app.configure(function(){
  app.use(allowCrossDomain);
  app.use(express.bodyParser());
  app.use(app.router);
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});


//setup mongodb
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
      io.sockets.on('connection', function (socket) {
        _socket = socket;
        //websockets ready, init routes
        
      });
      initRoutes();

      
    });
  });
});



// start the twitter stream
var stream = twit.stream('user');
stream.on('tweet', function (tweet) {
  console.log(tweet);
});


//start server
var port = process.env.PORT || 3001;
var server = require('http').createServer(app);
var io = io.listen(server);
server.listen(port);
console.log('sxbc server started on port '+port);





//init routes
function initRoutes(){

  app.post('*', function(req, res){
    var message = req.body.message;
    var ip = req.connection.remoteAddress;
    var wordFound = false;

    //return error if @ is found
    if(message.match('@')){
      res.json(403,customErrorMessage(403,'We were forced to disable the (at) function by Twitter, party poopers'));
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

      //send tweetdata back to client over websocket for instant rendering
      _socket.volatile.emit('tweet', tweetData);

      //add tweet to the local db
      tweetCollection.insert(tweetData, function(error, result){
        if(err) {
          res.json(err.statusCode,{error:err});
          console.log('twitter error:'+message);
          return;
        }
        // tweetCollection.find().toArray(function(err, items) {
        //   console.log(items);
        // });
        res.json(200,{success:result});
      });
    });
  });


  //gets
  app.get('/tweets/:count/:cursor',function(req,res){
    var cursor = req.params.cursor || null;
    var reqSettings = {
      screen_name: 'b3nroth',
      count:req.params.count,
      max_id:cursor
    };
    getTweets(req,res,reqSettings);
  });
  app.get('/tweets/:count',function(req,res){
    var reqSettings = {
      screen_name: 'b3nroth',
      count:req.params.count
    };
    getTweets(req,res,reqSettings);
  });

  app.get('/db',function(req,res){
    tweetCollection.find().toArray(function(err, items) {
      res.json(200,items);
    });
  });
};




function getTweets(req,res,reqSettings){
  twit.get('statuses/user_timeline', reqSettings,  function (err, reply) {
    if(err) {
      res.json(500,err.twitterReply);
      console.log(err);
      return;
    }
    res.json(200,reply);
  });
}


function customErrorMessage(code,message){
  return {
    "error":{
      "data":"{\"errors\":[{\"code\":"+code+",\"message\":\""+message+"\"}]}",
      "statusCode":code
    }
  }
}




