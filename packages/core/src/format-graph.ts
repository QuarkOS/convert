import type { Edge, Engine, FormatId } from "./domain.ts";

export class FormatGraph {
  static compile(engines: readonly Engine[]): Edge[] {
    const seen = new Set<string>();
    const edges: Edge[] = [];
    for (const engine of engines) {
      if (!engine.available()) continue;
      for (const edge of engine.edges()) {
        if (edge.from === edge.to) continue;
        const key = `${edge.from}>${edge.to}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ from: edge.from, to: edge.to, engineId: engine.id });
      }
    }
    return edges;
  }

  static targets(edges: readonly Edge[], from: FormatId): FormatId[] {
    const found = new Set<FormatId>();
    const queue: FormatId[] = [from];
    const seen = new Set<FormatId>([from]);
    let cursor = queue.shift();
    while (cursor !== undefined) {
      for (const edge of edges) {
        if (edge.from !== cursor || seen.has(edge.to)) continue;
        seen.add(edge.to);
        found.add(edge.to);
        queue.push(edge.to);
      }
      cursor = queue.shift();
    }
    return [...found].sort((a, b) => a.localeCompare(b));
  }

  static path(edges: readonly Edge[], from: FormatId, to: FormatId): Edge[] | null {
    if (from === to) return null;
    const outgoing = new Map<FormatId, Edge[]>();
    for (const edge of edges) {
      const list = outgoing.get(edge.from) ?? [];
      list.push(edge);
      outgoing.set(edge.from, list);
    }
    const queue: FormatId[] = [from];
    const prev = new Map<FormatId, Edge>();
    const seen = new Set<FormatId>([from]);
    let cursor = queue.shift();
    while (cursor !== undefined) {
      const nextEdges = outgoing.get(cursor) ?? [];
      for (const edge of nextEdges) {
        if (seen.has(edge.to)) continue;
        seen.add(edge.to);
        prev.set(edge.to, edge);
        if (edge.to === to) {
          const chain: Edge[] = [];
          let walk: FormatId = to;
          while (walk !== from) {
            const step = prev.get(walk);
            if (!step) return null;
            chain.push(step);
            walk = step.from;
          }
          chain.reverse();
          return chain;
        }
        queue.push(edge.to);
      }
      cursor = queue.shift();
    }
    return null;
  }
}
