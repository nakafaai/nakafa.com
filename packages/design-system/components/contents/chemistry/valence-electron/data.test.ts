import { describe, expect, it } from "@effect/vitest";
import {
  getValenceElectronFacts,
  isValenceElectronSampleId,
} from "@repo/design-system/components/contents/chemistry/valence-electron/data";
import { Option, Result } from "effect";

describe("valence electron data", () => {
  it("recognizes only the valence electron sample ids", () => {
    expect(isValenceElectronSampleId("aluminum")).toBe(true);
    expect(isValenceElectronSampleId("neon")).toBe(false);
  });

  it("reads the outer occupied shell of aluminum", () => {
    const facts = Result.getOrThrow(getValenceElectronFacts(13));

    expect(facts.configurationMath).toBe("2, 8, 3");
    expect(Option.getOrUndefined(facts.outerShell)?.key).toBe("M");
  });

  it("reads hydrogen as one occupied shell", () => {
    const facts = Result.getOrThrow(getValenceElectronFacts(1));

    expect(facts.configurationMath).toBe("1");
    expect(Option.getOrUndefined(facts.outerShell)?.key).toBe("K");
  });

  it("fails outside atomic numbers 1 to 20", () => {
    expect(Result.isFailure(getValenceElectronFacts(0))).toBe(true);
    expect(Result.isFailure(getValenceElectronFacts(21))).toBe(true);
  });
});
