# Second prototype

The second prototype creates a network and keeps track of the topology using broadcast messages.

Two versions exist:

* app-1.js - Broadcast messages, broadcast and react to changes in topology.
* app-2.js - Builds on top of app-1.js but adds pings and tries to better make sure the local topology is up to date.

Both versions shows messages being broadcast, handling duplicated messages, and creating a local copy of the network.

To run, first rename one of the versions to app.js. Then build an image using the Dockerfile and tag it "connector" and run the generate-docker-compose.js script to generate docker compose manifest file. Then the docker compose manifest file can be used to start the system.
