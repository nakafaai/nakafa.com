import { describe, expect, it } from "@effect/vitest";
import {
  getSimpleShellConfiguration,
  isElectronConfigurationSampleId,
} from "@repo/design-system/components/contents/chemistry/electron-configuration/data";
import { Array as Arr, Result } from "effect";

describe("electron configuration data", () => {
  it("recognizes only the electron configuration sample ids", () => {
    expect(isElectronConfigurationSampleId("carbon")).toBe(true);
    expect(isElectronConfigurationSampleId("iron")).toBe(false);
  });

  it("fills the simple shell pattern for the first 20 elements", () => {
    const carbon = Result.getOrThrow(getSimpleShellConfiguration(6));
    const calcium = Result.getOrThrow(getSimpleShellConfiguration(20));

    expect(Arr.map(carbon, (shell) => shell.electronCount)).toEqual([
      2, 4, 0, 0,
    ]);
    expect(Arr.map(calcium, (shell) => shell.electronCount)).toEqual([
      2, 8, 8, 2,
    ]);
  });

  it("fails for atomic numbers that are not positive integers", () => {
    for (const atomicNumber of [0, 1.5]) {
      const result = getSimpleShellConfiguration(atomicNumber);

      expect(Result.isFailure(result) && result.failure.reason).toBe(
        "notPositiveInteger"
      );
    }
  });

  it("fails above the supported range", () => {
    const result = getSimpleShellConfiguration(21);

    expect(Result.isFailure(result) && result.failure.reason).toBe(
      "aboveSupportedRange"
    );
  });
});
