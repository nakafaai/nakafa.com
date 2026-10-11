import { describe, expect, it } from "@effect/vitest";
import { textQuery } from "@repo/backend/confect/contents/sections/terms";
import { Array as Arr, String as Str } from "effect";

describe("text query", () => {
  it("keeps the words and numbers of a question and drops its punctuation", () => {
    expect(textQuery("Apa itu rumus ABC, untuk x^2 + 5x = 0?")).toBe(
      "Apa itu rumus ABC untuk x 2 5x 0"
    );
  });

  it("keeps letters of every alphabet", () => {
    expect(textQuery("Was ist eine quadratische Gleichung? المعادلة")).toBe(
      "Was ist eine quadratische Gleichung المعادلة"
    );
  });

  it("reads a question longer than Convex accepts as its first sixteen words", () => {
    const words = Arr.makeBy(20, (index) => `kata${index}`);
    expect(Str.split(textQuery(Arr.join(words, " ")), " ")).toEqual(
      Arr.take(words, 16)
    );
  });

  it("drops a word too long to be a search term", () => {
    const long = "a".repeat(40);
    expect(textQuery(`bilangan ${long} prima`)).toBe("bilangan prima");
    expect(textQuery("é".repeat(16))).toBe("");
  });

  it("is empty when the question has no usable word", () => {
    expect(textQuery("?!")).toBe("");
    expect(textQuery("")).toBe("");
  });
});
