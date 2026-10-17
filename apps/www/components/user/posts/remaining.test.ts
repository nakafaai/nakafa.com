import { describe, expect, it } from "@effect/vitest";
import { POST_TEXT_MAX_LENGTH } from "@repo/backend/confect/posts/schema";
import { Option } from "effect";
import { remainingToShow } from "@/components/user/posts/remaining";

describe("posts remaining characters", () => {
  it("shows the characters left once fewer than fifty remain", () => {
    expect(remainingToShow("a".repeat(POST_TEXT_MAX_LENGTH - 10))).toEqual(
      Option.some(10)
    );
  });

  it("shows fifty exactly, the first count the composer shows", () => {
    expect(remainingToShow("a".repeat(POST_TEXT_MAX_LENGTH - 50))).toEqual(
      Option.some(50)
    );
  });

  it("shows nothing while more than fifty characters are left", () => {
    expect(remainingToShow("a".repeat(POST_TEXT_MAX_LENGTH - 51))).toEqual(
      Option.none()
    );
    expect(remainingToShow("")).toEqual(Option.none());
  });

  it("counts the white space at the ends out, because the server trims it", () => {
    const padded = `${" ".repeat(20)}${"a".repeat(POST_TEXT_MAX_LENGTH - 10)}${" ".repeat(20)}`;
    expect(remainingToShow(padded)).toEqual(Option.some(10));
  });

  it("counts an emoji as one character", () => {
    expect(remainingToShow("😀".repeat(POST_TEXT_MAX_LENGTH - 20))).toEqual(
      Option.some(20)
    );
  });

  it("shows nothing once the text is over the limit, since no count is left", () => {
    expect(remainingToShow("a".repeat(POST_TEXT_MAX_LENGTH + 1))).toEqual(
      Option.none()
    );
  });
});
