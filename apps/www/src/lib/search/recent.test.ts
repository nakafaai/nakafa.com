import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { createRecentStore } from "@/lib/search/recent";
import { INDONESIAN_ENTRIES } from "@/lib/search/test.entries";

describe("createRecentStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps the newest five pages, a page opened again moved to the front", () => {
    const store = createRecentStore();
    for (const entry of Arr.take(INDONESIAN_ENTRIES, 6)) {
      store.getState().remember(entry);
    }
    const second = INDONESIAN_ENTRIES[3];
    if (second !== undefined) {
      store.getState().remember(second);
    }
    expect(Arr.map(store.getState().entries, ({ title }) => title)).toEqual([
      "Kelas 10",
      "Kimia",
      "Kelas 11",
      "KSSM",
      "Kurikulum Merdeka",
    ]);
  });

  it("reads the pages back in a new store from this browser", () => {
    const first = createRecentStore();
    for (const entry of Arr.take(INDONESIAN_ENTRIES, 1)) {
      first.getState().remember(entry);
    }
    expect(createRecentStore().getState().entries).toEqual(
      Arr.take(INDONESIAN_ENTRIES, 1)
    );
  });
});
