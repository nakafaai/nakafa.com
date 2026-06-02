import {
  readContentDirectoryEntries,
  readContentDirectoryPaths,
} from "@repo/contents/_lib/fs/folder-scan";
import { DirectoryReadError } from "@repo/contents/_shared/error";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockReadDirectory, mockStat } = vi.hoisted(() => ({
  mockReadDirectory: vi.fn(),
  mockStat: vi.fn(),
}));

vi.mock("@repo/contents/_lib/io/content-io", async () => {
  const { Effect, Layer } = await import("effect");

  return {
    ContentIO: {
      Default: Layer.empty,
      readDirectory: (
        directoryPath: string,
        options?: { recursive?: boolean }
      ) =>
        Effect.try({
          catch: (cause) => cause,
          try: () => mockReadDirectory(directoryPath, options),
        }),
      stat: (filePath: string) =>
        Effect.try({
          catch: (cause) => cause,
          try: () => mockStat(filePath),
        }),
    },
  };
});

beforeEach(() => {
  mockReadDirectory.mockReset();
  mockStat.mockReset();
});

describe("folder scan", () => {
  it("maps platform stats into content directory entries", async () => {
    mockReadDirectory.mockReturnValue(["child", "lesson.mdx"]);
    mockStat.mockImplementation((filePath: string) => ({
      type: filePath.endsWith("child") ? "Directory" : "File",
    }));

    const entries = await Effect.runPromise(
      readContentDirectoryEntries("/contents/articles")
    );

    expect(entries.map((entry) => entry.name)).toStrictEqual([
      "child",
      "lesson.mdx",
    ]);
    expect(entries[0]?.isDirectory()).toBe(true);
    expect(entries[0]?.isFile()).toBe(false);
    expect(entries[1]?.isDirectory()).toBe(false);
    expect(entries[1]?.isFile()).toBe(true);
  });

  it("maps recursive read failures to DirectoryReadError", async () => {
    mockReadDirectory.mockImplementation(() => {
      throw new Error("missing directory");
    });

    const failure = await Effect.runPromise(
      Effect.match(readContentDirectoryPaths("/contents/missing"), {
        onFailure: (error) => error,
        onSuccess: () => null,
      })
    );

    expect(failure).toBeInstanceOf(DirectoryReadError);
    expect(failure).toMatchObject({ path: "/contents/missing" });
  });
});
