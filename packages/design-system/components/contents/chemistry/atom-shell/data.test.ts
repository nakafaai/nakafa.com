import { describe, expect, it } from "@effect/vitest";
import {
  getEarlyElementShellConfiguration,
  isAtomShellSampleId,
} from "@repo/design-system/components/contents/chemistry/atom-shell/data";
import { Array as Arr, Result } from "effect";

describe("atom shell data", () => {
  it("recognizes only the atom shell sample ids", () => {
    expect(isAtomShellSampleId("calcium")).toBe(true);
    expect(isAtomShellSampleId("iron")).toBe(false);
  });

  it("fills shells in order up to calcium with their capacities", () => {
    const shells = Result.getOrThrow(getEarlyElementShellConfiguration(20));

    expect(Arr.map(shells, (shell) => shell.electronCount)).toEqual([
      2, 8, 8, 2,
    ]);
    expect(Arr.map(shells, (shell) => shell.maximumElectrons)).toEqual([
      2, 8, 18, 32,
    ]);
  });

  it("stops filling shells when the electrons run out", () => {
    const shells = Result.getOrThrow(getEarlyElementShellConfiguration(12));

    expect(Arr.map(shells, (shell) => shell.electronCount)).toEqual([
      2, 8, 2, 0,
    ]);
  });

  it("fails outside atomic numbers 1 to 20 with the range error", () => {
    for (const atomicNumber of [0, 1.5, 21]) {
      const result = getEarlyElementShellConfiguration(atomicNumber);

      expect(Result.isFailure(result) && result.failure._tag).toBe(
        "EarlyElementShellRangeError"
      );
    }
  });
});
