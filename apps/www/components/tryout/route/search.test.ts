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
});

describe("TryoutAttemptSearch", () => {
  it("keeps a single or repeated attempt value raw for the attempt readers", () => {
    expect(
      Schema.decodeSync(TryoutAttemptSearch)({
        attemptId: ["a", "b"],
        view: "list",
      })
    ).toEqual({ attemptId: ["a", "b"], view: "list" });
  });
});
