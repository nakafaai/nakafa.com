import { describe, expect, it } from "@effect/vitest";
import {
  countPostCharacters,
  POST_TEXT_MAX_LENGTH,
  postTextValidator,
  readPostText,
  remainingPostCharacters,
} from "@repo/backend/confect/posts/schema";
import { Result, Schema } from "effect";

describe("posts/schema", () => {
  it.each([
    ["Halo dunia.", "Halo dunia."],
    ["  Satu kalimat.  ", "Satu kalimat."],
    ["\n\nBaris satu\n\nbaris dua\t", "Baris satu\n\nbaris dua"],
  ])("reads %j as the post %j", (input, text) => {
    expect(readPostText(input)).toEqual(Result.succeed(text));
  });

  it.each(["", " ", "\n\t \r\n"])("refuses the empty text %j", (input) => {
    expect(readPostText(input)).toEqual(Result.fail("POST_TEXT_EMPTY"));
  });

  it("accepts a text of the limit and refuses one character more", () => {
    const limit = "a".repeat(POST_TEXT_MAX_LENGTH);
    expect(readPostText(limit)).toEqual(Result.succeed(limit));
    expect(readPostText(`${limit}a`)).toEqual(
      Result.fail("POST_TEXT_TOO_LONG")
    );
  });

  it("counts white space at the ends out of the limit, because it is trimmed first", () => {
    const padded = `${" ".repeat(20)}${"a".repeat(POST_TEXT_MAX_LENGTH)}${" ".repeat(20)}`;
    expect(readPostText(padded)).toEqual(
      Result.succeed("a".repeat(POST_TEXT_MAX_LENGTH))
    );
  });

  it("counts an emoji as one character, though it takes two UTF-16 units", () => {
    const emoji = "😀".repeat(POST_TEXT_MAX_LENGTH);
    expect(countPostCharacters(emoji)).toBe(POST_TEXT_MAX_LENGTH);
    expect(readPostText(emoji)).toEqual(Result.succeed(emoji));
    expect(readPostText(`${emoji}😀`)).toEqual(
      Result.fail("POST_TEXT_TOO_LONG")
    );
  });

  it("counts the characters left on the text the server stores, so padding does not count", () => {
    const padded = `${" ".repeat(20)}${"a".repeat(POST_TEXT_MAX_LENGTH - 10)}${" ".repeat(20)}`;
    expect(remainingPostCharacters(padded)).toBe(10);
    expect(remainingPostCharacters(" ".repeat(600))).toBe(POST_TEXT_MAX_LENGTH);
    expect(remainingPostCharacters("a".repeat(POST_TEXT_MAX_LENGTH + 1))).toBe(
      -1
    );
  });

  it("stores only a trimmed text of one to the limit's characters", () => {
    const isStored = Schema.is(postTextValidator);
    expect(isStored("Halo")).toBe(true);
    expect(isStored(" Halo")).toBe(false);
    expect(isStored("")).toBe(false);
    expect(isStored("a".repeat(POST_TEXT_MAX_LENGTH + 1))).toBe(false);
  });
});
