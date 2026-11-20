// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Order } from "effect";
import { BODY_STRIDE } from "@/lib/island/bodies";
import { CELL } from "@/lib/island/fauna/habitat";
import type { Land } from "@/lib/island/land/ground";
import { homeOf } from "@/lib/island/land/home";
import type { Animal } from "@/lib/island/life";
import { modelKey } from "@/lib/island/models/kinds";
import type { Scene } from "@/lib/island/scene";
import { livedOf, sceneBodies, sceneOf } from "@/lib/island/scene";
import { bareOf, floodAll, plainOf, setThings } from "@/lib/island/test.world";

const DAY = 20_000;

/** The learner's fox at a place. */
const foxAt = (x: number, z: number): Animal => ({
  kind: "fox",
  rest: 1,
  steps: 0,
  tx: x,
  tz: z,
  x,
  z,
});

/** A scene after `frames` frames of a sixtieth of a second about an anchor. */
const lived = (
  scene: Scene,
  land: Land,
  frames: number,
  anchor: readonly [number, number],
  hour = 10
) =>
  Arr.reduce(Arr.range(1, frames), scene, (now) =>
    livedOf(now, land, 1 / 60, hour, anchor, [])
  );

/** What one frame of a scene draws about an anchor. */
const drawn = (
  scene: Scene,
  land: Land,
  anchor: readonly [number, number],
  revision = 0,
  extra: readonly Animal[] = []
) =>
  sceneBodies(scene, land, { anchor, extra, hour: 10, revision, seconds: 5 });

/** The cells of a scene, by their coordinates, in order. */
const cellsOf = (scene: Scene) =>
  Arr.sort(
    Arr.map(scene.cells, (cell) => `${cell.gx},${cell.gz}`),
    Order.String
  );

