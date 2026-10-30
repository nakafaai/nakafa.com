// @vitest-environment node

import { QueryResult } from "@confect/react";
import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  keptRows,
  lastValue,
  useKeptRows,
  useLastValue,
} from "@/lib/data/kept";

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

describe("rows of a paged list across its scopes", () => {
  it("shows the loaded rows, and the kept rows while a new scope's first page loads", () => {
    expect(keptRows(false, ["Lab 1"], Option.none())).toStrictEqual(
      Option.some(["Lab 1"])
    );
    expect(keptRows(true, [], Option.some(["Lab 1"]))).toStrictEqual(
      Option.some(["Lab 1"])
    );
    expect(keptRows(true, [], Option.none())).toStrictEqual(Option.none());
  });

  it("keeps each new answer, and keeps nothing while a scope loads or for the rows it holds", () => {
    const rows = ["Lab 1", "Lab 2"];
    state.value.mockReturnValue(undefined);
    state.set.mockClear();
    expect(useKeptRows(false, rows)).toStrictEqual(Option.some(rows));
    expect(state.set).toHaveBeenCalledWith(Option.some(rows));

    state.value.mockReturnValue(Option.some(rows));
    state.set.mockClear();
    expect(useKeptRows(false, rows)).toStrictEqual(Option.some(rows));
    expect(useKeptRows(true, [])).toStrictEqual(Option.some(rows));
    expect(state.set).not.toHaveBeenCalled();
  });
});
