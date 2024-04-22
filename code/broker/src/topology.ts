import { DirectedGraph, DirectedVertex } from "graph-typed";
import fs from "fs";
import { LinkChange, LinkState, Node } from "./messages/message";

interface DecodedTopology {
  nodes: Node[];
  edges: LinkChange[];
}

export class Topology {
  private readonly graph: DirectedGraph = new DirectedGraph();
  private readonly changes: Map<string, LinkChange> = new Map();

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

  private addEdge(from: number, to: number, weight: number = 1): void {
    this.addNode(from);
    this.addNode(to);

    const existing = this.graph.getEdge(from, to);
    if (existing) {
      existing.weight = weight;
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

  getNextHop(from: number, to: number): number | undefined {
    if (!this.graph.hasVertex(from) || !this.graph.hasVertex(to)) {
      return;
    }

    const path = this.graph.getMinPathBetween(from, to, true);
    if (path === undefined || path.length < 2) {
      return undefined;
    }

    return path[1].key as number;
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
