

//config.js
config = {
    twitterApps:[
		{
			name:'SXBackChannel',
			id:"1145788693",
			consumer_key:'PryPxesQscYFUx9NahNFFg',
			consumer_secret:'qKWPyqsopMi0cP1cHG1RWeVTMpzhlzEyOC52YfzqIe0',
			access_token:'1145788693-XaqqH06lzZ0VyUAWwqMoPOhItUie1RLxB5FEJ7J',
			access_token_secret:'iCtcmJichJTsHiOINdpGZkOgncbsJB1xIM52p9mPvQ'
		},{
			name:'SXBackChannel2',
			id:"1247403062",
			consumer_key:'mT7KXQYzPEbZQrS4xkxew',
			consumer_secret:'0bnrtHPe1P0W5y4XKoa95dVyPQSmL0cRINOynhfUFU',
			access_token:'1247403062-p3Y9Ibfzonxqkap20e9kAbLOzFkqWhPpkRPkvp7',
			access_token_secret:'AIJSEx67t7s8jJX9YRJkXFmkZnXNN2JhZPOAUFViW5I'
		}
    ],
    allowedDomains:[
		'http://localhost',
		'http://sxbackchannel.com'
    ]
};





if( typeof module !== "undefined" && ('exports' in module)){
    module.exports = function(){return config;};
} else {
    callback( config );
}