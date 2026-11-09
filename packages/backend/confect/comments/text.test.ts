import { describe, expect, it } from "@effect/vitest";
import { readCommentText } from "@repo/backend/confect/comments/text";
import { Result } from "effect";

describe("comments/text", () => {
  it("reads a comment's words as learner text, with or without photos", () => {
    expect(readCommentText("  Halo  ", 0)).toEqual(Result.succeed("Halo"));
    expect(readCommentText("  Lihat foto ini  ", 2)).toEqual(
      Result.succeed("Lihat foto ini")
    );
  });

  it("lets photos speak for an empty comment, and refuses an empty one without them", () => {
    expect(readCommentText(" \n ", 1)).toEqual(Result.succeed(""));
    expect(readCommentText(" \n ", 0)).toEqual(Result.fail("POST_TEXT_EMPTY"));
  });
});
