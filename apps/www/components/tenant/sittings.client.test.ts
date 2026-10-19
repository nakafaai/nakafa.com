import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { orderSittings } from "@/components/tenant/sittings.client";

describe("tenant/sittings client", () => {
  it("lists every open sitting before the scheduled ones, and each group by its opening time", () => {
    const listed = orderSittings([
      { attempt: null, id: "late", opensAt: 3, state: "scheduled" },
      { attempt: null, id: "second", opensAt: 5, state: "open" },
      { attempt: null, id: "early", opensAt: 1, state: "scheduled" },
      { attempt: null, id: "first", opensAt: 2, state: "open" },
    ]);
    expect(Arr.map(listed, (sitting) => sitting.id)).toEqual([
      "first",
      "second",
      "early",
      "late",
    ]);
  });

  it("lists the sittings the student finished, or that closed, after the ones to act on", () => {
    const listed = orderSittings([
      { attempt: "submitted", id: "done-open", opensAt: 1, state: "open" },
      { attempt: null, id: "closed", opensAt: 2, state: "closed" },
      { attempt: null, id: "scheduled", opensAt: 3, state: "scheduled" },
      { attempt: "inProgress", id: "open", opensAt: 4, state: "open" },
      { attempt: "submitted", id: "done-closed", opensAt: 0, state: "closed" },
    ]);
    expect(Arr.map(listed, (sitting) => sitting.id)).toEqual([
      "open",
      "scheduled",
      "done-closed",
      "done-open",
      "closed",
    ]);
  });

  it("keeps an empty list empty", () => {
    expect(orderSittings([])).toEqual([]);
  });
});
