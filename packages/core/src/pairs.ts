export class Pairs {
  static directed<T extends string>(ids: readonly T[]): { from: T; to: T }[] {
    const edges: { from: T; to: T }[] = [];
    for (const from of ids) {
      for (const to of ids) {
        if (from !== to) edges.push({ from, to });
      }
    }
    return edges;
  }
}
