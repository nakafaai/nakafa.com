// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { toolbarLayout } from "@repo/design-system/components/contents/mathematics/venn/toolbar";
import { Array as Arr } from "effect";

/** The columns each grid preset of the toggle group runs through as the screen widens, for a toolbar of `count` buttons. */
const PRESET_WIDTHS = {
  "2": (count: number) => [count],
  "3": () => [1, 3],
  "4": () => [2, 4],
  "6": () => [2, 3, 6],
} as const;

describe("toolbarLayout", () => {
  it("fills every row at every width, for one to seven operations", () => {
    const filled = Arr.every(Arr.range(1, 7), (count) => {
      const { columns, lastSpan } = toolbarLayout(count);
      const cells = count + lastSpan - 1;
      return Arr.every(
        PRESET_WIDTHS[columns](count),
        (width) => cells % width === 0
      );
    });
    expect(filled).toBe(true);
  });

  it("widens the last operation only when a row would end short", () => {
    expect(
      Arr.map(Arr.range(1, 7), (count) => toolbarLayout(count).lastSpan)
    ).toEqual([1, 1, 1, 1, 2, 1, 2]);
  });
});
