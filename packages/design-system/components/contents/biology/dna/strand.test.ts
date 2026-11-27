// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  basesOf,
  complementOf,
  copiedCount,
  differencesOf,
  gcShareOf,
  identityOf,
  isCopied,
  isOpen,
  spanOf,
  turnsOf,
} from "@repo/design-system/components/contents/biology/dna/strand";

/** The start of the human beta-globin gene (HBB), and its sickle-cell allele. */
const HBB = "ATG GTG CAT CTG ACT CCT GAG GAG AAG";
const SICKLE = "ATG GTG CAT CTG ACT CCT GTG GAG AAG";

describe("reading a sequence", () => {
  it("keeps letters only and writes each strand in its own alphabet", () => {
    expect(basesOf("at g-c", "dna")).toEqual(["A", "T", "G", "C"]);
    expect(basesOf("ATGU", "rna")).toEqual(["A", "U", "G", "U"]);
    expect(basesOf("AUG", "dna")).toEqual(["A", "T", "G"]);
  });

  it("pairs A with T in DNA, A with U in RNA, and G with C in both", () => {
    expect(complementOf("A", "dna")).toBe("T");
    expect(complementOf("A", "rna")).toBe("U");
    expect(complementOf("U", "rna")).toBe("A");
    expect(complementOf("T", "dna")).toBe("A");
    expect(complementOf("G", "dna")).toBe("C");
    expect(complementOf("C", "rna")).toBe("G");
  });
});

describe("the B-DNA helix", () => {
  it("spans 7.14 nm over 21 base pairs, two full turns", () => {
    expect(spanOf(21)).toBeCloseTo(7.14);
    expect(turnsOf(21)).toBe(2);
  });
});

describe("comparing two sequences", () => {
  it("finds the one base that makes the sickle-cell allele", () => {
    const normal = basesOf(HBB, "dna");
    const sickle = basesOf(SICKLE, "dna");
    expect(differencesOf(normal, sickle)).toBe(1);
    expect(identityOf(normal, sickle)).toBeCloseTo(26 / 27);
  });

  it("compares nothing when a strand is empty", () => {
    expect(identityOf([], ["A"])).toBe(0);
    expect(gcShareOf([])).toBe(0);
  });

  it("counts the G and C share", () => {
    expect(gcShareOf(basesOf("GGCCAATT", "dna"))).toBe(0.5);
  });
});

describe("copying a strand", () => {
  it("opens from the top and copies two base pairs behind the fork", () => {
    expect(isOpen(9, 10, 0.1)).toBe(true);
    expect(isOpen(8, 10, 0.1)).toBe(false);
    expect(isCopied(9, 10, 0.1)).toBe(false);
    expect(copiedCount(10, 0)).toBe(0);
    expect(copiedCount(10, 1)).toBe(8);
    expect(copiedCount(0, 1)).toBe(0);
  });
});
