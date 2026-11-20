// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Order } from "effect";
import { heapOf } from "@/lib/island/heap";

describe("island/heap", () => {
  it("gives back what it holds from the lowest key to the highest, whatever order it came in", () => {
    const heap = heapOf(16);
    const keys = [7, 3, 9, 1, 8, 2, 6, 4, 5, 0.5, 3.5];
    Arr.forEach(keys, (key, node) => heap.push(node, key));
    expect(heap.size()).toBe(keys.length);
    const popped = Arr.makeBy(keys.length, () => keys[heap.pop()]);
    expect(popped).toEqual(Arr.sort(keys, Order.Number));
    expect(heap.size()).toBe(0);
  });

  it("keeps its order while it is fed and emptied in turns", () => {
    const heap = heapOf(8);
    heap.push(10, 5);
    heap.push(11, 1);
    expect(heap.pop()).toBe(11);
    heap.push(12, 3);
    heap.push(13, 0);
    expect(heap.pop()).toBe(13);
    expect(heap.pop()).toBe(12);
    expect(heap.pop()).toBe(10);
  });
});
