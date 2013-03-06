

//config.js
config = {
    twitterApps:[
		{
			name:'SXBackChannel',
			id:"1145788693",
			consumerKey:'PryPxesQscYFUx9NahNFFg',
			consumerSecret:'qKWPyqsopMi0cP1cHG1RWeVTMpzhlzEyOC52YfzqIe0',
			accessToken:'1145788693-XaqqH06lzZ0VyUAWwqMoPOhItUie1RLxB5FEJ7J',
			accessSecret:'iCtcmJichJTsHiOINdpGZkOgncbsJB1xIM52p9mPvQ'
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