import { clearFolderChildNamesCache } from "@repo/contents/_lib/fs/cache";
import { getNestedSlugs } from "@repo/contents/_lib/fs/nested-slugs";
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

describe("getNestedSlugs", () => {
  it("returns an empty array for empty base paths with no children", () => {
    expect(Effect.runSync(getNestedSlugs(""))).toEqual([]);
  });

  it("returns nested slugs for a simple structure", () => {
    let callCount = 0;
    mockReadDirSync.mockImplementation(() => {
      callCount += 1;

      if (callCount === 1) {
        return [{ name: "folder1", isDirectory: () => true }];
      }

      return [];
    });

    expect(Effect.runSync(getNestedSlugs(""))).toContainEqual(["folder1"]);
  });

  it("returns nested slugs for multiple levels", () => {
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

    const result = Effect.runSync(getNestedSlugs(""));

    expect(result).toContainEqual(["parent"]);
    expect(result).toContainEqual(["parent", "child"]);
  });

  it("reuses nested slug scans for the same folder cache version", () => {
    mockReadDirSync
      .mockImplementationOnce(() => [
        { name: "cached", isDirectory: () => true },
      ])
      .mockImplementation(() => []);

    expect(Effect.runSync(getNestedSlugs(""))).toEqual([["cached"]]);
    expect(Effect.runSync(getNestedSlugs(""))).toEqual([["cached"]]);
    expect(mockReadDirSync).toHaveBeenCalledTimes(2);
  });

  it("refreshes nested slug scans after the folder cache is cleared", () => {
    mockReadDirSync
      .mockImplementationOnce(() => [
        { name: "first", isDirectory: () => true },
      ])
      .mockImplementationOnce(() => []);

    expect(Effect.runSync(getNestedSlugs(""))).toEqual([["first"]]);

    Effect.runSync(clearFolderChildNamesCache());
    mockReadDirSync.mockClear();
    mockReadDirSync
      .mockImplementationOnce(() => [
        { name: "second", isDirectory: () => true },
      ])
      .mockImplementationOnce(() => []);

    expect(Effect.runSync(getNestedSlugs(""))).toEqual([["second"]]);
    expect(mockReadDirSync).toHaveBeenCalledTimes(2);
  });

  it("preserves top-level directory order", () => {
    mockReadDirSync.mockImplementationOnce(() => [
      { name: "a", isDirectory: () => true },
      { name: "b", isDirectory: () => true },
      { name: "c", isDirectory: () => true },
    ]);

    expect(Effect.runSync(getNestedSlugs(""))).toEqual([["a"], ["b"], ["c"]]);
  });

  it("handles non-empty base paths", () => {
    mockReadDirSync.mockImplementationOnce(() => [
      { name: "child", isDirectory: () => true },
    ]);

    expect(Effect.runSync(getNestedSlugs("parent"))).toContainEqual(["child"]);
  });

  it("normalizes base paths before scanning", () => {
    mockReadDirSync.mockImplementationOnce(() => [
      { name: "child", isDirectory: () => true },
    ]);

    expect(Effect.runSync(getNestedSlugs("parent///"))).toContainEqual([
      "child",
    ]);
  });

  it("handles structures with only leaf directories", () => {
    mockReadDirSync.mockImplementationOnce(() => [
      { name: "leaf1", isDirectory: () => true },
      { name: "leaf2", isDirectory: () => true },
    ]);

    expect(Effect.runSync(getNestedSlugs(""))).toEqual([["leaf1"], ["leaf2"]]);
  });

  it("handles deep nesting", () => {
    let callCount = 0;
    mockReadDirSync.mockImplementation(() => {
      callCount += 1;

      if (callCount <= 50) {
        return [{ name: `level${callCount}`, isDirectory: () => true }];
      }

      return [];
    });

    const deepest = Effect.runSync(getNestedSlugs("")).at(-1);

    expect(deepest?.length).toBeGreaterThan(1);
  });

  it("returns an empty array when directory reads fail", () => {
    mockReadDirSync.mockImplementation(() => {
      throw new Error("Directory not found");
    });

    expect(Effect.runSync(getNestedSlugs(""))).toEqual([]);
  });

  it("treats invalid nested base paths as leaf nodes", () => {
    expect(Effect.runSync(getNestedSlugs("../subject"))).toEqual([]);
    expect(mockReadDirSync).not.toHaveBeenCalled();
  });

  it("handles large directory trees", () => {
    const dirCount = 100;
    mockReadDirSync.mockImplementationOnce(() =>
      Array.from({ length: dirCount }, (_, index) => ({
        name: `folder${index}`,
        isDirectory: () => true,
      }))
    );

    expect(Effect.runSync(getNestedSlugs(""))).toHaveLength(dirCount);
  });
});
