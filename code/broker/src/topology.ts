import { DirectedGraph, DirectedVertex } from "graph-typed";
import fs from "fs";
import { LinkChange, LinkState, Node } from "./messages/types";
import Long from "long";

export interface DecodedLinkChange {
  state: LinkState;
  source: Node;
  target: Node;
  timestamp: string;
}

interface DecodedTopology {
  nodes: Node[];
  edges: DecodedLinkChange[];
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
      parsed.edges
        .map((change) => ({
          ...change,
          timestamp: Long.fromString(change.timestamp, true),
        }))
        .forEach((change) => topology.addLinkChange(change));
    }

    return topology;
  }

  addLinkChange(change: LinkChange): boolean {
    // Create unique key for the change
    const key = `${change.source}-${change.target}`;

    const existing = this.changes.get(key);
    // Last write wins
    if (existing && existing.timestamp.greaterThan(change.timestamp)) {
      // Existing change is older than the provided change. Ignore it.
      return false;
    }

    // Save the change
    this.changes.set(key, change);

    switch (change.state) {
      case LinkState.UP:
        return this.addEdge(change.source, change.target);
      case LinkState.DOWN:
        return this.removeEdge(change.source, change.target);
    }
  }

  addNode(node: number): boolean {
    if (this.graph.hasVertex(node)) {
      return false;
    }

    this.graph.addVertex(new DirectedVertex(node));
    return true;
  }

  private addEdge(from: number, to: number, weight: number = 1): boolean {
    let changed = false;

    if (this.addNode(from) || this.addNode(to)) {
      changed = true;
    }

    const existing = this.graph.getEdge(from, to);
    if (existing) {
      if (existing.weight !== weight) {
        existing.weight = weight;
        return true;
      }

      return false;
    }

    this.graph.addEdge(from, to);

    return true;
  }

  private removeEdge(from: number, to: number): boolean {
    if (!this.graph.hasEdge(from, to)) {
      return false;
    }

    this.graph.deleteEdge(from, to);
    return true;
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

  getNeighbors(node: number): number[] {
    if (!this.graph.hasVertex(node)) {
      return [];
    }

    return this.graph.getNeighbors(node).map((vertex) => vertex.key as number);
  }

  toJSON(): DecodedTopology {
    const nodes: Node[] = [];

    this.graph.vertexMap.forEach((vertex) => {
      nodes.push(vertex.key as Node);
    });

    const edges = Array.from(this.changes.values()).map((change) => ({
      source: change.source,
      target: change.target,
      state: change.state,
      timestamp: change.timestamp.toString(),
    }));

    return {
      nodes,
      edges,
    };
  }

  export(): { nodes: Node[]; edges: LinkChange[] } {
    const nodes: Node[] = [];

    this.graph.vertexMap.forEach((vertex) => {
      nodes.push(vertex.key as Node);
    });

    const edges = Array.from(this.changes.values());

    return {
      nodes,
      edges,
    };
  }

  saveToFile(filePath: string): void {
    fs.writeFileSync(filePath, JSON.stringify(this.toJSON(), null, 2));
  }
}
