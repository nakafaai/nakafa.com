import { describe, expect, it } from "@effect/vitest";
import {
  framedContent,
  roundOf,
  silhouetteBounds,
  silhouetteReach,
} from "@repo/design-system/components/three/camera/silhouette";
import { Array as Arr, Option } from "effect";
import {
  Box2,
  Box3,
  Group,
  Matrix4,
  Quaternion,
  Vector2,
  Vector3,
} from "three";

describe("roundOf", () => {
  it("rebuilds a ball or a ring only from a whole radius and centre", () => {
    expect(roundOf(undefined, [0, 1, 2], [])).toBeUndefined();
    expect(roundOf(1, [], [])).toBeUndefined();
    expect(roundOf(1, [0], [])).toBeUndefined();
    expect(roundOf(1, [0, 1], [])).toBeUndefined();
    expect(roundOf(1, [0, 1, 2], [])).toEqual({
      center: [0, 1, 2],
      kind: "sphere",
      radius: 1,
    });
    expect(roundOf(1, [0, 1, 2], [0])).toMatchObject({ kind: "sphere" });
    expect(roundOf(1, [0, 1, 2], [0, 1])).toMatchObject({ kind: "sphere" });
    expect(roundOf(1, [0, 1, 2], [0, 1, 0])).toEqual({
      center: [0, 1, 2],
      kind: "ring",
      normal: [0, 1, 0],
      radius: 1,
    });
  });
});

describe("framedContent", () => {
  it("carries a ball and a ring through their moving part and skips hidden ones", () => {
    const scene = new Group();
    const part = new Group();
    const hidden = new Group();
    scene.add(part, hidden);
    hidden.visible = false;
    new Matrix4()
      .compose(
        new Vector3(10, 0, 0),
        new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2),
        new Vector3(2, 2, 2)
      )
      .decompose(part.position, part.quaternion, part.scale);
    scene.updateWorldMatrix(true, true);
    const ball = { center: [0, 1, 0], kind: "sphere", radius: 1.5 } as const;
    const orbit = {
      center: [0, 0, 0],
      kind: "ring",
      normal: [0, 3, 0],
      radius: 1,
    } as const;

    const { labels, silhouettes: placed } = framedContent(Option.none(), [
      [1, { object: part, round: ball }],
      [2, { object: part, round: orbit }],
      [3, { object: hidden, round: ball }],
    ]);
    expect(labels).toEqual([]);
    const [first, second] = Arr.map(placed, silhouetteBounds);

    expect(placed).toHaveLength(2);
    expect(placed[0]).toMatchObject({ kind: "sphere", radius: 3 });
    expect(first?.min.x).toBeCloseTo(7);
    expect(first?.max.z).toBeCloseTo(5);
    expect(placed[1]).toMatchObject({ kind: "ring", radius: 2 });
    expect(second?.min.x).toBeCloseTo(8);
    expect(second?.max.y).toBeCloseTo(2);
    expect((second?.max.z ?? 1) - (second?.min.z ?? 0)).toBeCloseTo(0);

    scene.visible = false;
    const bounds = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
    const label = {
      anchors: new Box3(new Vector3(), new Vector3()),
      gap: { x: 0, y: 0 },
      rectangle: new Box2(new Vector2(-10, -5), new Vector2(10, 5)),
    };
    expect(
      framedContent(Option.some({ bounds, labels: [label] }), [
        [1, { object: part, round: ball }],
      ])
    ).toEqual({ labels: [label], silhouettes: [{ box: bounds, kind: "box" }] });
  });
});

describe("silhouetteReach", () => {
  it("measures a box by its faces, a ball by its radius and a ring by its tilt", () => {
    const origin = new Vector3(1, 0, 0);
    const along = new Vector3(2, 0, 0);

    expect(
      silhouetteReach(
        {
          box: new Box3(new Vector3(-1, -1, -1), new Vector3(3, 1, 1)),
          kind: "box",
        },
        along,
        origin
      )
    ).toBeCloseTo(4);
    expect(
      silhouetteReach(
        { center: new Vector3(2, 5, 0), kind: "sphere", radius: 1.5 },
        along,
        origin
      )
    ).toBeCloseTo(5);
    // A ring that faces the direction reaches no further than its centre.
    expect(
      silhouetteReach(
        {
          center: new Vector3(2, 0, 0),
          kind: "ring",
          normal: new Vector3(1, 0, 0),
          radius: 3,
        },
        along,
        origin
      )
    ).toBeCloseTo(2);
    expect(
      silhouetteReach(
        {
          center: new Vector3(2, 0, 0),
          kind: "ring",
          normal: new Vector3(0, 1, 0),
          radius: 3,
        },
        along,
        origin
      )
    ).toBeCloseTo(8);
  });
});
