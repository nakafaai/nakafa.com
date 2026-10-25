import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import { TryoutAttemptSearch } from "@/components/tryout/route/search";

describe("TryoutAttemptSearch", () => {
  it("keeps a single or repeated attempt value as text for the attempt readers", () => {
    expect(
      Schema.decodeSync(TryoutAttemptSearch)({
        attemptId: ["a", "b"],
        view: "list",
      })
    ).toEqual({ attemptId: ["a", "b"], view: "list" });
  });

  it("reads a value that TanStack parsed as JSON back to its text, so a non-view stays invalid", () => {
    expect(
      Schema.decodeSync(TryoutAttemptSearch)({
        attemptId: 12_345,
        view: 1,
      })
    ).toEqual({ attemptId: "12345", view: "1" });
    expect(Schema.decodeSync(TryoutAttemptSearch)({ view: false })).toEqual({
      view: "false",
    });
  });

  it("reads each repeated value of any JSON scalar kind as text", () => {
    expect(
      Schema.decodeSync(TryoutAttemptSearch)({ attemptId: [1, "b"] })
    ).toEqual({ attemptId: ["1", "b"] });
  });

  it("reads a value of another shape as empty, which the readers refuse", () => {
    expect(
      Schema.decodeUnknownSync(TryoutAttemptSearch)({
        attemptId: { id: "a" },
        view: [{ view: "list" }],
      })
    ).toEqual({ attemptId: "", view: "" });
  });

  it("encodes the text it decoded back to the same text", () => {
    expect(
      Schema.encodeSync(TryoutAttemptSearch)({ attemptId: "abc", view: "list" })
    ).toEqual({ attemptId: "abc", view: "list" });
  });
});
