// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { HEIGHT, SPAN } from "@repo/backend/confect/island/world";
import { Option } from "effect";
import { castRay, clipToWorld } from "@/lib/island/ray";
import { cellOf, emptyCells } from "@/lib/island/world";

/** A world with one stone at (10, 5, 10) and water at (20, 3, 20). */
function world() {
  const cells = emptyCells();
  cells[cellOf(10, 5, 10)] = idOf("stone");
  cells[cellOf(20, 3, 20)] = idOf("water");
  return cells;
}

describe("island/ray", () => {
  it("hits the top of a block from above and places the next one on it", () => {
    const hit = castRay(world(), [10.5, 40, 10.5], [0, -1, 0]);
    expect(hit).toEqual(
      Option.some({
        block: idOf("stone"),
        hit: [10, 5, 10],
        place: [10, 6, 10],
      })
    );
  });

  it("hits the side it comes from, and counts water as a hit", () => {
    const side = castRay(world(), [2.5, 5.5, 10.5], [1, 0, 0]);
    expect(Option.map(side, (found) => found.place)).toEqual(
      Option.some([9, 5, 10])
    );
    const water = castRay(world(), [20.5, 30, 20.5], [0, -1, 0]);
    expect(Option.map(water, (found) => found.block)).toEqual(
      Option.some(idOf("water"))
    );
  });

  it("enters the world through its face and places in front of a block on the edge", () => {
    const cells = world();
    cells[cellOf(0, 5, 10)] = idOf("dirt");
    const hit = castRay(cells, [-20, 5.5, 10.5], [1, 0, 0]);
    expect(hit).toEqual(
      Option.some({ block: idOf("dirt"), hit: [0, 5, 10], place: [-1, 5, 10] })
    );
  });

  it("walks a slanted ray cell by cell across every axis, into the world through any face", () => {
    const cells = world();
    cells[cellOf(10, 5, 0)] = idOf("dirt");
    const front = castRay(cells, [10.5, 5.5, -9], [0, 0, 1]);
    expect(Option.map(front, (found) => found.place)).toEqual(
      Option.some([10, 5, -1])
    );
    const slanted = castRay(cells, [3.2, 12.7, 2.9], [0.55, -0.6, 0.58]);
    expect(Option.map(slanted, (found) => found.hit)).toEqual(
      Option.some([10, 5, 10])
    );
  });

  it("misses an empty column, and a ray that never meets the world", () => {
    expect(castRay(world(), [40.5, 40, 40.5], [0, -1, 0])).toEqual(
      Option.none()
    );
    expect(clipToWorld([-5, 5, 5], [0, 1, 0])).toEqual(Option.none());
    expect(clipToWorld([-5, HEIGHT + 5, -5], [1, 0, 1])).toEqual(Option.none());
    expect(clipToWorld([-5, HEIGHT + 5, -5], [1, 0.1, 1])).toEqual(
      Option.none()
    );
    expect(clipToWorld([5, 5, 5], [0, 0, 1])).toEqual(
      Option.some({ enter: 0, exit: SPAN - 5, side: -1 })
    );
  });
});
