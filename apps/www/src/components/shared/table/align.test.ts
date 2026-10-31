import { describe, expect, it } from "@effect/vitest";
import { placeOf } from "@/components/shared/table/align";

describe("placeOf", () => {
  it("starts the column that names the row, keeps a column's own place, and centres the rest", () => {
    expect(placeOf(0, undefined)).toBe("start");
    expect(placeOf(1, undefined)).toBe("center");
    expect(placeOf(3, "end")).toBe("end");
    expect(placeOf(4, "menu")).toBe("menu");
  });
});
