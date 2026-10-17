import { describe, expect, it } from "@effect/vitest";
import {
  countLearnerCharacters,
  LEARNER_TEXT_MAX_LENGTH,
  learnerTextValidator,
  readLearnerText,
} from "@repo/backend/confect/writing/text";
import { Result, Schema } from "effect";

describe("writing/text", () => {
  it.each([
    ["Halo dunia.", "Halo dunia."],
    ["  Satu kalimat.  ", "Satu kalimat."],
    ["\n\nBaris satu\n\nbaris dua\t", "Baris satu\n\nbaris dua"],
  ])("reads %j as the text %j", (input, text) => {
    expect(readLearnerText(input)).toEqual(Result.succeed(text));
  });

  it.each(["", " ", "\n\t \r\n"])("refuses the empty text %j", (input) => {
    expect(readLearnerText(input)).toEqual(Result.fail("POST_TEXT_EMPTY"));
  });

  it("accepts a text of the limit and refuses one character more", () => {
    const limit = "a".repeat(LEARNER_TEXT_MAX_LENGTH);
    expect(readLearnerText(limit)).toEqual(Result.succeed(limit));
    expect(readLearnerText(`${limit}a`)).toEqual(
      Result.fail("POST_TEXT_TOO_LONG")
    );
  });

  it("counts white space at the ends out of the limit, because it is trimmed first", () => {
    const padded = `${" ".repeat(20)}${"a".repeat(LEARNER_TEXT_MAX_LENGTH)}${" ".repeat(20)}`;
    expect(readLearnerText(padded)).toEqual(
      Result.succeed("a".repeat(LEARNER_TEXT_MAX_LENGTH))
    );
  });

  it("counts an emoji as one character, though it takes two UTF-16 units", () => {
    const emoji = "😀".repeat(LEARNER_TEXT_MAX_LENGTH);
    expect(countLearnerCharacters(emoji)).toBe(LEARNER_TEXT_MAX_LENGTH);
    expect(readLearnerText(emoji)).toEqual(Result.succeed(emoji));
    expect(readLearnerText(`${emoji}😀`)).toEqual(
      Result.fail("POST_TEXT_TOO_LONG")
    );
  });

  it("stores only a trimmed text of one to the limit's characters", () => {
    const isStored = Schema.is(learnerTextValidator);
    expect(isStored("Halo")).toBe(true);
    expect(isStored(" Halo")).toBe(false);
    expect(isStored("")).toBe(false);
    expect(isStored("a".repeat(LEARNER_TEXT_MAX_LENGTH + 1))).toBe(false);
  });
});
