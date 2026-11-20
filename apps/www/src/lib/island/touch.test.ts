// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import { rootAt } from "@/lib/island/flora/rooted";
import type { Land } from "@/lib/island/land/ground";
import type { Scene } from "@/lib/island/scene";
import { livedOf, sceneOf } from "@/lib/island/scene";
import {
  bareOf,
  coverAll,
  dwellerAt,
  GROUND,
  plainOf,
  raise,
  setThings,
} from "@/lib/island/test.world";
import { pettedOf, reachTo, touchAt } from "@/lib/island/touch";
import { PET } from "@/lib/island/wild";

const DAY = 20_000;

/** A body two blocks tall and half a block thick standing at the world's middle. */
const POST = { foot: [0, 0, 0], height: 2, radius: 0.5 } as const;

/** A scene of one hen at a place of a land, with what stands in the first chunk read. */
const henScene = (land: Land, x: number, z: number): Scene => {
  const scene = { ...sceneOf(land, DAY), herd: [dwellerAt("hen", x, z)] };
  rootAt(scene.roots, land, 0, 0);
  return scene;
};

describe("island/touch", () => {
  it("measures how far along a ray a body is met, whatever the ray's length", () => {
    const level = { direction: [0, 0, 1], origin: [0, 1, -10] } as const;
    expect(Option.getOrThrow(reachTo(level, POST, 100))).toBeCloseTo(10, 5);
    const long = { direction: [0, 0, 5], origin: [0.3, 1, -10] } as const;
    expect(Option.getOrThrow(reachTo(long, POST, 100))).toBeCloseTo(10, 5);
  });

  it("misses a body beside the ray, behind the lens or beyond the limit", () => {
    const level = { direction: [0, 0, 1], origin: [0, 1, -10] } as const;
    expect(reachTo(level, { ...POST, foot: [3, 0, 0] }, 100)).toEqual(
      Option.none()
    );
    expect(reachTo(level, { ...POST, foot: [0, 4, 0] }, 100)).toEqual(
      Option.none()
    );
    expect(reachTo(level, POST, 5)).toEqual(Option.none());
    const behind = { direction: [0, 0, 1], origin: [0, 1, 10] } as const;
    expect(reachTo(behind, POST, 100)).toEqual(Option.none());
  });

  it("meets a body from straight above at its top", () => {
    const down = { direction: [0, -1, 0], origin: [0.2, 10, 0] } as const;
    expect(Option.getOrThrow(reachTo(down, POST, 100))).toBeCloseTo(8, 5);
    const beside = { direction: [0, -1, 0], origin: [2, 10, 0] } as const;
    expect(reachTo(beside, POST, 100)).toEqual(Option.none());
  });

  it("finds the animal a ray passes before anything else, then the thing that stands in its way", () => {
    const land = bareOf(3);
    setThings(
      land,
      [0, 0],
      [
        ["lantern", 5, 6, 0],
        ["mango", 5, 4, 0],
      ]
    );
    const scene = henScene(land, 5, 8);
    const through = {
      direction: [0, 0, 1],
      origin: [5, GROUND + 0.2, 0],
    } as const;
    const hen = Option.getOrThrow(touchAt(scene, land, through));
    expect(hen).toMatchObject({ _tag: "animal", animal: scene.herd[0] });
    expect(hen.reach).toBeCloseTo(8, 1);
    const tree = Option.getOrThrow(
      touchAt({ ...scene, herd: [] }, land, through)
    );
    expect(tree).toMatchObject({
      _tag: "thing",
      at: 8 * 64 + 10,
      cx: 0,
      cz: 0,
      kind: "mango",
      x: 5,
      y: GROUND,
      z: 4,
    });
    expect(tree.reach).toBeCloseTo(4, 1);
  });

  it("finds nothing in the sky, beside the ray or behind the land the ray meets first", () => {
    const land = bareOf(3);
    const scene = henScene(land, 5, 8);
    const level = {
      direction: [0, 0, 1],
      origin: [5, GROUND + 0.2, 0],
    } as const;
    expect(Option.isSome(touchAt(scene, land, level))).toBe(true);
    expect(
      touchAt(scene, land, { direction: [0, 1, 0], origin: [5, GROUND + 1, 0] })
    ).toEqual(Option.none());
    expect(
      touchAt(scene, land, {
        direction: [1, 0, 0],
        origin: [5, GROUND + 0.2, 0],
      })
    ).toEqual(Option.none());
    for (const i of Arr.range(0, 10)) {
      raise(land, i, 3, GROUND + 6);
      raise(land, i, 4, GROUND + 6);
    }
    expect(touchAt(scene, land, level)).toEqual(Option.none());
  });

  it("finds a wild plant from above, as the plant of its place", () => {
    const land = plainOf(3);
    coverAll(land, [-8, -8], [40, 40], "forest");
    const scene = { ...sceneOf(land, DAY), herd: [] };
    const root = rootAt(scene.roots, land, 0, 0);
    const plant = Option.getOrThrow(
      Arr.findFirst(root.standing, (stood) => stood.origin._tag === "wild")
    );
    const found = Option.getOrThrow(
      touchAt(scene, land, {
        direction: [0, -1, 0],
        origin: [plant.x + 0.05, plant.y + plant.height + 4, plant.z],
      })
    );
    expect(found).toMatchObject({ ...plant.origin, x: plant.x, z: plant.z });
    expect(found.reach).toBeCloseTo(4, 1);
  });

  it("makes a stroked animal or villager stand for the learner, and leaves the scene alone for a stranger", () => {
    const land = bareOf(5);
    const open: Scene = { ...sceneOf(land, DAY), camp: [20, 20] };
    const scene = Arr.reduce(Arr.range(1, 9), open, (now) =>
      livedOf(now, land, 1 / 60, 10, [10, 10], [])
    );
    const pets = (now: Scene) =>
      Arr.filter(
        [
          ...Arr.flatMap(now.cells, (cell) => [
            ...cell.dwellers,
            ...Arr.map(cell.villagers, (villager) => villager.body),
          ]),
        ],
        (animal) => animal.pet === PET
      );
    expect(pets(scene)).toEqual([]);
    const dweller = Arr.flatMap(scene.cells, (cell) => cell.dwellers)[0];
    const stroked = pettedOf(scene, dweller);
    expect(pets(stroked)).toEqual([{ ...dweller, pet: PET }]);
    expect(Arr.filter(stroked.herd, (animal) => animal.pet === PET)).toEqual([
      { ...dweller, pet: PET },
    ]);
    const villager = Arr.flatMap(scene.cells, (cell) => cell.villagers)[0];
    expect(pets(pettedOf(scene, villager.body))).toEqual([
      { ...villager.body, pet: PET },
    ]);
    expect(pettedOf(scene, dwellerAt("hen", 1, 1))).toEqual(scene);
  });
});
