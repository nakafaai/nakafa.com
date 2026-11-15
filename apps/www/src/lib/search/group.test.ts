import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import type { SearchEntry } from "@/lib/search/entry";
import {
  groupHits,
  groupOfKind,
  readExploreEntries,
  readNearEntries,
} from "@/lib/search/group";
import { prepareEntry, searchEntries } from "@/lib/search/rank";
import { INDONESIAN_ENTRIES } from "@/lib/search/test.entries";

/** The paths of entries, which name them shortest. */
function paths(entries: readonly SearchEntry[]) {
  return Arr.map(entries, ({ path }) => path);
}

describe("groupHits", () => {
  it("leads with the group of the best result and keeps each group's order", () => {
    const hits = searchEntries(
      Arr.map(INDONESIAN_ENTRIES, prepareEntry),
      "kurikulum"
    );
    const groups = groupHits(hits);
    expect(Arr.map(groups, ({ group }) => group)).toEqual([
      "curricula",
      "pages",
      "lessons",
    ]);
    expect(Arr.map(groups, ({ hits: rows }) => rows.length)).toEqual([6, 1, 2]);
  });

  it("names the group of every kind", () => {
    expect(groupOfKind("surah")).toBe("quran");
    expect(groupOfKind("tryout")).toBe("tryouts");
    expect(groupOfKind("article")).toBe("articles");
  });
});

describe("readNearEntries", () => {
  it("suggests the subjects of a lesson's level, which its trail names", () => {
    expect(
      paths(
        readNearEntries(INDONESIAN_ENTRIES, [
          "/id/materi/kimia/struktur-atom/teori-dalton",
        ])
      )
    ).toEqual([
      "/id/kurikulum/merdeka/kelas-10/kimia",
      "/id/kurikulum/merdeka/kelas-10/matematika",
    ]);
  });

  it("suggests the subjects of a level and the levels of a curriculum", () => {
    expect(
      paths(
        readNearEntries(INDONESIAN_ENTRIES, ["/id/kurikulum/merdeka/kelas-11"])
      )
    ).toEqual(["/id/kurikulum/merdeka/kelas-11/fisika"]);
    expect(
      paths(readNearEntries(INDONESIAN_ENTRIES, ["/id/kurikulum/merdeka"]))
    ).toEqual([
      "/id/kurikulum/merdeka/kelas-10",
      "/id/kurikulum/merdeka/kelas-11",
    ]);
  });

  it("falls back to the reader's recent pages, and suggests nothing outside every curriculum", () => {
    expect(
      paths(
        readNearEntries(INDONESIAN_ENTRIES, [
          "/id/quran/2",
          "/id/kurikulum/merdeka/kelas-11/fisika",
        ])
      )
    ).toEqual(["/id/kurikulum/merdeka/kelas-11/fisika"]);
    expect(
      readNearEntries(INDONESIAN_ENTRIES, ["/id/kurikulum/kssm", "/id", "/de"])
    ).toEqual([]);
  });
});

describe("readExploreEntries", () => {
  it("offers each family's own page, then every curriculum", () => {
    expect(paths(readExploreEntries(INDONESIAN_ENTRIES))).toEqual([
      "/id/kurikulum",
      "/id/try-out",
      "/id/kurikulum/merdeka",
      "/id/kurikulum/kssm",
    ]);
  });
});
