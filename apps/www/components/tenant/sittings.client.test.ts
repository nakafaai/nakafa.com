import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { orderSittings } from "@/components/tenant/sittings.client";

describe("tenant/sittings client", () => {
  it("lists every open sitting before the scheduled ones, and each group by its opening time", () => {
    const listed = orderSittings([
      { id: "late", opensAt: 3, state: "scheduled" },
      { id: "second", opensAt: 5, state: "open" },
      { id: "early", opensAt: 1, state: "scheduled" },
      { id: "first", opensAt: 2, state: "open" },
    ]);
    expect(Arr.map(listed, (sitting) => sitting.id)).toEqual([
      "first",
      "second",
      "early",
      "late",
    ]);
  });

  it("keeps an empty list empty", () => {
    expect(orderSittings([])).toEqual([]);
  });
});
