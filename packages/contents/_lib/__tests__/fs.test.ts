import { getFolderChildNames, getNestedSlugs } from "@repo/contents/_lib/fs";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockReadDirSync } = vi.hoisted(() => ({
  mockReadDirSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  default: {
    readdirSync: mockReadDirSync,
    existsSync: vi.fn(() => true),
    constants: { F_OK: 0 },
    promises: {
      access: vi.fn(),
      readFile: vi.fn(),
    },
  },
  promises: {
    access: vi.fn(),
    readFile: vi.fn(),
  },
}));

beforeEach(() => {
  mockReadDirSync.mockReturnValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
  mockReadDirSync.mockReset();
});

describe("getFolderChildNames", () => {
  it("should return child directory names for valid folder", () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder1", isDirectory: () => true },
      { name: "folder2", isDirectory: () => true },
      { name: "file.md", isDirectory: () => false },
    ]);

    const result = Effect.runSync(getFolderChildNames("test/path"));
    expect(result).toEqual(["folder1", "folder2"]);
  });

  it("should handle empty folder", () => {
    mockReadDirSync.mockReturnValue([]);

    const result = Effect.runSync(getFolderChildNames("empty/path"));
    expect(result).toEqual([]);
  });

  it("should exclude directories starting with underscore", () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder1", isDirectory: () => true },
      { name: "_private", isDirectory: () => true },
      { name: "_hidden", isDirectory: () => true },
    ]);

    const result = Effect.runSync(getFolderChildNames("test/path"));
    expect(result).toEqual(["folder1"]);
  });

  it("should exclude node_modules directory", () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder1", isDirectory: () => true },
      { name: "node_modules", isDirectory: () => true },
      { name: "folder2", isDirectory: () => true },
    ]);

    const result = Effect.runSync(getFolderChildNames("test/path"));
    expect(result).toEqual(["folder1", "folder2"]);
  });

  it("should exclude directories starting with dot", () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder1", isDirectory: () => true },
      { name: ".git", isDirectory: () => true },
      { name: ".hidden", isDirectory: () => true },
    ]);

    const result = Effect.runSync(getFolderChildNames("test/path"));
    expect(result).toEqual(["folder1"]);
  });

  it("should handle custom exclude patterns", () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder1", isDirectory: () => true },
      { name: "temp", isDirectory: () => true },
      { name: "folder2", isDirectory: () => true },
    ]);

    const result = Effect.runSync(getFolderChildNames("test/path", ["temp"]));
    expect(result).toEqual(["folder1", "folder2"]);
  });

  it("should handle folder with only files", () => {
    mockReadDirSync.mockReturnValue([
      { name: "file1.md", isDirectory: () => false },
      { name: "file2.txt", isDirectory: () => false },
    ]);

    const result = Effect.runSync(getFolderChildNames("files/path"));
    expect(result).toEqual([]);
  });

  it("should handle folder with mixed files and directories", () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder1", isDirectory: () => true },
      { name: "file.md", isDirectory: () => false },
      { name: "folder2", isDirectory: () => true },
    ]);

    const result = Effect.runSync(getFolderChildNames("mixed/path"));
    expect(result).toEqual(["folder1", "folder2"]);
  });

  it("should handle single character directory names", () => {
    mockReadDirSync.mockReturnValue([
      { name: "a", isDirectory: () => true },
      { name: "b", isDirectory: () => true },
    ]);

    const result = Effect.runSync(getFolderChildNames("short/path"));
    expect(result).toEqual(["a", "b"]);
  });

  it("should handle directory names with special characters", () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder-1", isDirectory: () => true },
      { name: "folder_2", isDirectory: () => true },
      { name: "folder.3", isDirectory: () => true },
    ]);

    const result = Effect.runSync(getFolderChildNames("special/path"));
    expect(result).toEqual(["folder-1", "folder_2", "folder.3"]);
  });

  it("should return empty array for path with ..", () => {
    const result = Effect.runSync(
      Effect.match(getFolderChildNames("../path"), {
        onFailure: () => [],
        onSuccess: (names) => names,
      })
    );
    expect(result).toEqual([]);
  });

  it("should return empty array for absolute path", () => {
    const result = Effect.runSync(
      Effect.match(getFolderChildNames("/absolute/path"), {
        onFailure: () => [],
        onSuccess: (names) => names,
      })
    );
    expect(result).toEqual([]);
  });

  it("should return empty array when readdirSync throws error", () => {
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

  it("should return empty array for malicious path traversal attempt", () => {
    const result = Effect.runSync(
      Effect.match(getFolderChildNames("../../../etc"), {
        onFailure: () => [],
        onSuccess: (names) => names,
      })
    );
    expect(result).toEqual([]);
  });
});

