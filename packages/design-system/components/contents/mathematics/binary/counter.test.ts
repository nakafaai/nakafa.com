// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  advanceCounter,
  COUNT_SECONDS,
} from "@repo/design-system/components/contents/mathematics/binary/counter";

describe("the panel's counter", () => {
  it("passes no count before a full step", () => {
    expect(advanceCounter(0, COUNT_SECONDS / 2)).toEqual({
      clock: COUNT_SECONDS / 2,
      counts: 0,
    });
  });

  it("counts every whole step and keeps the rest", () => {
    const after = advanceCounter(COUNT_SECONDS / 2, COUNT_SECONDS * 2);
    expect(after.counts).toBe(2);
    expect(after.clock).toBeCloseTo(COUNT_SECONDS / 2, 9);
  });

  it("never runs backwards", () => {
    expect(advanceCounter(0.3, -1)).toEqual({ clock: 0.3, counts: 0 });
  });
});
