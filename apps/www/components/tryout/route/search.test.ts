import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import {
  TryoutAttemptSearch,
  TryoutTrackSearch,
} from "@/components/tryout/route/search";

describe("TryoutTrackSearch", () => {
  it("keeps the catalog query keys that decode", () => {
    expect(
      Schema.decodeUnknownSync(TryoutTrackSearch)({
        direction: "desc",
        sort: "title",
        status: "completed",
      })
    ).toEqual({ direction: "desc", sort: "title", status: "completed" });
  });

  it("reads a value that does not decode as none, so the track still opens", () => {
    expect(
      Schema.decodeUnknownSync(TryoutTrackSearch)({ status: ["a", "b"] })
    ).toEqual({});
  });
});

describe("TryoutAttemptSearch", () => {
  it("keeps a single or repeated attempt value raw for the attempt readers", () => {
    expect(
      Schema.decodeUnknownSync(TryoutAttemptSearch)({
        attemptId: ["a", "b"],
        view: "list",
      })
    ).toEqual({ attemptId: ["a", "b"], view: "list" });
  });
});
