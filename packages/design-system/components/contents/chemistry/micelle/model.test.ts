import { describe, expect, it } from "@effect/vitest";
import { evaluateMicelleCleaning } from "@repo/design-system/components/contents/chemistry/micelle/model";

describe("soap micelle emulsification model", () => {
  it("lifts grease off fabric in soft water and forms scum in hard water", () => {
    const start = evaluateMicelleCleaning("greaseOnFabric", "soft");
    const insert = evaluateMicelleCleaning("tailInsertion", "soft");
    const liftSoft = evaluateMicelleCleaning("micelleLift", "soft");
    const liftHard = evaluateMicelleCleaning("micelleLift", "hard");
    const rinseSoft = evaluateMicelleCleaning("rinseAway", "soft");
    const rinseHard = evaluateMicelleCleaning("rinseAway", "hard");

    expect(start.soapCount).toBe(0);
    expect(insert.soapCount).toBeGreaterThan(0);
    expect(liftSoft.dropletY).toBeGreaterThan(liftHard.dropletY);
    expect(liftHard.hasScum).toBe(true);
    expect(rinseSoft.dropletY).toBeGreaterThan(liftSoft.dropletY);
    expect(rinseSoft.dropletY).toBeGreaterThan(rinseHard.dropletY);
  });
});
