import { describe, expect, it } from "@effect/vitest";
import { messages } from "@repo/backend/test/judgment/message";
import { Array as Arr, HashSet, String as Str } from "effect";

/** Two groups of digits with a space between them, as a phone number is often written. */
const SPACED_DIGITS = /\d \d/u;

/** How many messages of the set a predicate holds for. */
const count = (predicate: (row: (typeof messages)[number]) => boolean) =>
  Arr.length(Arr.filter(messages, predicate));

/** The languages of the set, one code each, with the mixed messages split and the undetermined one left out. */
const languages = HashSet.fromIterable(
  Arr.filter(
    Arr.flatMap(messages, ({ languages: codes }) => Str.split(codes, "+")),
    (code) => code !== "und"
  )
);

describe("the labelled messages", () => {
  it("holds at least 80 messages, no two the same", () => {
    expect(Arr.length(messages)).toBeGreaterThanOrEqual(80);
    expect(
      HashSet.size(HashSet.fromIterable(Arr.map(messages, (row) => row.text)))
    ).toBe(Arr.length(messages));
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
        Arr.map(messages, (row) => row.script),
        (script) => script !== "Zyyy"
      )
    );
    expect(HashSet.size(scripts)).toBeGreaterThanOrEqual(4);
  });

  it("states something lasting in about half of the messages", () => {
    const share = count((row) => row.lasting) / Arr.length(messages);
    expect(share).toBeGreaterThanOrEqual(0.4);
    expect(share).toBeLessThanOrEqual(0.6);
  });

  it("holds messages with private data of different forms, a phone number written with spaces among them, and describes them by form", () => {
    expect(count((row) => row.form !== undefined)).toBeGreaterThanOrEqual(15);
    expect(
      count((row) => row.form === "phone" && SPACED_DIGITS.test(row.text))
    ).toBeGreaterThanOrEqual(1);
  });

  it("holds mixed-language and very short messages, and a lasting message that holds private data", () => {
    expect(
      count((row) => Str.includes("+")(row.languages))
    ).toBeGreaterThanOrEqual(3);
    expect(
      count((row) => Arr.length(Arr.fromIterable(row.text)) <= 12)
    ).toBeGreaterThanOrEqual(3);
    expect(
      count((row) => row.lasting && row.form !== undefined)
    ).toBeGreaterThanOrEqual(1);
  });
});
