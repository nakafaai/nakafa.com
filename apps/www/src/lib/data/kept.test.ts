// @vitest-environment node

import { QueryResult } from "@confect/react";
import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { lastValue, useLastValue } from "@/lib/data/kept";

/** The state that the mocked React hook holds, and what the hook sets it to. */
const state = vi.hoisted(() => ({
  set: vi.fn<(next: unknown) => void>(),
  value: vi.fn<() => unknown>(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: () => unknown) => [state.value() ?? initial(), state.set],
}));

describe("last value of a query", () => {
  it("shows the live value once the query answers", () => {
    expect(
      lastValue(QueryResult.succeed<string, never>("live"), Option.none())
    ).toStrictEqual(Option.some("live"));
  });

  it("shows the kept value while the query fails or loads", () => {
    expect(
      lastValue(QueryResult.fail<string, string>("gone"), Option.some("kept"))
    ).toStrictEqual(Option.some("kept"));
    expect(
      lastValue(QueryResult.load<string, never>(false), Option.none())
    ).toStrictEqual(Option.none());
  });

  it("keeps a new answer, and keeps nothing again for the answer it holds", () => {
    state.value.mockReturnValue(undefined);
    state.set.mockClear();
    const answer = { title: "PTS" };
    expect(useLastValue(QueryResult.succeed(answer))).toStrictEqual(
      Option.some(answer)
    );
    expect(state.set).toHaveBeenCalledWith(Option.some(answer));

    state.value.mockReturnValue(Option.some(answer));
    state.set.mockClear();
    expect(useLastValue(QueryResult.succeed(answer))).toStrictEqual(
      Option.some(answer)
    );
    expect(useLastValue(QueryResult.fail("gone"))).toStrictEqual(
      Option.some(answer)
    );
    expect(state.set).not.toHaveBeenCalled();
  });
});