describe("getNestedSlugs", () => {
  it("should return empty array for empty base path with no children", () => {
    mockReadDirSync.mockReturnValue([]);

    const result = getNestedSlugs("");
    expect(result).toEqual([]);
  });

  it("should return nested slugs for simple structure", () => {
    let callCount = 0;
    mockReadDirSync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return [{ name: "folder1", isDirectory: () => true }];
      }
      return [];
    });

    const result = getNestedSlugs("");
    expect(result).toContainEqual(["folder1"]);
  });

  it("should handle nested structure with multiple levels", () => {
    let callCount = 0;
    mockReadDirSync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return [{ name: "parent", isDirectory: () => true }];
      }
      if (callCount === 2) {
        return [{ name: "child", isDirectory: () => true }];
      }
      return [];
    });

    const result = getNestedSlugs("");
    expect(result).toContainEqual(["parent"]);
    expect(result).toContainEqual(["parent", "child"]);
  });

  it("should handle multiple top-level directories", () => {
    let callCount = 0;
    mockReadDirSync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return [
          { name: "folder1", isDirectory: () => true },
          { name: "folder2", isDirectory: () => true },
          { name: "folder3", isDirectory: () => true },
        ];
      }
      return [];
    });

    const result = getNestedSlugs("");
    expect(result).toHaveLength(3);
    expect(result).toContainEqual(["folder1"]);
    expect(result).toContainEqual(["folder2"]);
    expect(result).toContainEqual(["folder3"]);
  });

  it("should handle non-empty base path", () => {
    let callCount = 0;
    mockReadDirSync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return [{ name: "child", isDirectory: () => true }];
      }
      return [];
    });

    const result = getNestedSlugs("parent");
    expect(result).toContainEqual(["child"]);
  });

  it("should handle structure with only leaf directories", () => {
    let callCount = 0;
    mockReadDirSync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return [
          { name: "leaf1", isDirectory: () => true },
          { name: "leaf2", isDirectory: () => true },
        ];
      }
      return [];
    });

    const result = getNestedSlugs("");
    expect(result).toEqual([["leaf1"], ["leaf2"]]);
  });

  it("should handle deep nesting", () => {
    let callCount = 0;
    mockReadDirSync.mockImplementation(() => {
      callCount++;
      if (callCount <= 4) {
        return [{ name: `level${callCount}`, isDirectory: () => true }];
      }
      return [];
    });

    const result = getNestedSlugs("");
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((slug) => slug.length > 1)).toBe(true);
  });

  it("should preserve order of directories", () => {
    let callCount = 0;
    mockReadDirSync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return [
          { name: "a", isDirectory: () => true },
          { name: "b", isDirectory: () => true },
          { name: "c", isDirectory: () => true },
        ];
      }
      return [];
    });

    const result = getNestedSlugs("");
    expect(result).toEqual([["a"], ["b"], ["c"]]);
  });

  it("should return empty array when readdirSync throws error", () => {
    mockReadDirSync.mockImplementation(() => {
      throw new Error("Directory not found");
    });

    const result = getNestedSlugs("");
    expect(result).toEqual([]);
  });

  it("should handle Unicode directory names", () => {
    mockReadDirSync.mockReturnValue([
      { name: "中文", isDirectory: () => true },
      { name: "العربية", isDirectory: () => true },
      { name: "日本語", isDirectory: () => true },
      { name: "📁", isDirectory: () => true },
      { name: "文件夹", isDirectory: () => true },
    ]);

    const result = Effect.runSync(getFolderChildNames("unicode/path"));
    expect(result).toEqual(["中文", "العربية", "日本語", "📁", "文件夹"]);
  });

  it("should handle very long directory names", () => {
    const longName = "a".repeat(200);
    mockReadDirSync.mockReturnValue([
      { name: longName, isDirectory: () => true },
    ]);

    const result = Effect.runSync(getFolderChildNames("long/path"));
    expect(result).toEqual([longName]);
  });

  it("should handle empty string folder name", () => {
    mockReadDirSync.mockReturnValue([
      { name: "", isDirectory: () => true },
      { name: "valid", isDirectory: () => true },
    ]);

    const result = Effect.runSync(getFolderChildNames("test/path"));
    expect(result).toContain("");
  });

  it("should handle whitespace folder names", () => {
    mockReadDirSync.mockReturnValue([
      { name: "   ", isDirectory: () => true },
      { name: "  folder  ", isDirectory: () => true },
      { name: "\t", isDirectory: () => true },
    ]);

    const result = Effect.runSync(getFolderChildNames("test/path"));
    expect(result).toEqual(["   ", "  folder  ", "\t"]);
  });

  it("should exclude folders with .. for security", () => {
    mockReadDirSync.mockReturnValue([
      { name: "...", isDirectory: () => true },
      { name: "..folder", isDirectory: () => true },
      { name: "folder..", isDirectory: () => true },
      { name: "valid", isDirectory: () => true },
    ]);

    const result = Effect.runSync(getFolderChildNames("test/path"));
    expect(result).toEqual(["folder..", "valid"]);
  });

  it("should handle empty exclude array", () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder1", isDirectory: () => true },
      { name: "folder2", isDirectory: () => true },
    ]);

    const result = Effect.runSync(getFolderChildNames("test/path", []));
    expect(result).toEqual(["folder1", "folder2"]);
  });

  it("should handle exclude with whitespace patterns", () => {
    mockReadDirSync.mockReturnValue([
      { name: "folder1", isDirectory: () => true },
      { name: "  temp  ", isDirectory: () => true },
      { name: "folder2", isDirectory: () => true },
    ]);

    const result = Effect.runSync(
      getFolderChildNames("test/path", ["  temp  "])
    );
    expect(result).toEqual(["folder1", "folder2"]);
  });

  it("should handle large number of directories (performance test)", () => {
    const dirs = Array.from({ length: 1000 }, (_, i) => ({
      name: `folder${i}`,
      isDirectory: () => true,
    }));
    mockReadDirSync.mockReturnValue(dirs);

    const result = Effect.runSync(getFolderChildNames("large/path"));
    expect(result).toHaveLength(1000);
    expect(result[0]).toBe("folder0");
    expect(result[999]).toBe("folder999");
  });

  it("should handle basePath with trailing slash", () => {
    let callCount = 0;
    mockReadDirSync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return [{ name: "child", isDirectory: () => true }];
      }
      return [];
    });

    const result = getNestedSlugs("parent/");
    expect(result).toContainEqual(["child"]);
  });

  it("should handle basePath with multiple slashes", () => {
    let callCount = 0;
    mockReadDirSync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return [{ name: "child", isDirectory: () => true }];
      }
      return [];
    });

    const result = getNestedSlugs("parent///");
    expect(result).toContainEqual(["child"]);
  });

  it("should handle basePath with whitespace", () => {
    let callCount = 0;
    mockReadDirSync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return [{ name: "child", isDirectory: () => true }];
      }
      return [];
    });

    const result = getNestedSlugs("  parent  ");
    expect(result).toContainEqual(["child"]);
  });

  it("should handle very deep nesting (50+ levels)", () => {
    let callCount = 0;
    mockReadDirSync.mockImplementation(() => {
      callCount++;
      if (callCount <= 50) {
        return [{ name: `level${callCount}`, isDirectory: () => true }];
      }
      return [];
    });

    const result = getNestedSlugs("");
    expect(result.length).toBeGreaterThan(0);
    const deepest = result.at(-1);
    expect(deepest?.length).toBeGreaterThan(1);
  });

  it("should handle Unicode characters in basePath", () => {
    let callCount = 0;
    mockReadDirSync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return [{ name: "child", isDirectory: () => true }];
      }
      return [];
    });

    const result = getNestedSlugs("父级");
    expect(result).toContainEqual(["child"]);
  });

  it("should handle large directory tree (performance test)", () => {
    const dirCount = 100;
    let callCount = 0;
    mockReadDirSync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Array.from({ length: dirCount }, (_, i) => ({
          name: `folder${i}`,
          isDirectory: () => true,
        }));
      }
      return [];
    });

    const result = getNestedSlugs("");
    expect(result).toHaveLength(dirCount);
  });
});
