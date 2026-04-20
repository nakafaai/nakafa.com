import {
  getAlignedScrollOffset,
  getMeasuredVirtualItem,
} from "@repo/design-system/lib/virtual-conversation";
import { describe, expect, it } from "vitest";

describe("virtual conversation utils", () => {
  it("returns one measured item when the requested index exists", () => {
    expect(
      getMeasuredVirtualItem(
        [
          {
            end: 80,
            index: 0,
            key: 0,
            lane: 0,
            size: 80,
            start: 0,
          },
        ],
        0
      )
    ).toEqual({
      end: 80,
      index: 0,
      key: 0,
      lane: 0,
      size: 80,
      start: 0,
    });

    expect(getMeasuredVirtualItem([], 0)).toBeNull();
  });

  it("applies start offsets by moving the item farther from the viewport top", () => {
    expect(
      getAlignedScrollOffset({
        align: "start",
        offset: 24,
        totalSize: 600,
        viewportHeight: 200,
        virtualOffset: 120,
      })
    ).toBe(96);
  });

  it("applies center and end offsets by moving the item farther from the viewport bottom", () => {
    expect(
      getAlignedScrollOffset({
        align: "center",
        offset: 24,
        totalSize: 600,
        viewportHeight: 200,
        virtualOffset: 120,
      })
    ).toBe(144);

    expect(
      getAlignedScrollOffset({
        align: "end",
        offset: 24,
        totalSize: 600,
        viewportHeight: 200,
        virtualOffset: 120,
      })
    ).toBe(144);
  });

  it("keeps TanStack's offset unchanged for auto alignment and clamps boundaries", () => {
    expect(
      getAlignedScrollOffset({
        align: "auto",
        offset: 24,
        totalSize: 600,
        viewportHeight: 200,
        virtualOffset: 120,
      })
    ).toBe(120);

    expect(
      getAlignedScrollOffset({
        align: "start",
        offset: 80,
        totalSize: 600,
        viewportHeight: 200,
        virtualOffset: 40,
      })
    ).toBe(0);

    expect(
      getAlignedScrollOffset({
        align: "end",
        offset: 80,
        totalSize: 600,
        viewportHeight: 200,
        virtualOffset: 360,
      })
    ).toBe(400);
  });
});
