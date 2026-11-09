import { describe, expect, it } from "@effect/vitest";
import { schoolProductOffers } from "@/lib/marketing/school";

describe("lib/marketing/school", () => {
  it("states each paid plan's monthly price in every currency in major units", () => {
    expect(schoolProductOffers).toStrictEqual([
      {
        name: "Nakafa School Pro",
        offers: [
          { amount: 109, currency: "EUR" },
          { amount: 1_790_000, currency: "IDR" },
          { amount: 449, currency: "MYR" },
          { amount: 109, currency: "USD" },
        ],
      },
      {
        name: "Nakafa School Max",
        offers: [
          { amount: 499, currency: "EUR" },
          { amount: 7_990_000, currency: "IDR" },
          { amount: 1990, currency: "MYR" },
          { amount: 499, currency: "USD" },
        ],
      },
    ]);
  });
});
