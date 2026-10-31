import { describe, expect, it } from "@effect/vitest";
import { placeOf } from "@/components/shared/table/align";

describe("placeOf", () => {
  it("starts the column that names the row, keeps the menu at the end, and centres the rest", () => {
    expect(placeOf(0, false)).toBe("start");
    expect(placeOf(1, false)).toBe("center");
    expect(placeOf(4, true)).toBe("menu");
  });
});
