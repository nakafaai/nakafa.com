import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import {
  enterableSitting,
  orderSittings,
} from "@/components/tenant/sittings.client";

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

describe("enterableSitting", () => {
  it("gives the first open sitting that the student has not submitted", () => {
    const sitting = enterableSitting([
      { attempt: "submitted", id: "done", opensAt: 1, state: "open" },
      { attempt: "inProgress", id: "started", opensAt: 2, state: "open" },
      { attempt: null, id: "fresh", opensAt: 3, state: "open" },
    ]);
    expect(Option.map(sitting, (listed) => listed.id)).toEqual(
      Option.some("started")
    );
  });

  it("gives none when no sitting is open for the student to enter", () => {
    expect(
      enterableSitting([
        { attempt: null, id: "scheduled", opensAt: 1, state: "scheduled" },
        { attempt: "submitted", id: "done", opensAt: 2, state: "open" },
        { attempt: null, id: "closed", opensAt: 3, state: "closed" },
      ])
    ).toEqual(Option.none());
  });
});
