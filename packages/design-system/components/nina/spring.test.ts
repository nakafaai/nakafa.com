import { describe, expect, it } from "@effect/vitest";
import { ACTS } from "@repo/design-system/components/nina/act";
import { EDGES } from "@repo/design-system/components/nina/edge";
import {
  followPeek,
  followWhole,
  peekNumbers,
  peekSprung,
  settle,
  wholeNumbers,
  wholeSprung,
} from "@repo/design-system/components/nina/spring";
import { Array as Arr } from "effect";

const WAVE = ACTS.melambai.pose(1.3);
const STILL = ACTS.santai.pose(0.4);
/** The tip of her right arm, where it waves. */
const TIP = 17;

/** Her springs after each hundredth of a second of following the wave, from standing still. */
const FOLLOWING = Arr.scan(
  Arr.range(1, 300),
  settle(wholeNumbers(STILL)),
  (springs) => followWhole(springs, WAVE, 0.01)
);

describe("her springs", () => {
  it("keep a pose that they already hold", () => {
    const held = settle(wholeNumbers(STILL));
    expect(followWhole(held, STILL, 0.01)).toEqual(held);
  });

  it("move toward the pose without jumping to it", () => {
    const start = wholeNumbers(STILL)[TIP];
    const gap = wholeNumbers(WAVE)[TIP] - start;
    const moved = FOLLOWING[1].x[TIP] - start;
    expect(Math.sign(moved)).toBe(Math.sign(gap));
    expect(Math.abs(moved)).toBeLessThan(Math.abs(gap) / 4);
  });

  it("run a little past the pose and settle on it, like something soft", () => {
    const start = wholeNumbers(STILL)[TIP];
    const target = wholeNumbers(WAVE)[TIP];
    const direction = Math.sign(target - start);
    const farthest = Math.max(
      ...Arr.map(FOLLOWING, ({ x }) => (x[TIP] - start) * direction)
    );
    expect(farthest).toBeGreaterThan(Math.abs(target - start));
    expect(Math.abs(FOLLOWING[300].x[TIP] - target)).toBeLessThan(0.5);
  });

  it("are read back as the pose that they follow", () => {
    expect(wholeSprung(settle(wholeNumbers(WAVE)), WAVE)).toEqual(WAVE);
  });

  it("follow only her two arms over an edge", () => {
    const edge = EDGES.lambai.pose(0.2);
    const held = settle(peekNumbers(EDGES.pegang.pose(0.3)));
    expect(followPeek(held, edge, 0.01).x).toHaveLength(16);
    expect(peekSprung(settle(peekNumbers(edge)), edge)).toEqual(edge);
  });
});
