import { describe, expect, it } from "@effect/vitest";
import { ACTS } from "@repo/design-system/components/nina/act";
import { ARM, LEG, WHOLE_BOX } from "@repo/design-system/components/nina/body";
import { EDGES } from "@repo/design-system/components/nina/edge";
import { legCurve } from "@repo/design-system/components/nina/figure";
import {
  bend,
  type Curve,
  cubic,
  slope,
  wide,
} from "@repo/design-system/components/nina/limb";
import { type Pose, REST } from "@repo/design-system/components/nina/pose";
import { Array as Arr, Record as Rec } from "effect";

type Place = readonly [number, number];
type Girth = typeof ARM;

/** Twelve seconds in steps of a twenty-fifth of a second: longer than any act takes to come round. */
const MOMENTS = Arr.makeBy(301, (i) => i * 0.04);
const [LEFT, TOP, WIDTH, HEIGHT] = WHOLE_BOX;

/** Where a limb runs, as points along its middle line. */
function polyline(c: Curve): readonly Place[] {
  return Arr.makeBy(
    25,
    (i): Place => [
      cubic(c[0], c[2], c[4], c[6], i / 24),
      cubic(c[1], c[3], c[5], c[7], i / 24),
    ]
  );
}

/**
 * How much wider the tightest bend of a limb is than half of the limb. Below 1
 * the limb folds over itself.
 */
function bendRatio(c: Curve, girth: Girth) {
  return Arr.reduce(
    Arr.makeBy(33, (i) => i / 32),
    Number.POSITIVE_INFINITY,
    (worst, t) => {
      const dx = slope(c[0], c[2], c[4], c[6], t);
      const dy = slope(c[1], c[3], c[5], c[7], t);
      const ddx = bend(c[0], c[2], c[4], c[6], t);
      const ddy = bend(c[1], c[3], c[5], c[7], t);
      const turn = Math.abs(dx * ddy - dy * ddx);
      const len = Math.hypot(dx, dy) || 1;
      return turn > 0.000_001
        ? Math.min(worst, len ** 3 / turn / wide(t, girth))
        : worst;
    }
  );
}

/** Whether two segments cross, strictly inside both. */
function meet(p: Place, q: Place, r: Place, s: Place) {
  const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
  if (Math.abs(d) < 1e-9) {
    return false;
  }
  const u = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d;
  const v = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
  return u > 0 && u < 1 && v > 0 && v < 1;
}

/** Whether two limbs cross. */
function cross(a: Curve, b: Curve) {
  const left = polyline(a);
  const right = polyline(b);
  return Arr.some(Arr.range(0, left.length - 2), (i) =>
    Arr.some(Arr.range(0, right.length - 2), (j) =>
      meet(left[i], left[i + 1], right[j], right[j + 1])
    )
  );
}

/** Everything wrong with one pose: limbs that fold, leave the window or cross. */
function problems(pose: Pose) {
  const limbs = [
    { c: pose.armL, girth: ARM, name: "armL" },
    { c: pose.armR, girth: ARM, name: "armR" },
    ...Arr.map(pose.legs, (_, i) => ({
      c: legCurve(pose, i),
      girth: LEG,
      name: `leg${i}`,
    })),
  ];
  return [
    ...Arr.flatMap(limbs, ({ c, girth, name }) => [
      ...(bendRatio(c, girth) < 1 ? [`${name} folds`] : []),
      ...(Arr.some(
        polyline(c),
        ([x, y]) =>
          x - girth.thick / 2 < LEFT ||
          x + girth.thick / 2 > LEFT + WIDTH ||
          y - girth.thick / 2 < TOP ||
          y + girth.thick / 2 > TOP + HEIGHT
      )
        ? [`${name} leaves the window`]
        : []),
    ]),
    ...(cross(pose.armL, pose.armR) ? ["her arms cross"] : []),
    ...Arr.flatMap(Arr.range(0, pose.legs.length - 2), (i) =>
      cross(legCurve(pose, i), legCurve(pose, i + 1))
        ? [`legs ${i} and ${i + 1} cross`]
        : []
    ),
  ];
}

describe("her shape", () => {
  it("folds no limb, crosses no arms or legs and leaves no window, in any act at any moment", () => {
    for (const [name, act] of Rec.toEntries(ACTS)) {
      for (const t of MOMENTS) {
        expect(problems(act.pose(t)), `${name} at ${t}`).toEqual([]);
      }
    }
  });

  it("keeps her arms apart and inside the window over an edge at any moment", () => {
    for (const [name, act] of Rec.toEntries(EDGES)) {
      for (const t of MOMENTS) {
        expect(problems(act.pose(t)), `${name} at ${t}`).toEqual([]);
      }
    }
  });

  it("notices a limb that folds over itself", () => {
    const hairpin: Curve = [80, 146, 130, 146, 130, 152, 80, 152];
    expect(problems({ ...REST, armR: hairpin })).toContain("armR folds");
  });

  it("notices arms that cross", () => {
    const pose = {
      ...REST,
      armL: [80, 146, 150, 170, 150, 200, 160, 240] as const,
      armR: [124, 146, 60, 170, 60, 200, 50, 240] as const,
    };
    expect(problems(pose)).toContain("her arms cross");
  });

  it("notices legs that cross", () => {
    const pose = {
      ...REST,
      legs: [
        [74, 186, 120, 228, 160, 264, 180, 238] as const,
        ...Arr.drop(REST.legs, 1),
      ],
    };
    expect(problems(pose)).toContain("legs 0 and 1 cross");
  });

  it("notices a limb that leaves the window", () => {
    const pose = {
      ...REST,
      armR: [124, 146, 300, 146, 400, 146, 440, 146] as const,
    };
    expect(problems(pose)).toContain("armR leaves the window");
  });
});
