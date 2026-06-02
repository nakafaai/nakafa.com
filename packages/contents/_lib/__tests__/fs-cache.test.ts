import {
  clearFolderChildNamesCache,
  getFolderChildNames,
} from "@repo/contents/_lib/fs";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  clearFolderChildNamesCache();
  mockReadDirSync.mockReset();
});

describe("effectful folder child scan cache", () => {
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
});
