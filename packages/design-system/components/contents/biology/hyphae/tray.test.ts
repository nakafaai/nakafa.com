// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type { Segment } from "@repo/design-system/components/contents/biology/hyphae/growth";
import { TEMPEH } from "@repo/design-system/components/contents/biology/hyphae/growth";
import {
  BEAN,
  beanPoint,
  beansOf,
  reliefAt,
  shownBy,
  stalksOf,
  THREAD_RADIUS,
  threadPlacements,
} from "@repo/design-system/components/contents/biology/hyphae/tray";
import { Array as Arr, Order } from "effect";
import { Matrix4, Vector3 } from "three";

/** One bean lying at the tray's middle, unturned, back up or face up. */
function bean(domed: boolean) {
  return { domed, turn: 0, x: 0, y: 0 };
}

describe("beansOf", () => {
  it("lays thirty halves inside the tray, some back up and some face up", () => {
    const beans = beansOf();
    const half = TEMPEH.size / 2;

    expect(beans).toHaveLength(30);
    expect(
      Arr.every(
        beans,
        (each) => Math.abs(each.x) < half && Math.abs(each.y) < half
      )
    ).toBe(true);
    expect(Arr.some(beans, (each) => each.domed)).toBe(true);
    expect(Arr.some(beans, (each) => !each.domed)).toBe(true);
  });
});

describe("beanPoint", () => {
  it("keeps the rounded back and presses the underside into a hollow split face", () => {
    expect(beanPoint(0, 1, 0)[1]).toBeCloseTo(BEAN.high);
    expect(beanPoint(0, -1, 0)[1]).toBeCloseTo(BEAN.high * 0.07);
    expect(beanPoint(1, 0, 0)[0]).toBeCloseTo(BEAN.long);
  });

  it("bends the outline into a kidney", () => {
    expect(beanPoint(1, 0, 0)[2]).toBeGreaterThan(beanPoint(0, 0, 0)[2]);
  });
});

describe("reliefAt", () => {
  it("stands as high as a bean's back at its middle and falls to the leaf beside it", () => {
    expect(reliefAt([bean(true)], 0, 0)).toBeCloseTo(BEAN.high);
    expect(reliefAt([bean(true)], BEAN.long * 0.9, 0)).toBeLessThan(
      BEAN.high * 0.5
    );
    expect(reliefAt([bean(true)], BEAN.long * 1.2, 0)).toBe(0);
    expect(reliefAt([], 0, 0)).toBe(0);
  });

  it("is nearly flat across a bean lying face up", () => {
    expect(reliefAt([bean(false)], 0, 0)).toBeCloseTo(BEAN.high * 0.93);
    expect(reliefAt([bean(false)], BEAN.long * 0.9, 0)).toBeGreaterThan(
      BEAN.high * 0.9
    );
  });
});

describe("threadPlacements", () => {
  it("lays each stretch as a thin tube from one end to the other, lifted onto the bean under it", () => {
    const segments: readonly Segment[] = [
      [0, 0, 0.5, 0],
      [10, 10, 10, 10.25],
    ];
    const placements = threadPlacements(segments, [bean(true)]);
    const first = new Matrix4().fromArray(placements, 0);
    const from = new Vector3(0, -0.5, 0).applyMatrix4(first);
    const to = new Vector3(0, 0.5, 0).applyMatrix4(first);
    const side = new Vector3(1, 0, 0)
      .applyMatrix4(first)
      .sub(new Vector3(0, 0, 0).applyMatrix4(first));

    expect(placements).toHaveLength(32);
    expect(from.x).toBeCloseTo(0);
    expect(from.y).toBeGreaterThan(BEAN.high);
    expect(to.x).toBeCloseTo(0.5);
    expect(to.y).toBeLessThan(from.y);
    expect(side.length()).toBeCloseTo(THREAD_RADIUS);
    expect(first.determinant()).toBeGreaterThan(0);

    const second = new Matrix4().fromArray(placements, 16);
    const flat = new Vector3(0, 0.5, 0).applyMatrix4(second);
    expect(flat.z).toBeCloseTo(10.25);
    expect(flat.y).toBeLessThan(0.2);
  });

  it("gives a stretch that did not move no size rather than no number", () => {
    const placements = threadPlacements([[1, 1, 1, 1]], []);

    expect(Arr.every([...placements], Number.isFinite)).toBe(true);
  });
});

describe("stalksOf", () => {
  it("raises a few stalks from aged stretches, in the order they appear", () => {
    const segments = Arr.makeBy(
      4000,
      (index): Segment => [0, 0, (index % 30) - 15, Math.floor(index / 300) - 6]
    );
    const stalks = stalksOf(segments, beansOf(), (index) => index / 200);
    const appearances = Arr.map(stalks, (stalk) => stalk.appears);

    expect(stalks.length).toBeGreaterThan(10);
    expect(stalks.length).toBeLessThan(200);
    expect(appearances).toEqual(Arr.sort(appearances, Order.Number));
    expect(Math.min(...appearances)).toBeGreaterThanOrEqual(14);
    expect(
      Arr.every(stalks, (stalk) => stalk.height >= 1.1 && stalk.height <= 2.4)
    ).toBe(true);
  });
});

describe("shownBy", () => {
  it("counts what has appeared by an hour", () => {
    expect(shownBy([1, 2, 5, 8], 5)).toBe(3);
    expect(shownBy([1, 2, 5, 8], 0)).toBe(0);
  });
});
