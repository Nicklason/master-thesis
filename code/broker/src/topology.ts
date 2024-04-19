import { DirectedGraph, DirectedVertex } from "graph-typed";
import fs from "fs";
import { LinkChange, LinkState, Node } from "./messages/message";

interface DecodedTopology {
  nodes: Node[];
  edges: LinkChange[];
}

export class Topology {
  private readonly graph: DirectedGraph = new DirectedGraph();
  private readonly changes: Map<String, LinkChange> = new Map();

  constructor(ourId?: Node) {
    if (ourId !== undefined) {
      this.addNode(ourId);
    }
  }

  static fromFile(filePath: string, ourId?: Node): Topology {
    const topology = new Topology(ourId);

    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");

      const parsed = JSON.parse(raw) as DecodedTopology;

      parsed.nodes.forEach((node) => topology.addNode(node));
      parsed.edges.forEach((change) => topology.addLinkChange(change));
    }

    return topology;
  }

  addLinkChange(change: LinkChange): void {
    // Create unique key for the change
    const key = `${change.source}-${change.target}`;

    const existing = this.changes.get(key);
    if (existing && existing.timestamp > change.timestamp) {
      // Existing change is older than the provided change. Ignore it.
      return;
    }

    // Save the change
    this.changes.set(key, change);

    switch (change.state) {
      case LinkState.UP:
        this.addEdge(change.source, change.target);
        break;
      case LinkState.DOWN:
        this.removeEdge(change.source, change.target);
        break;
    }
  }

  addNode(node: number): void {
    if (this.graph.hasVertex(node)) {
      return;
    }

    this.graph.addVertex(new DirectedVertex(node));
  }

  private addEdge(from: number, to: number): void {
    this.addNode(from);
    this.addNode(to);

    if (this.graph.hasEdge(from, to)) {
      return;
    }

    this.graph.addEdge(from, to);
  }

  private removeEdge(from: number, to: number): void {
    if (!this.graph.hasEdge(from, to)) {
      return;
    }

    this.graph.deleteEdge(from, to);
  }

  toJSON(): DecodedTopology {
    const nodes: Node[] = [];

    this.graph.vertexMap.forEach((vertex) => {
      nodes.push(vertex.key as Node);
    });

    return {
      nodes,
      edges: Array.from(this.changes.values()),
    };
  }

  saveToFile(filePath: string): void {
    fs.writeFileSync(filePath, JSON.stringify(this.toJSON(), null, 2));
  }
}
