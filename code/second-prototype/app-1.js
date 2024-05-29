const Redis = require("ioredis");
const fs = require("fs");
const { v4 } = require("uuid");
const graph = require("./graph.js");
const { DirectedGraph, DirectedVertex, DirectedEdge } = require("graph-typed");

const localId = process.env.NODE_ID;

let remoteIds = [];

if (!fs.existsSync("/data/remote-ids.txt")) {
  remoteIds = process.env.CONNECTED_NODES.split(",");
  // Save ids to file
  fs.writeFileSync("/data/remote-ids.txt", remoteIds.join(","));
} else {
  remoteIds = fs.readFileSync("/data/remote-ids.txt", "utf8").split(",");
}

const localGraph = new DirectedGraph();

const local = new Redis({
  host: `redis-${localId}`,
  port: 6379,
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
});

const seenIds = new Map();

const garbageInterval = setInterval(() => {
  // Remove old ids from map
  const now = new Date();

  for (const [id, date] of seenIds.entries()) {
    if (now - date > 10000) {
      seenIds.delete(id);
    }
  }
}, 5000);

local.on("message", (channel, message) => {
  const parsed = JSON.parse(message);
  const isSeen = seenIds.has(parsed.id);
  seenIds.set(parsed.id, new Date());

  if (true) {
    // Update graph
    const parsed = JSON.parse(message);

    // Loop through route of the message
    for (let i = 0; i < parsed.route.length; i++) {
      const source = parsed.route[i];
      const destination =
        parsed.route.length - 1 === i ? localId : parsed.route[i + 1];

      if (localGraph.getVertex(source) === undefined) {
        localGraph.addVertex(new DirectedVertex(source));
      }

      if (localGraph.getVertex(destination) === undefined) {
        localGraph.addVertex(new DirectedVertex(destination));
      }

      if (localGraph.getEdge(source, destination) === undefined) {
        localGraph.addEdge(new DirectedEdge(source, destination, 1));
      }
    }

    if (channel === "network") {
      const type = parsed.data.type;
      const source = parsed.source;
      const host = parsed.data.node;

      if (localGraph.getVertex(source) === undefined) {
        localGraph.addVertex(new DirectedVertex(source));
      }

      if (localGraph.getVertex(host) === undefined) {
        localGraph.addVertex(new DirectedVertex(host));
      }

      if (type === "connection-ready") {
        if (localGraph.getEdge(source, host) === undefined) {
          localGraph.addEdge(new DirectedEdge(source, host, 1));
        }
      } else if (type === "connection-closed") {
        if (localGraph.getEdge(source, host) !== undefined) {
          localGraph.deleteEdge(source, host);
        }
      }
    }
  }

  if (isSeen) {
    return;
  }

  console.log(`Received new message from channel ${channel}: ${message}`);

  publishMessage(channel, parsed.id, parsed.data, parsed.route);
});

const logging = setInterval(() => {
  /*console.log(localGraph.bellmanFord(localId));
  console.log(localGraph.edgeSet());
  console.log(localGraph.edgeSet().length);*/
}, 2000);

const remote = remoteIds.map((remoteId) => {
  return new Redis({
    host: `redis-${remoteId}`,
    port: 6379,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
  });
});

local.on("ready", () => {
  console.log("Connection to local node established");
  local.subscribe("heartbeat", () => {});
  local.subscribe("network", () => {});
});

local.on("close", () => {
  console.log("Connection to local node closed");
});

local.on("error", () => {
  // Do nothing
});

function getIdFromHost(host) {
  return host.split("-")[1];
}

const remoteReady = new Set();

remote.forEach((r) => {
  const remoteId = getIdFromHost(r.options.host);
  r.on("ready", () => {
    const previouslyReady = remoteReady.has(remoteId);
    remoteReady.add(remoteId);
    if (previouslyReady) {
      return;
    }

    console.log("Connection to remote node " + remoteId + " established");

    publishMessage("network", v4(), {
      type: "connection-ready",
      node: remoteId,
      time: new Date().getTime(),
    });
  });

  r.on("close", () => {
    const previouslyReady = remoteReady.has(remoteId);
    remoteReady.delete(remoteId);
    if (!previouslyReady) {
      return;
    }

    console.log("Connection to remote node " + remoteId + " closed");

    publishMessage("network", v4(), {
      type: "connection-closed",
      node: remoteId,
      time: new Date().getTime(),
    });
  });

  r.on("error", () => {
    // Do nothing
  });
});

const publishTimeouts = new Map();

function publishMessage(channel, id, data, route = []) {
  seenIds.set(id, new Date());

  route.push(localId);

  const message = JSON.stringify({ id, data, source: route[0], route });

  remote.forEach((r) => {
    const remoteId = r.options.host.split("-")[1];

    // Add artificial delay based on edge weight
    const edge = graph.getEdge(localId, remoteId);

    let delay = 0;
    if (edge) {
      delay = Math.random() * edge.weight ** 2;
    }

    const timeoutKey = remoteId + "_" + id;

    const timeout = setTimeout(() => {
      r.publish(channel, message).catch(() => {
        // Do nothing
      });
      publishTimeouts.delete(timeoutKey);
    }, delay);

    publishTimeouts.set(timeoutKey, timeout);
  });
}

const pingInterval = setInterval(() => {
  publishMessage("heartbeat", v4(), { hello: "world" });
}, 10000);

process.on("SIGTERM", () => {
  console.log("Stopping...");

  clearInterval(garbageInterval);
  clearInterval(pingInterval);
  clearInterval(logging);

  publishTimeouts.forEach((timeout) => {
    clearTimeout(timeout);
  });

  local.quit();
  remote.forEach((r) => {
    r.quit();
  });
});
