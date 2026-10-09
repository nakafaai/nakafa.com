import { describe, expect, it } from "@effect/vitest";
import {
  getValenceElectronFacts,
  isValenceElectronSampleId,
} from "@repo/design-system/components/contents/chemistry/valence-electron/data";
import { Result } from "effect";

describe("valence electron data", () => {
  it("recognizes only the valence electron sample ids", () => {
    expect(isValenceElectronSampleId("aluminum")).toBe(true);
    expect(isValenceElectronSampleId("neon")).toBe(false);
  });

  it.each([
    [1, "K", 1],
    [2, "K", 2],
    [3, "L", 1],
    [10, "L", 8],
    [11, "M", 1],
    [18, "M", 8],
    [19, "N", 1],
    [20, "N", 2],
  ])(
    "reads the outer shell and valence count of atomic number %i",
    (atomicNumber, outerShellKey, valenceElectronCount) => {
      const facts = Result.getOrThrow(getValenceElectronFacts(atomicNumber));

      expect(facts.outerShell.key).toBe(outerShellKey);
      expect(facts.valenceElectronCount).toBe(valenceElectronCount);
    }
  );

  it("reads the outer occupied shell of aluminum", () => {
    const facts = Result.getOrThrow(getValenceElectronFacts(13));

    expect(facts.configurationMath).toBe("2, 8, 3");
    expect(facts.outerShell.key).toBe("M");
    expect(facts.valenceElectronCount).toBe(3);
  });

  it("reads hydrogen as one occupied shell", () => {
    const facts = Result.getOrThrow(getValenceElectronFacts(1));

    expect(facts.configurationMath).toBe("1");
    expect(facts.outerShell.key).toBe("K");
    expect(facts.valenceElectronCount).toBe(1);
  });

  it("fails outside atomic numbers 1 to 20", () => {
    expect(Result.isFailure(getValenceElectronFacts(0))).toBe(true);
    expect(Result.isFailure(getValenceElectronFacts(21))).toBe(true);
  });
});
