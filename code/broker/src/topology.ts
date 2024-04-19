import { DirectedGraph, DirectedVertex } from "graph-typed";
import fs from "fs";

type Node = number;
type Edge = { from: Node; to: Node };

interface DecodedTopology {
  nodes: Node[];
  edges: Edge[];
}

export class Topology {
  private readonly graph: DirectedGraph = new DirectedGraph();

  constructor(ourId: number) {
    this.addNode(ourId);
  }

  static fromFile(filePath: string, ourId: number): Topology {
    const topology = new Topology(ourId);

    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");

      const parsed = JSON.parse(raw) as DecodedTopology;

      parsed.nodes.forEach((node) => topology.addNode(node));
      parsed.edges.forEach((edge) => topology.addEdge(edge.from, edge.to));
    }

    return topology;
  }

  addNode(node: number): void {
    if (this.graph.hasVertex(node)) {
      return;
    }

    this.graph.addVertex(new DirectedVertex(node));
  }

  addEdge(from: number, to: number): void {
    this.addNode(from);
    this.addNode(to);

    if (this.graph.hasEdge(from, to)) {
      return;
    }

    this.graph.addEdge(from, to);
  }

  removeEdge(from: number, to: number): void {
    if (!this.graph.hasEdge(from, to)) {
      return;
    }

    this.graph.deleteEdge(from, to);
  }

  removeEdgesToAndFromNode(node: number): void {
    this.graph.incomingEdgesOf(node).forEach((edge) => {
      this.graph.deleteEdge(edge);
    });

    this.graph.outgoingEdgesOf(node).forEach((edge) => {
      this.graph.deleteEdge(edge);
    });
  }

  saveToFile(filePath: string): void {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    this.graph.vertexMap.forEach((vertex) => {
      nodes.push(vertex.key as Node);
    });

    this.graph.edgeSet().forEach((edge) => {
      edges.push({ from: edge.src as Node, to: edge.dest as Node });
    });

    const data: DecodedTopology = { nodes, edges };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
}
