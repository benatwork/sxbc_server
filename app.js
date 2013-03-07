var config = require('./config')(),
    express = require("express"),
    app = express(),
    Twit = require('twit'),
    mongo = require('mongodb'),
    io = require('socket.io'),
    _ = require('underscore'),
    _socket;


var allowCrossDomain = function (req, res, next) {
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    //res.header('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    res.header("Access-Control-Allow-Headers", "origin, x-requested-with, x-name, x-count, x-cursor, x-list-slug, content-type");
    // intercept OPTIONS method

    if ('OPTIONS' == req.method) {
        res.send(200);
    } else {
        next();
    }
};

//set active twitter account config obj
var activeTwitterAppConfig = config.twitterApps[1];

var twitInstances = [];

for (var i = 0; i < config.twitterApps.length; i++) {
    var appConfig = config.twitterApps[i];
    var twitInstance = new Twit(appConfig);
    twitInstances.push(twitInstance);
};
// var twit = new Twit(config.twitterApps[0]);
// var twit2 = new Twit(config.twitterApps[1]);



//configure express server
app.configure(function () {
    app.use(allowCrossDomain);
    app.use(express.bodyParser());
    app.use(app.router);
    app.use(express.errorHandler({
        dumpExceptions: true,
        showStack: true
    }));
});


//start server
var port = process.env.PORT || 3001;
var server = require('http').createServer(app);
server.listen(port);
console.log('sxbc server started on port ' + port);


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
var stream = twitInstances[0].stream('statuses/filter', { follow: twitterAccountIds});

//on connection to twitter stream
stream.on('connect', function (request) {
    console.log('connected to twitter streams: ',twitterAccountIds);
});

stream.on('tweet', function (tweet) {
    //send the tweet out to all connected websockets
    io.sockets.emit('tweet', tweet);
});
stream.on('delete', function (tweet) {
    io.sockets.emit('delete', tweet);
});





//connect to the mongo db
var mongo_uri = 'mongodb://heroku_app12779874:i3og9s4csabetbn8la6m0vt5uu@ds037907.mongolab.com:37907/heroku_app12779874';
var tweetCollection;

mongo.connect(mongo_uri, {}, function (error, db) {
    db.addListener("error", function (error) {
        console.log("Error connecting to MongoLab");
    });
    //create the mongo collection if it doesnt exist
    db.createCollection('tweets', function (err, collection) {
        db.collection('tweets', function (err, collection) {
            tweetCollection = collection;
            //db ready, init the websockets
        });
    });
});


initRoutes();

