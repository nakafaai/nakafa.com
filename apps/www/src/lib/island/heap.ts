/**
 * A heap with room for `room` whole numbers, each pushed with a key, that
 * gives back the one with the lowest key first: the queue a search over a
 * lattice takes its next point from.
 */
export function heapOf(room: number) {
  const nodes = new Int32Array(room);
  const keys = new Float32Array(room);
  let count = 0;
  const swap = (a: number, b: number) => {
    const [node, key] = [nodes[a], keys[a]];
    nodes[a] = nodes[b];
    keys[a] = keys[b];
    nodes[b] = node;
    keys[b] = key;
  };
  return {
    pop: () => {
      const top = nodes[0];
      count -= 1;
      nodes[0] = nodes[count];
      keys[0] = keys[count];
      let at = 0;
      while (true) {
        const left = at * 2 + 1;
        const right = left + 1;
        let least = at;
        if (left < count && keys[left] < keys[least]) {
          least = left;
        }
        if (right < count && keys[right] < keys[least]) {
          least = right;
        }
        if (least === at) {
          return top;
        }
        swap(at, least);
        at = least;
      }
    },
    push: (node: number, key: number) => {
      let at = count;
      nodes[at] = node;
      keys[at] = key;
      count += 1;
      while (at > 0 && keys[Math.floor((at - 1) / 2)] > keys[at]) {
        swap(at, Math.floor((at - 1) / 2));
        at = Math.floor((at - 1) / 2);
      }
    },
    size: () => count,
  };
}
