import {
  clearFolderChildNamesCache,
  getFolderChildNames,
  getFolderChildNamesCacheVersion,
} from "@repo/contents/_lib/fs/cache";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { directoryEntriesByPath, mockReadDirSync } = vi.hoisted(() => ({
  directoryEntriesByPath: new Map<
    string,
    { isDirectory: () => boolean; name: string }[]
  >(),
  mockReadDirSync: vi.fn(),
}));

vi.mock("@repo/contents/_lib/io/content", async () => {
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

describe("getFolderChildNames", () => {
  it("increments the folder cache version when cleared", async () => {
    const version = await Effect.runPromise(getFolderChildNamesCacheVersion());

    await Effect.runPromise(clearFolderChildNamesCache());

    expect(await Effect.runPromise(getFolderChildNamesCacheVersion())).toBe(
      version + 1
    );
  });

  it("reuses child folder scans through the Effect-returning reader", async () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder", isDirectory: () => true },
    ]);

    expect(await Effect.runPromise(getFolderChildNames("cached/path"))).toEqual(
      ["folder"]
    );
    expect(await Effect.runPromise(getFolderChildNames("cached/path"))).toEqual(
      ["folder"]
    );
    expect(mockReadDirSync).toHaveBeenCalledTimes(1);
  });

  it("returns child directory names for valid folders", async () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder1", isDirectory: () => true },
      { name: "folder2", isDirectory: () => true },
      { name: "file.md", isDirectory: () => false },
    ]);

    expect(await Effect.runPromise(getFolderChildNames("test/path"))).toEqual([
      "folder1",
      "folder2",
    ]);
  });

  it("returns an empty list for folders with no child directories", async () => {
    mockReadDirSync.mockReturnValue([
      { name: "file1.md", isDirectory: () => false },
      { name: "file2.txt", isDirectory: () => false },
    ]);

    expect(await Effect.runPromise(getFolderChildNames("files/path"))).toEqual(
      []
    );
  });

  it("applies default directory exclusions", async () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder1", isDirectory: () => true },
      { name: "_private", isDirectory: () => true },
      { name: "node_modules", isDirectory: () => true },
      { name: ".git", isDirectory: () => true },
      { name: "coverage", isDirectory: () => true },
      { name: "folder2", isDirectory: () => true },
    ]);

    expect(await Effect.runPromise(getFolderChildNames("test/path"))).toEqual([
      "folder1",
      "folder2",
    ]);
  });

  it("applies custom exclusions", async () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder1", isDirectory: () => true },
      { name: "temp", isDirectory: () => true },
      { name: "folder2", isDirectory: () => true },
    ]);

    expect(
      await Effect.runPromise(getFolderChildNames("test/path", ["temp"]))
    ).toEqual(["folder1", "folder2"]);
  });

  it("handles empty custom exclusions", async () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder1", isDirectory: () => true },
      { name: "folder2", isDirectory: () => true },
    ]);

    expect(
      await Effect.runPromise(getFolderChildNames("test/path", []))
    ).toEqual(["folder1", "folder2"]);
  });

  it("keeps valid special directory names", async () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder-1", isDirectory: () => true },
      { name: "folder_2", isDirectory: () => true },
      { name: "folder.3", isDirectory: () => true },
      { name: "   ", isDirectory: () => true },
      { name: "\t", isDirectory: () => true },
    ]);

    expect(
      await Effect.runPromise(getFolderChildNames("special/path"))
    ).toEqual(["folder-1", "folder_2", "folder.3", "   ", "\t"]);
  });

  it("excludes unsafe dot-prefixed child folder names", async () => {
    mockReadDirSync.mockReturnValue([
      { name: "...", isDirectory: () => true },
      { name: "..folder", isDirectory: () => true },
      { name: "folder..", isDirectory: () => true },
      { name: "valid", isDirectory: () => true },
    ]);

    expect(await Effect.runPromise(getFolderChildNames("test/path"))).toEqual([
      "folder..",
      "valid",
    ]);
  });

  it("fails for parent traversal paths", async () => {
    const result = await Effect.runPromise(
      Effect.match(getFolderChildNames("../path"), {
        onFailure: () => [],
        onSuccess: (names) => names,
      })
    );

    expect(result).toEqual([]);
    expect(mockReadDirSync).not.toHaveBeenCalled();
  });

  it("fails for absolute paths", async () => {
    const result = await Effect.runPromise(
      Effect.match(getFolderChildNames("/absolute/path"), {
        onFailure: () => [],
        onSuccess: (names) => names,
      })
    );

    expect(result).toEqual([]);
    expect(mockReadDirSync).not.toHaveBeenCalled();
  });

  it("fails when the directory cannot be read", async () => {
    mockReadDirSync.mockImplementation(() => {
      throw new Error("Directory not found");
    });

    const result = await Effect.runPromise(
      Effect.match(getFolderChildNames("nonexistent/path"), {
        onFailure: () => [],
        onSuccess: (names) => names,
      })
    );

    expect(result).toEqual([]);
  });

  it("handles large directory lists", async () => {
    const dirs = Array.from({ length: 1000 }, (_, index) => ({
      name: `folder${index}`,
      isDirectory: () => true,
    }));
    mockReadDirSync.mockReturnValue(dirs);

    const result = await Effect.runPromise(getFolderChildNames("large/path"));

    expect(result).toHaveLength(1000);
    expect(result[0]).toBe("folder0");
    expect(result[999]).toBe("folder999");
  });
  it("caches child scans with custom excludes", async () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder", isDirectory: () => true },
      { name: "skip", isDirectory: () => true },
    ]);

    expect(
      await Effect.runPromise(getFolderChildNames("cached/path", ["skip"]))
    ).toEqual(["folder"]);
    expect(
      await Effect.runPromise(getFolderChildNames("cached/path", ["skip"]))
    ).toEqual(["folder"]);
    expect(mockReadDirSync).toHaveBeenCalledTimes(1);
  });
});
