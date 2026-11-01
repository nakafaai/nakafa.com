import { describe, expect, it } from "@effect/vitest";
import { menuPlaceOf, placeOf } from "@/components/shared/table/align";

describe("menuPlaceOf", () => {
  it("opens the first column's menu at the start, the last's at the end, and the rest centred", () => {
    expect(menuPlaceOf(0, 4)).toBe("start");
    expect(menuPlaceOf(2, 4)).toBe("center");
    expect(menuPlaceOf(4, 4)).toBe("end");
  });
});

describe("placeOf", () => {
  it("starts the column that names the row, keeps a column's own place, and centres the rest", () => {
    expect(placeOf(0, undefined)).toBe("start");
    expect(placeOf(1, undefined)).toBe("center");
    expect(placeOf(3, "end")).toBe("end");
    expect(placeOf(4, "menu")).toBe("menu");
  });
});
