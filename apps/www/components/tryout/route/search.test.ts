import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import {
  TryoutAttemptSearch,
  TryoutTrackSearch,
} from "@/components/tryout/route/search";

describe("TryoutTrackSearch", () => {
  it("keeps the catalog query keys that decode", () => {
    expect(
      Schema.decodeSync(TryoutTrackSearch)({
        direction: "desc",
        sort: "title",
        status: "completed",
      })
    ).toEqual({ direction: "desc", sort: "title", status: "completed" });
  });

  it("reads a value that does not decode as none, and keeps the other keys", () => {
    expect(
      Schema.decodeUnknownSync(TryoutTrackSearch)({
        sort: "title",
        status: ["a", "b"],
      })
    ).toEqual({ sort: "title" });
  });

  it("reads a parsed scalar back to the text the learner wrote", () => {
    expect(
      Schema.decodeSync(TryoutTrackSearch)({ direction: 1, sort: null })
    ).toEqual({ direction: "1", sort: "null" });
  });
});

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
