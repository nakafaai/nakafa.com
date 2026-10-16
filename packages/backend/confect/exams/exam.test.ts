import { describe, expect, it } from "@effect/vitest";
import {
  EXAM_TITLE_MAX_LENGTH,
  ExamTitle,
} from "@repo/backend/confect/exams/exam";
import { Schema } from "effect";

describe("exams/exam ExamTitle", () => {
  const accepts = Schema.is(ExamTitle);

  it("accepts one trimmed line of up to the title limit", () => {
    expect(accepts("PTS Matematika")).toBe(true);
    expect(accepts("a".repeat(EXAM_TITLE_MAX_LENGTH))).toBe(true);
  });

  it("refuses an empty title, a title over the limit, and a title with a line break or outer space", () => {
    expect(accepts("")).toBe(false);
    expect(accepts("a".repeat(EXAM_TITLE_MAX_LENGTH + 1))).toBe(false);
    expect(accepts("PTS\nMatematika")).toBe(false);
    expect(accepts(" PTS Matematika")).toBe(false);
  });

  it("counts a character as a code point, so an emoji counts once though it takes two UTF-16 units", () => {
    const emoji = "😀".repeat(EXAM_TITLE_MAX_LENGTH);
    expect(accepts(emoji)).toBe(true);
    expect(accepts(`${emoji}😀`)).toBe(false);
  });
});
