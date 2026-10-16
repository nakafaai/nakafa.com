import { describe, expect, it } from "@effect/vitest";
import { pushApart } from "@repo/design-system/components/pool/collide";
import { ballAt } from "@repo/design-system/components/pool/test.fixture";

describe("the balls that touch", () => {
  it("pushes two overlapping balls apart until they touch", () => {
    const [first, second] = pushApart(
      [ballAt({ x: 600 }), ballAt({ x: 630 })],
      null
    );
    expect(first.x).toBe(595);
    expect(second.x).toBe(635);
  });

  it("pushes two balls on the very same point apart sideways, two passes at a time", () => {
    const [first, second] = pushApart([ballAt({}), ballAt({})], null);
    expect(first.x).toBe(588);
    expect(second.x).toBe(612);
    expect(first.y).toBe(second.y);
  });

  it("gives back the speed of an approach, so the balls part", () => {
    const [first, second] = pushApart(
      [ballAt({ vx: 300, x: 590 }), ballAt({ vx: -300, x: 615 })],
      null
    );
    expect(first.vx).toBeCloseTo(-72, 9);
    expect(second.vx).toBeCloseTo(72, 9);
  });

  it("leaves the speed of two balls that are moving apart alone", () => {
    const [first, second] = pushApart(
      [ballAt({ vx: -100, x: 590 }), ballAt({ vx: 100, x: 615 })],
      null
    );
    expect(first.vx).toBe(-100);
    expect(second.vx).toBe(100);
  });

  it("never moves the held ball when it is the first of a pair, and pushes the other ball away", () => {
    const [first, second] = pushApart(
      [ballAt({ x: 600 }), ballAt({ x: 630 })],
      0
    );
    expect(first.x).toBe(600);
    expect(second.x).toBeGreaterThan(630);
  });

  it("never moves the held ball when it is the second of a pair, and pushes the other ball away", () => {
    const [first, second] = pushApart(
      [ballAt({ x: 600 }), ballAt({ x: 630 })],
      1
    );
    expect(second.x).toBe(630);
    expect(first.x).toBeLessThan(600);
  });
});
