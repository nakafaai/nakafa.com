import { describe, expect, it } from "@effect/vitest";
import { formatSchoolPrice, formatStorage } from "@/lib/pricing/school";

describe("lib/pricing/school", () => {
  it("writes each currency in its own locale and drops whole cents", () => {
    expect(formatSchoolPrice("IDR", 1_790_000)).toBe("Rp 1.790.000");
    expect(formatSchoolPrice("USD", 10_900)).toBe("$109");
    expect(formatSchoolPrice("USD", 10_355)).toBe("$103.55");
    expect(formatSchoolPrice("EUR", 49_900)).toBe("499 €");
  });

  it("writes storage in the largest unit it fills, in the reader's locale", () => {
    expect(formatStorage(250, "en")).toBe("250 MB");
    expect(formatStorage(10_200, "en")).toBe("10.2 GB");
    expect(formatStorage(10_200, "de")).toBe("10,2 GB");
    expect(formatStorage(1_000_000, "id")).toBe("1 TB");
  });
});
