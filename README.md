The node.js server for www.sxbackchannel.com 

Connects to client via websockets. Recieves text messages from the client, then sends them to twitter and logs them 
in a mongo db. Responses from twitter are passed back to the client. Also provides a few endpoints for viewing stats.
