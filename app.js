var express = require("express"),
  app = express(),
  Twit = require('twit'),
  pg = require('pg');

var acceptedWords = [
  "Hot",
  "Sexy",
  "Love",
  "Amazing",
  "Kiss",
  "Handsome",
  "Pretty",
  "Whoa",
  "Adorable",
  "beautiful",
  "Cute"
];


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


//connect to postgres db
var client = new pg.Client(process.env.DATABASE_URL);
client.connect(function(err) {
  client.query('SELECT NOW() AS "theTime"', function(err, result) {
      console.log(result.rows[0].theTime);
      //output: Tue Jan 15 2013 19:12:47 GMT-600 (CST)
  });
});


//get from https://dev.twitter.com/apps/
var TWITTER_CONSUMER_KEY = 'PryPxesQscYFUx9NahNFFg';
var TWITTER_CONSUMER_SECRET = 'qKWPyqsopMi0cP1cHG1RWeVTMpzhlzEyOC52YfzqIe0';
var TWITTER_ACCESS_TOKEN = '1145788693-XaqqH06lzZ0VyUAWwqMoPOhItUie1RLxB5FEJ7J';
var TWITTER_ACCESS_SECRET = 'iCtcmJichJTsHiOINdpGZkOgncbsJB1xIM52p9mPvQ';

var twit = new Twit({
  consumer_key: TWITTER_CONSUMER_KEY,
  consumer_secret:      TWITTER_CONSUMER_SECRET,
  access_token:         TWITTER_ACCESS_TOKEN,
  access_token_secret:  TWITTER_ACCESS_SECRET
});

app.configure(function(){
  app.use(allowCrossDomain);
  app.use(express.bodyParser());
  app.use(app.router);
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

//start server
var port = process.env.PORT || 3001;
app.listen(port);
console.log('sxbc server started on port '+port);


//post route
app.post('*', function(req, res){
  var message = req.body.message;
  var ip = req.connection.remoteAddress;
  var wordFound = false;

  console.log('ip:'+ip+' - '+message);

  if(message.match('@')){
    res.json(403,{
      "error":{
        "data":"{\"errors\":[{\"code\":403,\"message\":\"We were forced to disable the (at) function by Twitter, party poopers. Sorry\"}]}",
        "statusCode":403
      }
    });
    return;
  }
  
  // for (var i = 0; i < acceptedWords.length; i++) {
  //   var word = acceptedWords[i].toLowerCase();
  //   if(message.toLowerCase().match(word)){
  //     wordFound = true;
  //   }
  // }
  
  // if(!wordFound){
  //   res.json(400,{
  //     "error":{
  //       "data":"{\"errors\":[{\"code\":400,\"message\":\"Your love is denied, try again\"}]}",
  //       "statusCode":400
  //     }
  //   });
  //   return;
  // }


  twit.post('statuses/update', { status: message}, function(err, reply) {
    if(err) {
      console.log(err.statusCode);
      res.json(err.statusCode,{error:err});
      console.log('twitter error:'+message);
      return;
    }
    console.log('Server:'+req.connection.remoteAddress+' Tweeted:'+message);
    res.json(200,{success:reply});
  });
});




//gets
app.get('/followers',function(req,res){
  twit.get('followers/ids', { screen_name: 'canttweetthis_' },  function (err, reply) {
    res.send(reply);
  });
});

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



function getTweets(req,res,reqSettings){
  twit.get('statuses/user_timeline', reqSettings,  function (err, reply) {

    if(err) {
      res.json(500,err.twitterReply);
      console.log(err);
      return;
    }

    // var messages = [];
    // for (var i = 0; i < reply.length; i++) {
    //   messages.push(reply[i].text);
    // }
    res.json(200,reply);
  });
}



