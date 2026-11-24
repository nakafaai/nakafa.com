import { describe, expect, it } from "@effect/vitest";
import { twinOutcome } from "@repo/design-system/components/contents/biology/twins/split";

describe("twinOutcome", () => {
  it("gives fraternal twins separate placentas, sacs, different genes, and either sex", () => {
    expect(twinOutcome("fraternal", 5)).toEqual({
      genes: "different",
      joined: false,
      placentas: 2,
      sacs: 2,
      sex: "either",
    });
  });

  it("tracks identical twin sharing across early, mid, late, and conjoined split days", () => {
    expect(twinOutcome("identical", 2)).toEqual({
      genes: "same",
      joined: false,
      placentas: 2,
      sacs: 2,
      sex: "same",
    });
    expect(twinOutcome("identical", 6)).toMatchObject({
      joined: false,
      placentas: 1,
      sacs: 2,
    });
    expect(twinOutcome("identical", 10)).toMatchObject({
      joined: false,
      placentas: 1,
      sacs: 1,
    });
    expect(twinOutcome("identical", 14)).toMatchObject({
      joined: true,
      placentas: 1,
      sacs: 1,
    });
  });
});