//init routes
function initRoutes() {


    //_____________ post tweet routes ______________________________________

    app.post('*', function (req, res) {
        var message = req.body.message;
        var serverID = parseInt(req.body.accountId,10);
        var ip = req.connection.remoteAddress;
        var wordFound = false;

        var regex = new RegExp('@', 'gi');
        message = message.replace(regex, '');
        //return error if @ is found
        if (message.match('@')) {
            res.json(403, customErrorMessage(403, "!! SORRY, NO @'s !!"));
            console.log('found an @');
            return;
        }
        //post the tweet
        console.log('begin POST ----------------------------------------------------------------');
        postTweet(serverID, message, req, res);
    });

    function postTweet(twitInstanceId, message, req, res) {
        
        var twitInstance = twitInstances[twitInstanceId] || twitInstances[0];

        twitInstance.post('statuses/update', { status: message }, function (err, reply) {
            if (err) {

                var twitterError = JSON.parse(err.data).errors[0];
                console.log(twitterError);

                // if the error has a particular twitter error code (like rate limit), try posting with another twit instance
                // otherwise return the error
                if(twitterError.code == 88){
                    newTwitInstanceId = twitInstanceId += 1;
                    if(newTwitInstanceId <= twitInstances.length-1) {
                        //rerun postTweet with new instance id
                        postTweet(newTwitInstanceId,message, req, res);
                    } else {
                        res.json(err.statusCode, {
                            error: err
                        });
                        return;
                    }
                } else {
                    res.json(err.statusCode, {
                        error: err
                    });
                }
                return;
            }

            console.log('posting with app ',twitInstanceId,' :: ',message);
            var tweetData = reply;
            res.json(200, {
                success: tweetData
            });

            //add tweet to the local db
            tweetCollection.insert(tweetData, function (error, result) {
                if (err) {
                    console.log('error adding to the db:' + message);
                    return;
                }
            });
        });
    }


    //_____________ get tweets routes ______________________________________

    //get tweets from a list
    app.get('/get_list_tweets', function (req, res) {
        getTweets(0,'lists/statuses', req, res);
    });

    // get tweets from a user
    app.get('/get_user_tweets', function (req, res) {
        getTweets(0,'statuses/user_timeline', req, res);
    });


    var count = 0;
    function getTweets(twitInstanceId,path, req, res) {
        count ++;
        //set the cursor if applicable
        var twitInstance = twitInstances[twitInstanceId] || twitInstances[0];
        var reqSettings = {
            owner_screen_name: req.headers['x-name'],
            screen_name: req.headers['x-name'],
            count: req.headers['x-count'],
            slug: req.headers['x-list-slug']
            //include_rts: 1
        };

        //set cursor if one is provided in headers
        if (req.headers['x-cursor']) reqSettings.max_id = req.headers['x-cursor'];

        

        //make the request
        twitInstance.get(path, reqSettings, function (err, reply) {
            if (err) {
                var twitterError = JSON.parse(err.data).errors[0];
                // if the error has a particular twitter error code (like rate limit), try getting with another twit instance
                // otherwise return the error
                console.log(twitterError);
                newTwitInstanceId = twitInstanceId += 1;
                if(newTwitInstanceId <= twitInstances.length-1) {
                    //rerun postTweet with new instance id
                    getTweets(newTwitInstanceId,path, req, res);
                } else {

                    res.json(err.statusCode, {
                        error: err
                    });
                }
                return;
            }
            console.log(count,':get using app:',twitInstanceId);
            res.json(200, reply);
        });

    }



    //_____________ rate limit routes ______________________________________

    app.get('/rate_limits', getRates);
    app.get('/rate_limits/:path1', getRates);
    app.get('/rate_limits/:path1/:path2', getRates);
    function getRates(req,res){
        processRates(req.params.path1,req.params.path2,res);
    }

    function processRates(path1,path2, res, callback) {
        twitInstances[0].get('application/rate_limit_status', function (err, reply) {
            if (err) {
                var twitterError = JSON.parse(err.data).errors[0];
                res.json(err.statusCode, err.twitterReply);
                return;
            }
            var resources = reply.resources;

            if (path1 && path1) {
                var section = resources[path1];
                var selector = '/' + path1 + '/' + path2;
                var data = section[selector];
                var utcSeconds = data.reset;
                var now = new Date();
                var d = new Date(0);
                d.setUTCSeconds(utcSeconds);
                data.resetTime = d;
                var difTime = new Date(d.getTime() - now.getTime());
                data.timeTilReset = difTime.getMinutes() + ':' + difTime.getSeconds();
                if(res) {
                    res.json(200, data);
                } else {
                    callback(data);
                }
                return;
            } else if (path1) {
                if(res) {
                    res.json(200, resources[path1]);
                } else {
                    callback(data);
                }
                return;
            }

            if(res) {
                res.json(200, reply);
            } else {
                callback(data);
            }
        });
    }


    //_____________ db routes ______________________________________


    //get database contents
    app.get('/db', function (req, res) {
        tweetCollection.find().toArray(function (err, items) {
            res.json(200, items);
        });
    });

}

function formatRateLimitTime(resetTime) {

}

function customErrorMessage(code, message) {
    return {
        "error": {
            "data": "{\"errors\":[{\"code\":" + code + ",\"message\":\"" + message + "\"}]}",
            "statusCode": code,
            "statusText": message
        }
    };
}