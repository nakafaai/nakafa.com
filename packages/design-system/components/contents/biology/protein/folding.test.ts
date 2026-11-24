import { describe, expect, it } from "@effect/vitest";
import {
  activeBonds,
  CONDITIONS,
  isWorking,
  LEVELS,
  polypeptideBeads,
} from "@repo/design-system/components/contents/biology/protein/folding";

describe("activeBonds", () => {
  it("keeps covalent peptide bonds intact under heat and acid while breaking weak bonds", () => {
    expect(activeBonds("primary", "normal")).toEqual(["peptide"]);
    expect(activeBonds("secondary", "normal")).toEqual(["peptide", "hydrogen"]);
    expect(activeBonds("tertiary", "normal")).toEqual([
      "peptide",
      "hydrogen",
      "ionic",
      "hydrophobic",
    ]);
    expect(activeBonds("quaternary", "normal")).toEqual([
      "peptide",
      "hydrogen",
      "ionic",
      "hydrophobic",
    ]);
    expect(activeBonds("quaternary", "heated")).toEqual(["peptide"]);
    expect(activeBonds("tertiary", "acid")).toEqual(["peptide"]);
  });
});

describe("isWorking", () => {
  it("is true only for normal folded tertiary and quaternary structures", () => {
    expect(isWorking("primary", "normal")).toBe(false);
    expect(isWorking("secondary", "normal")).toBe(false);
    expect(isWorking("tertiary", "normal")).toBe(true);
    expect(isWorking("quaternary", "normal")).toBe(true);
    expect(isWorking("quaternary", "heated")).toBe(false);
    expect(isWorking("tertiary", "acid")).toBe(false);
  });
});

describe("polypeptideBeads", () => {
  it("generates beads for every folding level and denaturation condition", () => {
    for (const level of LEVELS) {
      for (const condition of CONDITIONS) {
        expect(
          polypeptideBeads(level, condition).length
        ).toBeGreaterThanOrEqual(16);
      }
    }
    expect(polypeptideBeads("quaternary", "normal")).toHaveLength(32);
  });
});
