import { describe, expect, it } from "@effect/vitest";
import { notes } from "@repo/backend/test/judgment/note";
import { Array as Arr, HashSet, Result, String as Str } from "effect";

/** Two groups of digits with a space between them, as a phone number is often written. */
const SPACED_DIGITS = /\d \d/u;

type Row = (typeof notes)[number];

/** How many notes of the set a predicate holds for. */
const count = (predicate: (row: Row) => boolean) =>
  Arr.length(Arr.filter(notes, predicate));

/** The languages of some notes, one code each, with the mixed notes split. */
const languagesOf = (rows: readonly Row[]) =>
  HashSet.fromIterable(
    Arr.flatMap(rows, ({ languages }) => Str.split(languages, "+"))
  );

describe("the labelled notes", () => {
  it("holds at least 80 notes, no two the same", () => {
    expect(Arr.length(notes)).toBeGreaterThanOrEqual(80);
    expect(
      HashSet.size(
        HashSet.fromIterable(
          Arr.map(notes, (row) => `${row.text}\n${row.quote}`)
        )
      )
    ).toBe(Arr.length(notes));
    expect(count((row) => row.quote === "" || row.text === "")).toBe(0);
  });

  it("covers at least ten languages and four scripts, among them every language the owner named", () => {
    const languages = languagesOf(notes);
    expect(HashSet.size(languages)).toBeGreaterThanOrEqual(10);
    for (const code of [
      "id",
      "jv",
      "su",
      "en",
      "de",
      "ar",
      "ja",
      "zh",
      "hi",
      "es",
    ]) {
      expect(HashSet.has(languages, code)).toBe(true);
    }
    expect(
      HashSet.size(HashSet.fromIterable(Arr.map(notes, (row) => row.script)))
    ).toBeGreaterThanOrEqual(4);
  });

  it("holds an answer of each kind for each judgment, so that a threshold can separate them", () => {
    for (const label of [true, false]) {
      expect(count((row) => row.ownNote === label)).toBeGreaterThanOrEqual(15);
      expect(count((row) => row.private === label)).toBeGreaterThanOrEqual(15);
    }
  });

  it("holds sentences that are not the learner's own note in at least ten languages", () => {
    expect(
      HashSet.size(languagesOf(Arr.filter(notes, (row) => !row.ownNote)))
    ).toBeGreaterThanOrEqual(10);
  });

  it("holds each form of private data the judgment must catch, a phone number written with spaces among them", () => {
    const forms = HashSet.fromIterable(
      Arr.filterMap(notes, (row) =>
        row.private && row.form !== undefined
          ? Result.succeed(row.form)
          : Result.failVoid
      )
    );
    for (const form of ["phone", "address", "illness", "religion", "salary"]) {
      expect(HashSet.has(forms, form)).toBe(true);
    }
    expect(
      count((row) => row.form === "phone" && SPACED_DIGITS.test(row.text))
    ).toBeGreaterThanOrEqual(1);
  });

  it("describes a note by its fault when it is private or not the learner's own, and by nothing when it is neither", () => {
    expect(
      count((row) => (row.private || !row.ownNote) && row.form === undefined)
    ).toBe(0);
    expect(
      count((row) => row.ownNote && !row.private && row.form !== undefined)
    ).toBe(0);
  });

  it("holds mixed-language and very short notes, and a sentence that is both private and not the learner's own", () => {
    expect(
      count((row) => Str.includes("+")(row.languages))
    ).toBeGreaterThanOrEqual(2);
    expect(
      count((row) => Arr.length(Arr.fromIterable(row.text)) <= 12)
    ).toBeGreaterThanOrEqual(2);
    expect(count((row) => row.private && !row.ownNote)).toBeGreaterThanOrEqual(
      1
    );
  });
});
