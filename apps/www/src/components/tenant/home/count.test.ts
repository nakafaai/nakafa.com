import { describe, expect, it } from "@effect/vitest";
import { countLabel, reachesBound } from "@/components/tenant/home/count";

describe("tenant home counts", () => {
  it("reads an exact count while its list is below the bound", () => {
    expect(countLabel(3, reachesBound(3, 5))).toBe("3");
  });

  it("reads a plus sign once its list reaches the bound", () => {
    expect(countLabel(5, reachesBound(5, 5))).toBe("5+");
  });

  it("reads a plus sign for a count whose read may hide more rows, even below the bound", () => {
    expect(countLabel(2, true)).toBe("2+");
    expect(countLabel(2, false)).toBe("2");
  });
});
