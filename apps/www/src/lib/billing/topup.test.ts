import { describe, expect, it } from "@effect/vitest";
import { topUpPriceText } from "@/lib/billing/topup";

describe("lib/billing/topup", () => {
  it("writes one pack's price in the digits and the locale of each currency", () => {
    expect(topUpPriceText("EUR")).toContain("4,99");
    expect(topUpPriceText("EUR")).toContain("€");
    expect(topUpPriceText("IDR")).toContain("59.000");
    expect(topUpPriceText("IDR")).toContain("Rp");
    expect(topUpPriceText("USD")).toBe("$4.99");
  });
});
