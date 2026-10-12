import { describe, expect, it } from "@effect/vitest";
import { labelledSet } from "@repo/backend/test/judgment/set";
import { Array as Arr, HashSet, Result, String as Str } from "effect";

/** Two groups of digits with a space between them, as a phone number is often written. */
const SPACED_DIGITS = /\d \d/u;

/** How many messages of the set a predicate holds for. */
const count = (predicate: (row: (typeof labelledSet)[number]) => boolean) =>
  Arr.length(Arr.filter(labelledSet, predicate));

/** The languages of the set, one code each, with the mixed messages split and the undetermined one left out. */
const languages = HashSet.fromIterable(
  Arr.filter(
    Arr.flatMap(labelledSet, ({ languages: codes }) => Str.split(codes, "+")),
    (code) => code !== "und"
  )
);

describe("the labelled set of messages", () => {
  it("holds at least 80 messages, no two the same", () => {
    expect(Arr.length(labelledSet)).toBeGreaterThanOrEqual(80);
    expect(
      HashSet.size(
        HashSet.fromIterable(Arr.map(labelledSet, (row) => row.text))
      )
    ).toBe(Arr.length(labelledSet));
  });

  it("covers at least ten languages and four scripts, among them every language the owner named", () => {
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
    const scripts = HashSet.fromIterable(
      Arr.filter(
        Arr.map(labelledSet, (row) => row.script),
        (script) => script !== "Zyyy"
      )
    );
    expect(HashSet.size(scripts)).toBeGreaterThanOrEqual(4);
  });

  it("states something lasting in about half of the messages", () => {
    const share = count((row) => row.lasting) / Arr.length(labelledSet);
    expect(share).toBeGreaterThanOrEqual(0.4);
    expect(share).toBeLessThanOrEqual(0.6);
  });

  it("holds private data in at least 15 messages, names its form, and names none for a message without any", () => {
    expect(count((row) => row.private)).toBeGreaterThanOrEqual(15);
    expect(count((row) => row.private && row.form === undefined)).toBe(0);
    expect(count((row) => !row.private && row.form !== undefined)).toBe(0);
  });

  it("holds each form of private data the judgment must catch, a phone number written with spaces among them", () => {
    const forms = HashSet.fromIterable(
      Arr.filterMap(labelledSet, (row) =>
        row.form === undefined ? Result.failVoid : Result.succeed(row.form)
      )
    );
    for (const form of ["phone", "address", "illness", "religion", "salary"]) {
      expect(HashSet.has(forms, form)).toBe(true);
    }
    expect(
      count((row) => row.form === "phone" && SPACED_DIGITS.test(row.text))
    ).toBeGreaterThanOrEqual(1);
  });

  it("holds mixed-language and very short messages, and a message of each judgment's yes and no", () => {
    expect(
      count((row) => Str.includes("+")(row.languages))
    ).toBeGreaterThanOrEqual(3);
    expect(
      count((row) => Arr.length(Arr.fromIterable(row.text)) <= 12)
    ).toBeGreaterThanOrEqual(3);
    expect(count((row) => row.lasting && row.private)).toBeGreaterThanOrEqual(
      1
    );
    expect(
      count((row) => !(row.lasting || row.private))
    ).toBeGreaterThanOrEqual(1);
  });
});
