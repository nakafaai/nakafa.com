import { collectFilesystemSlugs } from "@repo/backend/scripts/sync-content/cleanup/source";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/backend/scripts/sync-content/runtime/files", () => ({
  globFiles: vi.fn(() => Effect.succeed([])),
}));

vi.mock("@repo/contents/_types/tryout/source", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@repo/contents/_types/tryout/source")
    >();
  const source = actual.TRYOUT_SOURCES.find(
    (candidate) => candidate.examKey === "snbt"
  );
  const track = source?.tracks[0];
  const set = track?.sets[0];

  if (!(source && track && set)) {
    throw new Error("Expected the SNBT source fixture.");
  }

  return {
    ...actual,
    TRYOUT_SOURCES: [
      {
        ...source,
        tracks: [
          {
            ...track,
            sets: [{ ...set, sections: [] }],
          },
        ],
      },
    ],
  };
});

describe("content cleanup source inventory", () => {
  it("keeps unpublished try-out catalog rows source-owned", () => {
    const slugs = Effect.runSync(collectFilesystemSlugs());

    expect(slugs.tryoutTrackKeys).toEqual([
      "en:try-out/indonesia/snbt/2027",
      "id:try-out/indonesia/snbt/2027",
    ]);
    expect(slugs.tryoutSetKeys).toEqual([
      "en:try-out/indonesia/snbt/2027/set-1",
      "id:try-out/indonesia/snbt/2027/set-1",
    ]);
    expect(slugs.tryoutSectionKeys).toEqual([]);
  });
});
