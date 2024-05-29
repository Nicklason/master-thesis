const fs = require("fs");
const { v4 } = require("uuid");
const graph = require("./graph.js");
const { DirectedGraph, DirectedVertex, DirectedEdge } = require("graph-typed");
const Redis = require("ioredis");

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

localGraph.addVertex(new DirectedVertex(localId));

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

  if (isSeen) {
    return;
  }

  console.log(`Received new message from channel ${channel}: ${message}`);

  const source = parsed.source;

  if (localGraph.getVertex(source) === undefined) {
    localGraph.addVertex(new DirectedVertex(source));
  }

  if (channel === "network") {
    if (parsed.data.type === "connection-ready") {
      const host = parsed.data.node;

      if (localGraph.getVertex(host) === undefined) {
        localGraph.addVertex(new DirectedVertex(host));
      }

      if (localGraph.getEdge(source, host) === undefined) {
        localGraph.addEdge(new DirectedEdge(source, host, 1));
      }
    } else if (parsed.data.type === "connection-closed") {
      const host = parsed.data.node;

      if (localGraph.getVertex(host) === undefined) {
        localGraph.addVertex(new DirectedVertex(host));
      }

      if (localGraph.getEdge(source, host) !== undefined) {
        localGraph.deleteEdge(source, host);
      }
    } else if (parsed.data.type === "ping") {
      if (localGraph.getEdge(source, localId) === undefined) {
        localGraph.addEdge(new DirectedEdge(source, localId, 1));
      }

      // Respond with pong
      directMessage(source, "network", v4(), {
        type: "pong",
        time: parsed.data.time,
      });
    } else if (parsed.data.type === "pong") {
      // Calculate latency
      let latency = new Date().getTime() - parsed.data.time;
      latency = 1;

      if (localGraph.getVertex(source) === undefined) {
        localGraph.addVertex(new DirectedVertex(source));
      }

      if (localGraph.getEdge(source, localId) === undefined) {
        // We don't know the latency from the other node to us
        localGraph.addEdge(new DirectedEdge(source, localId, 1));
      }

      if (localGraph.getEdge(localId, source) === undefined) {
        localGraph.addEdge(new DirectedEdge(localId, source, latency));
      } else {
        localGraph.getEdge(localId, source).weight = latency;
      }
    } else if (parsed.data.type === "connected-nodes") {
      // Remove all edges from source
      localGraph.outgoingEdgesOf(source).forEach((edge) => {
        localGraph.deleteEdge(edge.src, edge.dest);
      });

      parsed.data.nodes.forEach((node) => {
        const host = node.node;
        const latency = node.latency;

        if (localGraph.getVertex(host) === undefined) {
          localGraph.addVertex(new DirectedVertex(host));
        }

        localGraph.addEdge(new DirectedEdge(source, host, latency));
      });
    }
  }

  if (parsed.type === "broadcast") {
    broadcastMessage(channel, parsed.id, parsed.data, parsed.source);
  } else if (parsed.type === "direct") {
    // directMessage(parsed.target, channel, parsed.id, parsed.data);
  }
});

const logging = setInterval(() => {
  /*console.log(localGraph.bellmanFord(localId));
  console.log(localGraph.edgeSet());
  console.log(localGraph.edgeSet().length);*/

  console.log(localGraph.bellmanFord(localId));
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

    broadcastMessage(
      "network",
      v4(),
      {
        type: "connection-ready",
        node: remoteId,
        time: new Date().getTime(),
      },
      localId,
    );
  });

  r.on("close", () => {
    const previouslyReady = remoteReady.has(remoteId);
    remoteReady.delete(remoteId);
    if (!previouslyReady) {
      return;
    }

    console.log("Connection to remote node " + remoteId + " closed");

    // Remove edge to this node
    localGraph.deleteEdge(localId, remoteId);

    // TODO: If there are now multiple components, then remove the edges from the components that we can't reach

    broadcastMessage(
      "network",
      v4(),
      {
        type: "connection-closed",
        node: remoteId,
        time: new Date().getTime(),
      },
      localId,
    );
  });

  r.on("error", () => {
    // Do nothing
  });
});

const publishTimeouts = new Map();

function publishMessage(r, channel, message) {
  seenIds.set(message.id, new Date());

  const remoteId = getIdFromHost(r.options.host);

  // Add artificial delay based on edge weight
  const edge = graph.getEdge(localId, remoteId);

  let delay = 0;
  if (edge) {
    delay = Math.random() * edge.weight ** 2;
  }

  const timeoutKey = remoteId + "_" + message.id;

  const timeout = setTimeout(() => {
    r.publish(channel, JSON.stringify(message)).catch(() => {
      // Do nothing
    });
    publishTimeouts.delete(timeoutKey);
  }, delay);

  publishTimeouts.set(timeoutKey, timeout);
}

function broadcastMessage(channel, id, data, source) {
  const message = {
    id,
    type: "broadcast",
    data,
    source,
  };

  remote.forEach((r) => {
    publishMessage(r, channel, message);
  });
}

function directMessage(target, channel, id, data) {
  // TODO: Target can only be a connected node. Use path finding to route message
  const r = remote.find((r) => getIdFromHost(r.options.host) === target);

  if (!r) {
    return;
  }

  const message = {
    id,
    type: "direct",
    data,
    source: localId,
    target,
  };

  publishMessage(r, channel, message);
}

// TODO: Remove nodes that do not respond to ping messages

const pingInterval = setInterval(() => {
  // TODO: Send ping message to connected nodes (not broadcast, direct message)
  /*publishMessage("network", v4(), {
    type: "ping",
    time: new Date().getTime(),
  });*/

  // Go through all nodes and check if they are still connected

  remote.forEach((r) => {
    // TODO: Check if we received ping within double the ping interval
    directMessage(getIdFromHost(r.options.host), "network", v4(), {
      type: "ping",
      time: new Date().getTime(),
    });
  });

  // Broadcast connected nodes based on our graph
  const outNodes = localGraph.outgoingEdgesOf(localId).map((edge) => {
    return { node: edge.dest, latency: edge.weight };
  });

  broadcastMessage(
    "network",
    v4(),
    {
      type: "connected-nodes",
      nodes: outNodes,
    },
    localId,
  );
}, 1000);

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
