import { describe, expect, it } from "@effect/vitest";
import { countLabel } from "@/components/tenant/home/count";

describe("tenant home counts", () => {
  it("reads an exact count while its list is below the bound", () => {
    expect(countLabel(2, 2, 5)).toBe("2");
    expect(countLabel(0, 0, 4)).toBe("0");
  });

  it("reads a plus sign once its list reaches the bound", () => {
    expect(countLabel(5, 5, 5)).toBe("5+");
    expect(countLabel(4, 4, 4)).toBe("4+");
  });

  it("counts only the rows the read returned, so a bound never shows as a false total", () => {
    expect(countLabel(2, 5, 5)).toBe("2+");
  });
});
