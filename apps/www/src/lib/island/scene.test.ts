// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { Array as Arr, Option } from "effect";
import { BODY_STRIDE } from "@/lib/island/bodies";
import type { Animal } from "@/lib/island/life";
import { modelKey } from "@/lib/island/models/kinds";
import { livedOf, rerootedOf, sceneBodies, sceneOf } from "@/lib/island/scene";
import { terrainOf } from "@/lib/island/terrain";
import { cellOf } from "@/lib/island/world";

const CELLS = terrainOf(7, 52);
const SCENE = sceneOf(CELLS, 7, 52, 20_400);

describe("island/scene", () => {
  it("gathers everything alive on the island: the herd, the day's wild visitors, the plants and the reef", () => {
    expect(SCENE.herd.length).toBeGreaterThan(3);
    expect(SCENE.wild.length).toBeGreaterThan(3);
    expect(SCENE.plants.length).toBeGreaterThan(0);
    expect(SCENE.reef.length).toBeGreaterThan(100);
    expect(SCENE.corals.length).toBeGreaterThan(0);
  });

  it("draws every body of the scene with each model once: the herd, the whale and the sea's swimmers, the visitors, the residents, the plants and the reef", () => {
    const fox: Animal = {
      kind: "fox",
      rest: 1,
      steps: 0,
      tx: 32.5,
      tz: 32.5,
      x: 32.5,
      z: 32.5,
    };
    const bodies = sceneBodies(SCENE, 12, [fox]);
    const keys = Arr.map(bodies, ([model]) => modelKey(model));
    expect(Arr.dedupe(keys)).toHaveLength(keys.length);
    Arr.forEach(["body-fox", "body-whale", "swimmer-reef-shark"], (key) =>
      expect(keys).toContain(key)
    );
    Arr.forEach(["reef", "plant", "species"], (tag) =>
      expect(Arr.some(bodies, ([model]) => model._tag === tag)).toBe(true)
    );
    Arr.forEach(bodies, ([, places]) =>
      expect(places.length % BODY_STRIDE).toBe(0)
    );
    // Without the fox, the scene draws no fox at all.
    const foxes = (list: typeof bodies) =>
      Arr.reduce(list, 0, (count, [model, places]) =>
        modelKey(model) === "body-fox"
          ? count + places.length / BODY_STRIDE
          : count
      );
    expect(foxes(bodies)).toBe(1);
    expect(foxes(sceneBodies(SCENE, 12))).toBe(0);
  });

  it("lets the herd wander and the visitors roam as time passes, the learner's fox among them", () => {
    const later = Arr.reduce(
      Arr.makeBy(40, (step) => step),
      SCENE,
      (scene) => livedOf(scene, 0.25)
    );
    const moved = (before: readonly Animal[], after: readonly Animal[]) =>
      Arr.some(Arr.zip(before, after), ([a, b]) => a.x !== b.x || a.z !== b.z);
    expect(moved(SCENE.herd, later.herd)).toBe(true);
    expect(
      Arr.some(
        Arr.zip(SCENE.wild, later.wild),
        ([a, b]) => a.x !== b.x || a.z !== b.z || a.rest !== b.rest
      )
    ).toBe(true);
    expect(later.reef).toBe(SCENE.reef);
    // A fox standing on an animal's goal is one more body that animal walks round, never one it walks through.
    const [first] = SCENE.herd;
    const fox: Animal = { ...first, kind: "fox", x: first.tx, z: first.tz };
    const beside = livedOf(SCENE, 0.25, [fox]);
    expect(beside.herd).toHaveLength(SCENE.herd.length);
  });

  it("reads its plants and reef again over an edit, its creatures kept where they were", () => {
    const edited = Uint8Array.from(CELLS);
    const spot = Option.getOrThrow(
      Arr.findFirst(
        SCENE.reef,
        (candidate) =>
          candidate.kind !== "lily" &&
          candidate.x >= 0 &&
          candidate.x < 64 &&
          candidate.z >= 0 &&
          candidate.z < 64
      )
    );
    edited[cellOf(Math.floor(spot.x), spot.y, Math.floor(spot.z))] =
      idOf("stone");
    const rerooted = rerootedOf(SCENE, edited);
    expect(rerooted.reef).toHaveLength(SCENE.reef.length - 1);
    expect(rerooted.herd).toBe(SCENE.herd);
    expect(rerooted.cells).toBe(edited);
  });
});
