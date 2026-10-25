import { describe, expect, it } from "@effect/vitest";
import { keepVisible } from "@/components/player/navigator/scroll";

const column = { height: 200, scrollTop: 100 };

describe("keepVisible", () => {
  it("stays where it is while the whole cell is in view", () => {
    expect(keepVisible({ ...column, bottom: 190, top: 150 })).toBe(100);
  });

  it("scrolls up to a cell above the column", () => {
    expect(keepVisible({ ...column, bottom: 90, top: 60 })).toBe(60);
  });

  it("scrolls down to a cell below the column", () => {
    expect(keepVisible({ ...column, bottom: 340, top: 300 })).toBe(140);
  });
});
