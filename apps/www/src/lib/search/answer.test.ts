import { describe, expect, it } from "@effect/vitest";
import { Option, Result } from "effect";
import {
  requestSearch,
  SearchReadError,
  settleSearch,
  startSearch,
} from "@/lib/search/answer";

describe("search answers", () => {
  it("starts with no settled answer for the query on screen", () => {
    expect(startSearch<string>("id\nbelajar")).toStrictEqual({
      answer: Option.none(),
      key: "id\nbelajar",
    });
  });

  it("keeps the answers of the query on screen and clears them for a new query", () => {
    const state = settleSearch(
      startSearch<string>("id\nbelajar"),
      "id\nbelajar",
      Result.succeed(["lesson"])
    );
    expect(requestSearch(state, "id\nbelajar")).toBe(state);
    expect(requestSearch(state, "id\nmatematika")).toStrictEqual(
      startSearch<string>("id\nmatematika")
    );
  });

  it("records the answer of the query on screen", () => {
    const settled = settleSearch(
      startSearch<string>("id\nbelajar"),
      "id\nbelajar",
      Result.succeed(["lesson"])
    );
    expect(settled.answer).toStrictEqual(
      Option.some(Result.succeed(["lesson"]))
    );
  });

  it("drops a late answer for an older text, so the newest query keeps its own", () => {
    const newest = requestSearch(
      startSearch<string>("id\nbelajar"),
      "id\nmatematika"
    );
    const late = settleSearch(
      newest,
      "id\nbelajar",
      Result.succeed(["lesson"])
    );
    expect(late).toBe(newest);
    expect(late.answer).toStrictEqual(Option.none());
  });

  it("records a failed read of the query on screen", () => {
    const failure = new SearchReadError({ cause: "offline" });
    const settled = settleSearch(
      startSearch<string>("id\nbelajar"),
      "id\nbelajar",
      Result.fail(failure)
    );
    expect(settled.answer).toStrictEqual(Option.some(Result.fail(failure)));
  });
});
