import { readContentDirectoryPaths } from "@repo/contents/_lib/fs/folder-scan";
import { DirectoryReadError } from "@repo/contents/_shared/error";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockReadDirectory } = vi.hoisted(() => ({
  mockReadDirectory: vi.fn(),
}));

vi.mock("@repo/contents/_lib/io/content", async () => {
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
    },
  };
});

beforeEach(() => {
  mockReadDirectory.mockReset();
});

describe("readContentDirectoryPaths", () => {
  it("reads the directory tree recursively", async () => {
    mockReadDirectory.mockReturnValue(["articles/example/en.mdx"]);

    await expect(
      Effect.runPromise(readContentDirectoryPaths("/contents"))
    ).resolves.toStrictEqual(["articles/example/en.mdx"]);
    expect(mockReadDirectory).toHaveBeenCalledWith("/contents", {
      recursive: true,
    });
  });

  it("maps filesystem failures to DirectoryReadError", async () => {
    mockReadDirectory.mockImplementation(() => {
      throw new Error("missing directory");
    });

    const failure = await Effect.runPromise(
      Effect.flip(readContentDirectoryPaths("/contents/missing"))
    );

    expect(failure).toBeInstanceOf(DirectoryReadError);
    expect(failure).toMatchObject({ path: "/contents/missing" });
  });
});
