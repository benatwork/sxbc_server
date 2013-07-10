The node.js server for www.sxbackchannel.com 

Runs on Heroku. Connects to client via websockets. Recieves text input from the client, then validates and sends them to twitter and logs themin a mongo db. Responses from twitter are passed back to the client. Also provides a few endpoints for viewing stats.

todo: add endpoints to readme
