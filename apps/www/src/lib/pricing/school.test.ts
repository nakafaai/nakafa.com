import { describe, expect, it } from "@effect/vitest";
import { formatSchoolPrice } from "@/lib/pricing/school";

describe("lib/pricing/school", () => {
  it("writes each currency in its own locale and drops whole cents", () => {
    expect(formatSchoolPrice("IDR", 1_790_000)).toBe("Rp 1.790.000");
    expect(formatSchoolPrice("USD", 10_900)).toBe("$109");
    expect(formatSchoolPrice("USD", 10_355)).toBe("$103.55");
    expect(formatSchoolPrice("EUR", 49_900)).toBe("499 €");
  });
});
