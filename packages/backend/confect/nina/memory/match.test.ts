import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  findTarget,
  sameWords,
  saysSame,
} from "@repo/backend/confect/nina/memory/match";
import {
  type NinaMemoryCandidate,
  NinaMemoryKind,
} from "@repo/backend/confect/nina/memory.spec";
import { Option, Schema } from "effect";

const decode = Schema.decodeUnknownSync(Id("ninaMemories"));

/** A goal Nina wrote. */
const goal = {
  _id: decode("goal"),
  kind: "goal",
  text: "Mau ikut SNBT 2027",
} as const;
/** A level Nina wrote. */
const level = {
  _id: decode("level"),
  kind: "level",
  text: "Kelas 12 IPA",
} as const;
/** A memory the learner wrote: it has no kind. */
const written = { _id: decode("written"), text: "Kelas 12 IPA" } as const;

/** A candidate that states a level in the words of `level`, with any field replaced. */
function candidate(
  fields: Partial<typeof NinaMemoryCandidate.Type> = {}
): typeof NinaMemoryCandidate.Type {
  return { kind: "level", quote: "kelas 12", text: "kelas 12 ipa.", ...fields };
}

/** The id of the memory a candidate confirms among these, or nothing. */
function targetOf(
  memories: Parameters<typeof findTarget>[0],
  fields: Partial<typeof NinaMemoryCandidate.Type> = {}
) {
  return Option.getOrUndefined(
    Option.map(findTarget(memories, candidate(fields)), (memory) => memory._id)
  );
}

describe("memory same words", () => {
  it.each([
    ["Kelas 12 IPA", "Kelas 12 IPA."],
    ["Kelas   12,IPA", "kelas 12 ipa"],
  ])("holds the same words in %j and %j", (first, second) => {
    expect(sameWords(first, second)).toBe(true);
  });

  it.each([
    ["Kelas 12 IPA", "Kelas 12 IPS"],
    [
      "Saya kelas 12 IPA di SMA Negeri 1 Bandung",
      "Saya kelas 12 IPA di SMA Negeri 1 Bandung sekarang",
    ],
  ])("does not hold the same words in %j and %j", (first, second) => {
    expect(sameWords(first, second)).toBe(false);
  });
});

describe("memory text match", () => {
  it.each([
    ["Kelas 12 IPA", "kelas 12 ipa"],
    ["Kelas 12 IPA.", "Kelas   12, IPA"],
    ["Kelas 12,IPA", "kelas 12 ipa"],
    ["Mau ikut SNBT 2027!", "mau ikut snbt 2027"],
  ])("says %j and %j are the same", (first, second) => {
    expect(saysSame(first, second)).toBe(true);
  });

  it("says two texts are the same when their shared words are at least four fifths of all their words", () => {
    // Nine words against ten with all nine shared: 9 of 10.
    expect(
      saysSame(
        "Saya kelas 12 IPA di SMA Negeri 1 Bandung",
        "Saya kelas 12 IPA di SMA Negeri 1 Bandung sekarang"
      )
    ).toBe(true);
    // One word changed in nine: 8 shared of 10 in all, exactly four fifths.
    expect(
      saysSame(
        "Saya kelas 12 IPA di SMA Negeri 1 Bandung",
        "Saya kelas 12 IPS di SMA Negeri 1 Bandung"
      )
    ).toBe(true);
    // Two words changed in nine: 7 shared of 11 in all.
    expect(
      saysSame(
        "Saya kelas 12 IPA di SMA Negeri 1 Bandung",
        "Saya kelas 12 IPS di SMA Negeri 2 Bandung"
      )
    ).toBe(false);
  });

  it.each([
    ["Kelas 12", "Kelas 11"],
    ["Mau ikut SNBT", "Mau ikut UTBK"],
    ["Suka contoh soal dulu", "Sulit di peluang"],
    ["Kelas 12", "..."],
  ])("says %j and %j are different", (first, second) => {
    expect(saysSame(first, second)).toBe(false);
  });
});

describe("memory a candidate confirms", () => {
  it("is the memory it names, else the first memory of its kind that says the same, else none", () => {
    expect(targetOf([goal, level], { known: level._id })).toBe(level._id);
    // The named memory wins over an earlier one that says the same.
    expect(
      targetOf([written, { ...level, text: "Kelas 11" }], {
        known: level._id,
      })
    ).toBe(level._id);
    expect(targetOf([goal, level])).toBe(level._id);
    expect(targetOf([goal], { known: goal._id })).toBeUndefined();
    expect(targetOf([goal, level], { text: "Kelas 11" })).toBeUndefined();
    expect(targetOf([])).toBeUndefined();
  });

  it("is never a memory of another kind, though it names it or says the same", () => {
    expect(
      targetOf([goal], { known: goal._id, text: "Mau ikut SNBT 2027" })
    ).toBeUndefined();
    expect(targetOf([{ ...goal, text: level.text }])).toBeUndefined();
    // A named memory of another kind does not stop it from finding one of its own kind.
    expect(
      targetOf([goal, level], { known: goal._id, text: "Kelas 12 IPA" })
    ).toBe(level._id);
  });

  it.each(NinaMemoryKind.literals)(
    "is a memory without a kind for a candidate of the %s kind, by name or by saying the same",
    (kind) => {
      expect(
        targetOf([written], { kind, known: written._id, text: "Kelas 11" })
      ).toBe(written._id);
      expect(targetOf([written], { kind })).toBe(written._id);
    }
  );

  it("is the first memory in the order given among those that take its kind", () => {
    const other = { ...goal, text: level.text };
    expect(targetOf([other, written, level])).toBe(written._id);
    expect(targetOf([level, written])).toBe(level._id);
  });
});
