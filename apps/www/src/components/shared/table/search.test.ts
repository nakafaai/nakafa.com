import { describe, expect, it } from "@effect/vitest";
import { matchesSearch } from "@/components/shared/table/search";

describe("components/shared/table search", () => {
  it("matches a row whose text holds the search, ignoring case and the spaces around it", () => {
    expect(matchesSearch("Siti Aminah", "  aMI ")).toBe(true);
  });

  it("matches every row for a blank search", () => {
    expect(matchesSearch("Budi", "   ")).toBe(true);
    expect(matchesSearch("Budi", "")).toBe(true);
  });

  it("matches no row whose text lacks the search", () => {
    expect(matchesSearch("Budi", "Siti")).toBe(false);
  });
});
