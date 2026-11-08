import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  type RemoteList,
  remoteSorting,
} from "@/components/shared/table/remote";

/** A remote list that sorts by `sort`, recording each sort a head hands back. */
function list(sort: RemoteList["sort"]) {
  const onSort = vi.fn();
  const remote: RemoteList = {
    choose: vi.fn(),
    chosen: {},
    more: Option.none(),
    onSort,
    snapshot: "first",
    sort,
  };
  return { onSort, remote };
}

describe("remoteSorting", () => {
  it("leaves a list held in memory to sort its own rows", () => {
    expect(remoteSorting(undefined)).toEqual({ options: {}, state: {} });
  });

  it("shows the server's sort, and none for the list's own order, sorting nothing itself", () => {
    const sorted = remoteSorting(
      list(Option.some({ column: "title", descending: true })).remote
    );
    const unsorted = remoteSorting(list(Option.none()).remote);

    expect(sorted.state).toEqual({ sorting: [{ desc: true, id: "title" }] });
    expect(sorted.options.manualSorting).toBe(true);
    expect(unsorted.state).toEqual({ sorting: [] });
  });

  it("hands a head's sort back to the server, and ignores a change that sorts by nothing", () => {
    const { onSort, remote } = list(Option.none());
    const { options } = remoteSorting(remote);

    options.onSortingChange?.([{ desc: false, id: "questionCount" }]);
    options.onSortingChange?.((current) => [
      ...current,
      { desc: true, id: "title" },
    ]);
    options.onSortingChange?.([]);

    expect(onSort.mock.calls).toEqual([
      ["questionCount", false],
      ["title", true],
    ]);
  });
});