describe("island/scene", () => {
  it("opens with no life found yet, at the camp the seed gives the world", () => {
    const land = plainOf(1);
    const scene = sceneOf(land, DAY);
    expect(scene.cells).toEqual([]);
    expect(scene.herd).toEqual([]);
    expect(scene.day).toBe(DAY);
    expect(scene.camp).toEqual(homeOf(land.seed));
  });

  it("fills the cells about the anchor one a frame, the nearest first, the same for the same seed and day", () => {
    const land = plainOf(5);
    const first = lived(sceneOf(land, DAY), land, 1, [10, 10]);
    expect(cellsOf(first)).toEqual(["0,0"]);
    const scene = lived(first, land, 8, [10, 10]);
    expect(cellsOf(scene)).toEqual([
      "-1,-1",
      "-1,0",
      "-1,1",
      "0,-1",
      "0,0",
      "0,1",
      "1,-1",
      "1,0",
      "1,1",
    ]);
    expect(cellsOf(lived(scene, land, 5, [10, 10]))).toEqual(cellsOf(scene));
    expect(scene.herd.length).toBeGreaterThan(8);
    expect(scene.herd).toEqual(
      Arr.flatMap(scene.cells, (cell) => [
        ...cell.dwellers,
        ...Arr.map(cell.villagers, (villager) => villager.body),
      ])
    );
    const again = lived(sceneOf(land, DAY), land, 9, [10, 10]);
    expect(again.herd).toEqual(scene.herd);
    const other = lived(sceneOf(land, DAY + 1), land, 9, [10, 10]);
    expect(other.herd).not.toEqual(scene.herd);
  });

  it("forgets the cells that fell behind, so a long walk keeps only the life about the learner", () => {
    const land = plainOf(9);
    const here = lived(sceneOf(land, DAY), land, 9, [10, 10]);
    const near = lived(here, land, 6, [70, 10]);
    // A cell just behind is kept a while, so turning back does not start its herd over.
    expect(cellsOf(near)).toContain("-1,0");
    expect(cellsOf(near)).toContain("1,0");
    const far = lived(near, land, 9, [200, 10]);
    expect(cellsOf(far)).not.toContain("0,0");
    expect(cellsOf(far)).toContain("2,0");
    expect(far.cells.length).toBeLessThanOrEqual(12);
    expect(
      Arr.every(far.herd, (animal) => Math.abs(animal.x - 200) < 128 + CELL)
    ).toBe(true);
  });

  it("draws every model once: what stands, the same lists frame after frame, then the animals with the fox among them", () => {
    const land = plainOf(5);
    const scene = lived(sceneOf(land, DAY), land, 4, [10, 10]);
    const settle = Arr.reduce(
      Arr.range(0, 20),
      drawn(scene, land, [10, 10]),
      () => drawn(scene, land, [10, 10])
    );
    const keys = Arr.map(settle, ([model]) => modelKey(model));
    expect(Arr.dedupe(keys)).toHaveLength(keys.length);
    expect(Arr.every(settle, ([, run]) => run.length % BODY_STRIDE === 0)).toBe(
      true
    );
    const standing = Arr.filter(settle, ([model]) => model._tag === "thing");
    expect(standing.length).toBeGreaterThan(0);
    const next = drawn(scene, land, [10, 10]);
    for (const [model, run] of standing) {
      expect(
        Arr.some(next, ([other, same]) => other === model && same === run)
      ).toBe(true);
    }
    const moving = Arr.filter(settle, ([model]) => model._tag !== "thing");
    expect(
      Arr.reduce(moving, 0, (sum, [, run]) => sum + run.length / BODY_STRIDE)
    ).toBeGreaterThanOrEqual(scene.herd.length);
    expect(keys).not.toContain("body-fox");
    const withFox = drawn(scene, land, [10, 10], 0, [foxAt(3, 3)]);
    expect(Arr.map(withFox, ([model]) => modelKey(model))).toContain(
      "body-fox"
    );
  });

  it("fills the sea with a big swimmer and its fish, and the air over land with birds", () => {
    const land = plainOf(5);
    floodAll(land, [-96, -96], [0, 96], 9, "sea");
    // A band of shallows along the shore, where corals grow and the reef's fish keep.
    floodAll(land, [0, -96], [20, 96], 2, "sea");
    const scene = lived(sceneOf(land, DAY), land, 4, [0, 10]);
    const swims = Arr.flatMap(scene.cells, (cell) => cell.swims);
    expect(swims).toHaveLength(2);
    const schools = Arr.flatMap(scene.cells, (cell) => cell.schools);
    expect(schools.length).toBeGreaterThanOrEqual(4);
    expect(
      Arr.filter(schools, (school) => school._tag === "bait")
    ).toHaveLength(Arr.filter(swims, (swim) => swim._tag === "hunter").length);
    const flights = Arr.flatMap(scene.cells, (cell) => cell.flights);
    expect(flights.length).toBeGreaterThanOrEqual(4);
    const tags = Arr.dedupe(
      Arr.map(drawn(scene, land, [0, 10]), ([model]) => model._tag)
    );
    expect(tags).toContain("flyer");
    expect(tags).toContain("reef");
    expect(tags).toContain("species");
    expect(Arr.some(tags, (tag) => tag === "swimmer" || tag === "body")).toBe(
      true
    );
  });

  it("camps two villagers where the world opens, and houses one in a cottage as soon as the learner builds it", () => {
    const land = bareOf(5);
    const open = { ...sceneOf(land, DAY), camp: [20, 20] as const };
    const camped = lived(open, land, 4, [10, 10]);
    const folk = (scene: Scene) =>
      Arr.map(
        Arr.flatMap(scene.cells, (cell) => cell.villagers),
        (villager) => villager.body.kind
      );
    expect(folk(camped)).toEqual(["cat", "rabbit"]);
    expect(
      Arr.filter(camped.herd, (animal) => animal.kind === "cat")
    ).toHaveLength(1);
    // Away from the camp nobody lives until something is built.
    const away = lived(sceneOf(land, DAY), land, 4, [10, 10]);
    expect(folk(away)).toEqual([]);
    setThings(
      land,
      [0, 0],
      [
        ["cottage", 10, 10, 0],
        ["cottage", 22, 10, 0],
        ["cottage", 10, 24, 0],
      ]
    );
    // The painter's next frame reads the changed chunk; the frame after, its villagers are there.
    drawn(away, land, [10, 10], 1);
    const housed = lived(away, land, 1, [10, 10]);
    expect(folk(housed)).toEqual(["cat", "rabbit", "bear"]);
    expect(
      Arr.filter(housed.herd, (animal) => animal.kind === "bear")
    ).toHaveLength(1);
    expect(lived(housed, land, 3, [10, 10]).cells[0].villagers).toHaveLength(3);
    // By night they are indoors: not of the herd, and not drawn.
    const night = lived(housed, land, 1, [10, 10], 2);
    expect(Arr.filter(night.herd, (animal) => animal.kind === "bear")).toEqual(
      []
    );
    // The cat fishes by day where water is near, and its rod is drawn with it.
    floodAll(land, [40, 0], [60, 60], 1.5, "lake");
    const lake = lived(sceneOf(land, DAY), land, 4, [10, 10]);
    const fished = lived(lake, land, 60 * 60, [10, 10], 12);
    expect(
      Arr.map(drawn(fished, land, [10, 10], 1), ([model]) => modelKey(model))
    ).toContain("tackle");
  });
});
