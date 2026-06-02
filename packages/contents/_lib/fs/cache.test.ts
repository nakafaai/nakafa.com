import {
  clearFolderChildNamesCache,
  getFolderChildNames,
  getFolderChildNamesCacheVersion,
} from "@repo/contents/_lib/fs/cache";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockReadDirSync } = vi.hoisted(() => ({
  mockReadDirSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  default: {
    constants: { F_OK: 0 },
    existsSync: vi.fn(() => true),
    promises: {
      access: vi.fn(),
      readFile: vi.fn(),
    },
    readdirSync: mockReadDirSync,
  },
  promises: {
    access: vi.fn(),
    readFile: vi.fn(),
  },
}));

beforeEach(() => {
  Effect.runSync(clearFolderChildNamesCache());
  mockReadDirSync.mockReturnValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
  mockReadDirSync.mockReset();
});

describe("getFolderChildNames", () => {
  it("increments the folder cache version when cleared", () => {
    const version = Effect.runSync(getFolderChildNamesCacheVersion());

    Effect.runSync(clearFolderChildNamesCache());

    expect(Effect.runSync(getFolderChildNamesCacheVersion())).toBe(version + 1);
  });

  it("reuses child folder scans through the Effect-returning reader", () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder", isDirectory: () => true },
    ]);

    expect(Effect.runSync(getFolderChildNames("cached/path"))).toEqual([
      "folder",
    ]);
    expect(Effect.runSync(getFolderChildNames("cached/path"))).toEqual([
      "folder",
    ]);
    expect(mockReadDirSync).toHaveBeenCalledTimes(1);
  });

  it("returns child directory names for valid folders", () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder1", isDirectory: () => true },
      { name: "folder2", isDirectory: () => true },
      { name: "file.md", isDirectory: () => false },
    ]);

    expect(Effect.runSync(getFolderChildNames("test/path"))).toEqual([
      "folder1",
      "folder2",
    ]);
  });

  it("returns an empty list for folders with no child directories", () => {
    mockReadDirSync.mockReturnValue([
      { name: "file1.md", isDirectory: () => false },
      { name: "file2.txt", isDirectory: () => false },
    ]);

    expect(Effect.runSync(getFolderChildNames("files/path"))).toEqual([]);
  });

  it("applies default directory exclusions", () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder1", isDirectory: () => true },
      { name: "_private", isDirectory: () => true },
      { name: "node_modules", isDirectory: () => true },
      { name: ".git", isDirectory: () => true },
      { name: "coverage", isDirectory: () => true },
      { name: "folder2", isDirectory: () => true },
    ]);

    expect(Effect.runSync(getFolderChildNames("test/path"))).toEqual([
      "folder1",
      "folder2",
    ]);
  });

  it("applies custom exclusions", () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder1", isDirectory: () => true },
      { name: "temp", isDirectory: () => true },
      { name: "folder2", isDirectory: () => true },
    ]);

    expect(Effect.runSync(getFolderChildNames("test/path", ["temp"]))).toEqual([
      "folder1",
      "folder2",
    ]);
  });

  it("handles empty custom exclusions", () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder1", isDirectory: () => true },
      { name: "folder2", isDirectory: () => true },
    ]);

    expect(Effect.runSync(getFolderChildNames("test/path", []))).toEqual([
      "folder1",
      "folder2",
    ]);
  });

  it("keeps valid special directory names", () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder-1", isDirectory: () => true },
      { name: "folder_2", isDirectory: () => true },
      { name: "folder.3", isDirectory: () => true },
      { name: "   ", isDirectory: () => true },
      { name: "\t", isDirectory: () => true },
    ]);

    expect(Effect.runSync(getFolderChildNames("special/path"))).toEqual([
      "folder-1",
      "folder_2",
      "folder.3",
      "   ",
      "\t",
    ]);
  });

  it("excludes unsafe dot-prefixed child folder names", () => {
    mockReadDirSync.mockReturnValue([
      { name: "...", isDirectory: () => true },
      { name: "..folder", isDirectory: () => true },
      { name: "folder..", isDirectory: () => true },
      { name: "valid", isDirectory: () => true },
    ]);

    expect(Effect.runSync(getFolderChildNames("test/path"))).toEqual([
      "folder..",
      "valid",
    ]);
  });

  it("fails for parent traversal paths", () => {
    const result = Effect.runSync(
      Effect.match(getFolderChildNames("../path"), {
        onFailure: () => [],
        onSuccess: (names) => names,
      })
    );

    expect(result).toEqual([]);
    expect(mockReadDirSync).not.toHaveBeenCalled();
  });

  it("fails for absolute paths", () => {
    const result = Effect.runSync(
      Effect.match(getFolderChildNames("/absolute/path"), {
        onFailure: () => [],
        onSuccess: (names) => names,
      })
    );

    expect(result).toEqual([]);
    expect(mockReadDirSync).not.toHaveBeenCalled();
  });

  it("fails when the directory cannot be read", () => {
    mockReadDirSync.mockImplementation(() => {
      throw new Error("Directory not found");
    });

    const result = Effect.runSync(
      Effect.match(getFolderChildNames("nonexistent/path"), {
        onFailure: () => [],
        onSuccess: (names) => names,
      })
    );

    expect(result).toEqual([]);
  });

  it("handles large directory lists", () => {
    const dirs = Array.from({ length: 1000 }, (_, index) => ({
      name: `folder${index}`,
      isDirectory: () => true,
    }));
    mockReadDirSync.mockReturnValue(dirs);

    const result = Effect.runSync(getFolderChildNames("large/path"));

    expect(result).toHaveLength(1000);
    expect(result[0]).toBe("folder0");
    expect(result[999]).toBe("folder999");
  });
  it("caches child scans with custom excludes", () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder", isDirectory: () => true },
      { name: "skip", isDirectory: () => true },
    ]);

    expect(
      Effect.runSync(getFolderChildNames("cached/path", ["skip"]))
    ).toEqual(["folder"]);
    expect(
      Effect.runSync(getFolderChildNames("cached/path", ["skip"]))
    ).toEqual(["folder"]);
    expect(mockReadDirSync).toHaveBeenCalledTimes(1);
  });
});
