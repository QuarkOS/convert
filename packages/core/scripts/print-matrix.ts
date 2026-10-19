import { FormatCatalog } from "../src/format-catalog.ts";
import { FormatGraph } from "../src/format-graph.ts";
import { NodeEngines } from "../src/node.ts";

const edges = FormatGraph.compile(NodeEngines.host());
for (const id of FormatCatalog.ids()) {
  const targets = FormatGraph.targets(edges, id);
  console.log(`${id}\t${targets.join(",")}`);
}
