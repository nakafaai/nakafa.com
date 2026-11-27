import { describe, expect, it } from "@effect/vitest";
import {
  fitMaps,
  freeMaps,
  layMaps,
} from "@repo/design-system/components/three/matter/maps";
import { surfaceMaps } from "@repo/design-system/components/three/surface/maps";
import { Array as Arr, Option } from "effect";
import { CylinderGeometry, Object3D, PlaneGeometry } from "three";

describe("layMaps", () => {
  it("gives a smooth material no detail textures", () => {
    expect(layMaps(Option.none())).toStrictEqual([]);
  });

  it("lays a surface's tiles without painting them again", () => {
    const shared = surfaceMaps("machined");
    const [maps] = layMaps(Option.some("machined"));

    expect(maps?.map.source).toBe(shared.tone.source);
    expect(maps?.normalMap.source).toBe(shared.normal.source);
    expect(maps?.aoMap.source).toBe(shared.finish.source);
    expect(maps?.roughnessMap).toBe(maps?.aoMap);
    expect(maps?.map).not.toBe(shared.tone);
  });
});

describe("fitMaps", () => {
  it("lays more tiles over a large part than over a small one, so detail keeps its size", () => {
    const shared = surfaceMaps("paint");
    const maps = layMaps(Option.some("paint"));
    const fit = fitMaps(maps, 0.5, false);

    fit(
      undefined,
      undefined,
      undefined,
      new PlaneGeometry(3, 2),
      new Object3D()
    );

    expect(maps[0]?.map.repeat.toArray()).toStrictEqual([6, 4]);
    expect(maps[0]?.normalMap.repeat.toArray()).toStrictEqual([6, 4]);
    expect(maps[0]?.aoMap.repeat.toArray()).toStrictEqual([6, 4]);
    expect(shared.tone.repeat.toArray()).toStrictEqual([1, 1]);
  });

  it("closes a turned part on a whole number of tiles, and never on none", () => {
    const maps = layMaps(Option.some("machined"));
    const fit = fitMaps(maps, 0.3, false);

    fit(
      undefined,
      undefined,
      undefined,
      new CylinderGeometry(0.016, 0.016, 0.7, 24, 1, true),
      new Object3D()
    );

    expect(maps[0]?.map.repeat.toArray()).toStrictEqual([1, 2]);
  });

  it("carries larger detail on a part a lab draws larger than life", () => {
    const maps = layMaps(Option.some("paint"));
    const fit = fitMaps(maps, 0.5, false);
    const doubled = new Object3D();
    doubled.scale.setScalar(2);
    doubled.updateMatrixWorld();

    fit(undefined, undefined, undefined, new PlaneGeometry(3, 2), doubled);

    expect(maps[0]?.map.repeat.toArray()).toStrictEqual([12, 8]);
  });

  it("measures a part once and lays it again only for another part", () => {
    const maps = layMaps(Option.some("paint"));
    const fit = fitMaps(maps, 0.5, false);
    const board = new PlaneGeometry(3, 2);
    const grown = new Object3D();
    grown.scale.setScalar(2);
    grown.updateMatrixWorld();

    fit(undefined, undefined, undefined, board, new Object3D());
    fit(undefined, undefined, undefined, board, grown);

    expect(maps[0]?.map.repeat.toArray()).toStrictEqual([6, 4]);

    fit(undefined, undefined, undefined, new PlaneGeometry(1, 1), grown);

    expect(maps[0]?.map.repeat.toArray()).toStrictEqual([4, 4]);
  });

  it("runs the grain of wood up a post and along a board", () => {
    const post = layMaps(Option.some("wood"));
    const board = layMaps(Option.some("wood"));

    fitMaps(post, 0.5, true)(
      undefined,
      undefined,
      undefined,
      new PlaneGeometry(1, 3),
      new Object3D()
    );
    fitMaps(board, 0.5, true)(
      undefined,
      undefined,
      undefined,
      new PlaneGeometry(3, 1),
      new Object3D()
    );

    expect(post[0]?.map.rotation).toBe(Math.PI / 2);
    expect(post[0]?.normalMap.rotation).toBe(Math.PI / 2);
    expect(post[0]?.aoMap.rotation).toBe(Math.PI / 2);
    expect(post[0]?.map.repeat.toArray()).toStrictEqual([6, 2]);
    expect(board[0]?.map.rotation).toBe(0);
    expect(board[0]?.map.repeat.toArray()).toStrictEqual([6, 2]);
  });

  it("leaves a material without a grain as it lies, however long the part", () => {
    const maps = layMaps(Option.some("paint"));

    fitMaps(maps, 0.5, false)(
      undefined,
      undefined,
      undefined,
      new PlaneGeometry(1, 3),
      new Object3D()
    );

    expect(maps[0]?.map.rotation).toBe(0);
    expect(maps[0]?.map.repeat.toArray()).toStrictEqual([2, 6]);
  });

  it("has nothing to lay on a smooth material", () => {
    const fit = fitMaps(layMaps(Option.none()), 0.5, false);

    expect(() =>
      fit(
        undefined,
        undefined,
        undefined,
        new PlaneGeometry(1, 1),
        new Object3D()
      )
    ).not.toThrow();
  });
});

describe("freeMaps", () => {
  it("frees every copy a part laid and leaves the painted tiles alone", () => {
    const shared = surfaceMaps("paper");
    const maps = layMaps(Option.some("paper"));
    const freed = vi.fn<(map: string) => void>();
    Arr.forEach(maps, (each) => {
      each.map.addEventListener("dispose", () => freed("map"));
      each.normalMap.addEventListener("dispose", () => freed("normal"));
      each.aoMap.addEventListener("dispose", () => freed("finish"));
    });
    shared.tone.addEventListener("dispose", () => freed("shared"));

    freeMaps(maps);

    expect(freed.mock.calls).toStrictEqual([["finish"], ["map"], ["normal"]]);
  });
});
