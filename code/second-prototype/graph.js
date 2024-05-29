const { DirectedGraph, DirectedVertex, DirectedEdge } = require("graph-typed");

const graph = new DirectedGraph();

graph.addVertex(new DirectedVertex("1"));
graph.addVertex(new DirectedVertex("2"));
graph.addVertex(new DirectedVertex("3"));
graph.addVertex(new DirectedVertex("4"));
graph.addVertex(new DirectedVertex("5"));
graph.addVertex(new DirectedVertex("6"));
graph.addVertex(new DirectedVertex("7"));
graph.addVertex(new DirectedVertex("8"));
graph.addVertex(new DirectedVertex("9"));
graph.addVertex(new DirectedVertex("10"));
graph.addVertex(new DirectedVertex("11"));
graph.addVertex(new DirectedVertex("12"));
graph.addVertex(new DirectedVertex("13"));
graph.addVertex(new DirectedVertex("14"));
graph.addVertex(new DirectedVertex("15"));
graph.addVertex(new DirectedVertex("16"));
graph.addVertex(new DirectedVertex("17"));
graph.addVertex(new DirectedVertex("18"));
graph.addVertex(new DirectedVertex("19"));
graph.addVertex(new DirectedVertex("20"));
graph.addVertex(new DirectedVertex("21"));
graph.addVertex(new DirectedVertex("22"));
graph.addVertex(new DirectedVertex("23"));
graph.addVertex(new DirectedVertex("24"));
graph.addVertex(new DirectedVertex("25"));
graph.addVertex(new DirectedVertex("26"));
graph.addVertex(new DirectedVertex("27"));
graph.addVertex(new DirectedVertex("28"));

// Area 1
graph.addEdge(new DirectedEdge("1", "2", 1));
graph.addEdge(new DirectedEdge("2", "1", 1));
graph.addEdge(new DirectedEdge("2", "3", 1));
graph.addEdge(new DirectedEdge("3", "2", 1));
graph.addEdge(new DirectedEdge("3", "4", 1));
graph.addEdge(new DirectedEdge("4", "3", 1));
graph.addEdge(new DirectedEdge("4", "5", 1));
graph.addEdge(new DirectedEdge("5", "4", 1));
graph.addEdge(new DirectedEdge("5", "6", 1));
graph.addEdge(new DirectedEdge("6", "5", 1));
graph.addEdge(new DirectedEdge("2", "5", 1));
graph.addEdge(new DirectedEdge("5", "2", 1));

graph.addEdge(new DirectedEdge("7", "8", 1));
graph.addEdge(new DirectedEdge("8", "7", 1));
graph.addEdge(new DirectedEdge("8", "9", 1));
graph.addEdge(new DirectedEdge("9", "8", 1));
graph.addEdge(new DirectedEdge("9", "7", 1));
graph.addEdge(new DirectedEdge("7", "9", 1));

// Area 2
graph.addEdge(new DirectedEdge("10", "11", 1));
graph.addEdge(new DirectedEdge("11", "10", 1));
graph.addEdge(new DirectedEdge("11", "12", 1));
graph.addEdge(new DirectedEdge("12", "11", 1));
graph.addEdge(new DirectedEdge("12", "13", 1));
graph.addEdge(new DirectedEdge("13", "12", 1));
graph.addEdge(new DirectedEdge("13", "14", 1));
graph.addEdge(new DirectedEdge("14", "13", 1));
graph.addEdge(new DirectedEdge("14", "15", 1));
graph.addEdge(new DirectedEdge("15", "14", 1));
graph.addEdge(new DirectedEdge("15", "16", 1));
graph.addEdge(new DirectedEdge("16", "15", 1));
graph.addEdge(new DirectedEdge("10", "15", 1));
graph.addEdge(new DirectedEdge("15", "10", 1));

graph.addEdge(new DirectedEdge("17", "18", 1));
graph.addEdge(new DirectedEdge("18", "17", 1));

// Area 3
graph.addEdge(new DirectedEdge("19", "20", 1));
graph.addEdge(new DirectedEdge("20", "19", 1));
graph.addEdge(new DirectedEdge("20", "21", 1));
graph.addEdge(new DirectedEdge("21", "20", 1));
graph.addEdge(new DirectedEdge("21", "22", 1));
graph.addEdge(new DirectedEdge("22", "21", 1));
graph.addEdge(new DirectedEdge("21", "23", 1));
graph.addEdge(new DirectedEdge("23", "21", 1));
graph.addEdge(new DirectedEdge("23", "24", 1));
graph.addEdge(new DirectedEdge("24", "23", 1));
graph.addEdge(new DirectedEdge("25", "26", 1));
graph.addEdge(new DirectedEdge("26", "25", 1));
graph.addEdge(new DirectedEdge("26", "27", 1));
graph.addEdge(new DirectedEdge("27", "26", 1));
graph.addEdge(new DirectedEdge("27", "28", 1));
graph.addEdge(new DirectedEdge("28", "27", 1));
graph.addEdge(new DirectedEdge("25", "28", 1));
graph.addEdge(new DirectedEdge("28", "25", 1));
graph.addEdge(new DirectedEdge("19", "26", 1));
graph.addEdge(new DirectedEdge("26", "19", 1));
graph.addEdge(new DirectedEdge("20", "27", 1));
graph.addEdge(new DirectedEdge("27", "20", 1));

// Area 1 to 2
graph.addEdge(new DirectedEdge("1", "10", 10));
graph.addEdge(new DirectedEdge("10", "1", 10));
graph.addEdge(new DirectedEdge("3", "16", 10));
graph.addEdge(new DirectedEdge("16", "3", 10));
graph.addEdge(new DirectedEdge("7", "16", 10));
graph.addEdge(new DirectedEdge("16", "7", 10));
graph.addEdge(new DirectedEdge("8", "17", 10));
graph.addEdge(new DirectedEdge("17", "8", 10));

// Area 1 to 3
graph.addEdge(new DirectedEdge("8", "19", 10));
graph.addEdge(new DirectedEdge("19", "8", 10));
graph.addEdge(new DirectedEdge("9", "28", 10));
graph.addEdge(new DirectedEdge("28", "9", 10));

// Area 2 to 3
graph.addEdge(new DirectedEdge("14", "25", 10));
graph.addEdge(new DirectedEdge("25", "14", 10));
graph.addEdge(new DirectedEdge("17", "20", 10));
graph.addEdge(new DirectedEdge("20", "17", 10));
graph.addEdge(new DirectedEdge("18", "21", 10));
graph.addEdge(new DirectedEdge("21", "18", 10));

module.exports = graph;
