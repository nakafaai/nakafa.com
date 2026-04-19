import {
  canSettleIndexAnchor,
  getIndexAnchorOffset,
  isIndexAnchorSettled,
} from "@repo/design-system/lib/virtual-anchor";
import { describe, expect, it } from "vitest";

describe("virtual-anchor", () => {
  it("treats only start-aligned index anchors as exact restore targets", () => {
    expect(canSettleIndexAnchor({ kind: "bottom" })).toBe(false);
    expect(canSettleIndexAnchor({ kind: "index", index: 3 })).toBe(true);
    expect(
      canSettleIndexAnchor({ kind: "index", index: 3, align: "start" })
    ).toBe(true);
    expect(
      canSettleIndexAnchor({ kind: "index", index: 3, align: "center" })
    ).toBe(false);
  });

  it("resolves the exact scroll offset for start-aligned restore anchors", () => {
    expect(
      getIndexAnchorOffset({
        anchor: { kind: "index", index: 4, offset: 18 },
        itemOffset: 240,
      })
    ).toBe(258);

    expect(
      getIndexAnchorOffset({
        anchor: { kind: "index", index: 4, align: "start", offset: -12 },
        itemOffset: 10,
      })
    ).toBe(0);

    expect(
      getIndexAnchorOffset({
        anchor: { kind: "index", index: 4, align: "center", offset: 18 },
        itemOffset: 240,
      })
    ).toBeNull();
  });

  it("accepts tiny measurement drift while settling an exact restore anchor", () => {
    expect(
      isIndexAnchorSettled({ actualOffset: 257, expectedOffset: 258 })
    ).toBe(true);
    expect(
      isIndexAnchorSettled({ actualOffset: 256, expectedOffset: 258 })
    ).toBe(true);
    expect(
      isIndexAnchorSettled({ actualOffset: 261, expectedOffset: 258 })
    ).toBe(false);
  });
});
