import { describe, expect, it } from "@effect/vitest";
import {
  offeredChanges,
  toggleChange,
} from "@/components/tenant/settings/changes";

describe("offeredChanges", () => {
  it("offers the changes the client's actions read", () => {
    expect(offeredChanges(["grade.export", "unit.view"])).toEqual([
      "grade.released",
      "unit.created",
    ]);
    expect(offeredChanges(["person.view"])).toEqual([
      "grant.created",
      "grant.ended",
    ]);
  });

  it("offers nothing to a client that reads no subject of a change", () => {
    expect(offeredChanges(["cohort.view"])).toEqual([]);
  });
});

describe("toggleChange", () => {
  const offered = ["grade.released", "unit.created"] as const;

  it("adds and removes a change, in the order the list shows them", () => {
    expect(
      toggleChange(offered, ["unit.created"], "grade.released", true)
    ).toEqual(["grade.released", "unit.created"]);
    expect(toggleChange(offered, offered, "unit.created", false)).toEqual([
      "grade.released",
    ]);
  });

  it("keeps the last change checked", () => {
    expect(
      toggleChange(offered, ["unit.created"], "unit.created", false)
    ).toEqual(["unit.created"]);
  });
});
