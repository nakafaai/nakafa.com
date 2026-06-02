import { clearFolderChildNamesCache } from "@repo/contents/_lib/fs/cache";
import { getNestedSlugs } from "@repo/contents/_lib/fs/nested-slugs";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { directoryEntriesByPath, mockReadDirSync } = vi.hoisted(() => ({
  directoryEntriesByPath: new Map<
    string,
    { isDirectory: () => boolean; name: string }[]
  >(),
  mockReadDirSync: vi.fn(),
}));

vi.mock("@repo/contents/_lib/io/content-io", async () => {
  const { Effect, Layer } = await import("effect");
  const isDirectoryEntry = (
    entry: unknown
  ): entry is { isDirectory: () => boolean; name: string } =>
    typeof entry === "object" &&
    entry !== null &&
    "isDirectory" in entry &&
    "name" in entry &&
    typeof entry.isDirectory === "function" &&
    typeof entry.name === "string";

  return {
    ContentIO: {
      Default: Layer.empty,
      readDirectory: (directoryPath: string) =>
        Effect.try({
          try: () => {
            const rawEntries = mockReadDirSync(directoryPath);
            const entries = Array.isArray(rawEntries)
              ? rawEntries.filter(isDirectoryEntry)
              : [];
            directoryEntriesByPath.set(directoryPath, entries);

            return entries.map((entry) => entry.name);
          },
          catch: (cause) => cause,
        }),
      stat: (filePath: string) =>
        Effect.sync(() => {
          const separatorIndex = filePath.lastIndexOf("/");
          const directoryPath = filePath.slice(0, separatorIndex);
          const name = filePath.slice(separatorIndex + 1);
          const entry = directoryEntriesByPath
            .get(directoryPath)
            ?.find((candidate) => candidate.name === name);

          return { type: entry?.isDirectory() ? "Directory" : "File" };
        }),
    },
  };
});

beforeEach(async () => {
  await Effect.runPromise(clearFolderChildNamesCache());
  directoryEntriesByPath.clear();
  mockReadDirSync.mockReturnValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
  mockReadDirSync.mockReset();
});

describe("getNestedSlugs", () => {
  it("returns an empty array for empty base paths with no children", async () => {
    expect(await Effect.runPromise(getNestedSlugs(""))).toEqual([]);
  });

  it("returns nested slugs for a simple structure", async () => {
    let callCount = 0;
    mockReadDirSync.mockImplementation(() => {
      callCount += 1;

      if (callCount === 1) {
        return [{ name: "folder1", isDirectory: () => true }];
      }

      return [];
    });

    expect(await Effect.runPromise(getNestedSlugs(""))).toContainEqual([
      "folder1",
    ]);
  });

  it("returns nested slugs for multiple levels", async () => {
    let callCount = 0;
    mockReadDirSync.mockImplementation(() => {
      callCount += 1;

      if (callCount === 1) {
        return [{ name: "parent", isDirectory: () => true }];
      }

      if (callCount === 2) {
        return [{ name: "child", isDirectory: () => true }];
      }

      return [];
    });

    const result = await Effect.runPromise(getNestedSlugs(""));

    expect(result).toContainEqual(["parent"]);
    expect(result).toContainEqual(["parent", "child"]);
  });

  it("reuses nested slug scans for the same folder cache version", async () => {
    mockReadDirSync
      .mockImplementationOnce(() => [
        { name: "cached", isDirectory: () => true },
      ])
      .mockImplementation(() => []);

    expect(await Effect.runPromise(getNestedSlugs(""))).toEqual([["cached"]]);
    expect(await Effect.runPromise(getNestedSlugs(""))).toEqual([["cached"]]);
    expect(mockReadDirSync).toHaveBeenCalledTimes(2);
  });

  it("refreshes nested slug scans after the folder cache is cleared", async () => {
    mockReadDirSync
      .mockImplementationOnce(() => [
        { name: "first", isDirectory: () => true },
      ])
      .mockImplementationOnce(() => []);

    expect(await Effect.runPromise(getNestedSlugs(""))).toEqual([["first"]]);

    await Effect.runPromise(clearFolderChildNamesCache());
    mockReadDirSync.mockClear();
    mockReadDirSync
      .mockImplementationOnce(() => [
        { name: "second", isDirectory: () => true },
      ])
      .mockImplementationOnce(() => []);

    expect(await Effect.runPromise(getNestedSlugs(""))).toEqual([["second"]]);
    expect(mockReadDirSync).toHaveBeenCalledTimes(2);
  });

  it("preserves top-level directory order", async () => {
    mockReadDirSync.mockImplementationOnce(() => [
      { name: "a", isDirectory: () => true },
      { name: "b", isDirectory: () => true },
      { name: "c", isDirectory: () => true },
    ]);

    expect(await Effect.runPromise(getNestedSlugs(""))).toEqual([
      ["a"],
      ["b"],
      ["c"],
    ]);
  });

  it("handles non-empty base paths", async () => {
    mockReadDirSync.mockImplementationOnce(() => [
      { name: "child", isDirectory: () => true },
    ]);

    expect(await Effect.runPromise(getNestedSlugs("parent"))).toContainEqual([
      "child",
    ]);
  });

  it("normalizes base paths before scanning", async () => {
    mockReadDirSync.mockImplementationOnce(() => [
      { name: "child", isDirectory: () => true },
    ]);

    expect(await Effect.runPromise(getNestedSlugs("parent///"))).toContainEqual(
      ["child"]
    );
  });

  it("handles structures with only leaf directories", async () => {
    mockReadDirSync.mockImplementationOnce(() => [
      { name: "leaf1", isDirectory: () => true },
      { name: "leaf2", isDirectory: () => true },
    ]);

    expect(await Effect.runPromise(getNestedSlugs(""))).toEqual([
      ["leaf1"],
      ["leaf2"],
    ]);
  });

  it("handles deep nesting", async () => {
    let callCount = 0;
    mockReadDirSync.mockImplementation(() => {
      callCount += 1;

      if (callCount <= 50) {
        return [{ name: `level${callCount}`, isDirectory: () => true }];
      }

      return [];
    });

    const deepest = (await Effect.runPromise(getNestedSlugs(""))).at(-1);

    expect(deepest?.length).toBeGreaterThan(1);
  });

  it("returns an empty array when directory reads fail", async () => {
    mockReadDirSync.mockImplementation(() => {
      throw new Error("Directory not found");
    });

    expect(await Effect.runPromise(getNestedSlugs(""))).toEqual([]);
  });

  it("treats invalid nested base paths as leaf nodes", async () => {
    expect(await Effect.runPromise(getNestedSlugs("../subject"))).toEqual([]);
    expect(mockReadDirSync).not.toHaveBeenCalled();
  });

  it("handles large directory trees", async () => {
    const dirCount = 100;
    mockReadDirSync.mockImplementationOnce(() =>
      Array.from({ length: dirCount }, (_, index) => ({
        name: `folder${index}`,
        isDirectory: () => true,
      }))
    );

    expect(await Effect.runPromise(getNestedSlugs(""))).toHaveLength(dirCount);
  });
});
