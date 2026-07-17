import {
  DirectoryReadError,
  MdxLocaleParityError,
} from "@repo/contents/_shared/error";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockReadContentDirectoryPaths, mockResolveContentsDir } = vi.hoisted(
  () => ({
    mockReadContentDirectoryPaths: vi.fn(),
    mockResolveContentsDir: vi.fn(() => "/virtual/contents"),
  })
);

vi.mock("@repo/contents/_lib/root", () => ({
  resolveContentsDir: mockResolveContentsDir,
}));

vi.mock("@repo/contents/_lib/fs/folder-scan", () => ({
  readContentDirectoryPaths: mockReadContentDirectoryPaths,
}));

import { readMdxSlugManifest } from "@repo/contents/_lib/mdx-slugs/source";

beforeEach(() => {
  mockResolveContentsDir.mockReturnValue("/virtual/contents");
  mockReadContentDirectoryPaths.mockReset();
});

describe("readMdxSlugManifest", () => {
  it("reads localized MDX slugs from regular content folders", async () => {
    mockReadContentDirectoryPaths.mockImplementation(
      (directoryPath: string) => {
        if (directoryPath === "/virtual/contents/articles") {
          return Effect.succeed([
            "politics",
            "politics/dynasty",
            "politics/en.mdx",
            "politics/id.mdx",
            "politics/fr.mdx",
            "politics/notes.txt",
            "politics/dynasty/id.mdx",
            "politics/dynasty/en.mdx",
          ]);
        }

        return Effect.succeed([]);
      }
    );

    const manifest = await Effect.runPromise(readMdxSlugManifest());

    expect(manifest.en).toStrictEqual([
      "articles/politics",
      "articles/politics/dynasty",
    ]);
    expect(manifest.id).toStrictEqual([
      "articles/politics",
      "articles/politics/dynasty",
    ]);
  });

  it("ignores root files and non-content directory entries", async () => {
    mockReadContentDirectoryPaths.mockImplementation(
      (directoryPath: string) => {
        if (directoryPath === "/virtual/contents/articles") {
          return Effect.succeed(["en.mdx", "id.mdx", "socket"]);
        }

        return Effect.succeed([]);
      }
    );

    const manifest = await Effect.runPromise(readMdxSlugManifest());

    expect(manifest.en).toStrictEqual(["articles"]);
  });

  it("preserves typed failures for unreadable content folders", async () => {
    mockReadContentDirectoryPaths.mockImplementation((directoryPath: string) =>
      directoryPath === "/virtual/contents/articles"
        ? Effect.fail(
            new DirectoryReadError({
              cause: new Error("missing"),
              message: "Unable to read content directory.",
              path: directoryPath,
            })
          )
        : Effect.succeed([])
    );

    const error = await Effect.runPromise(Effect.flip(readMdxSlugManifest()));

    expect(error).toBeInstanceOf(DirectoryReadError);
    if (!(error instanceof DirectoryReadError)) {
      return;
    }

    expect(error.path).toBe("/virtual/contents/articles");
  });

  it("keeps localized file-stem MDX slugs under material lessons", async () => {
    mockReadContentDirectoryPaths.mockImplementation(
      (directoryPath: string) => {
        if (directoryPath === "/virtual/contents/material") {
          return Effect.succeed([
            "lesson/mathematics/linear-equation/question.en.mdx",
            "lesson/mathematics/linear-equation/question.id.mdx",
            "lesson/mathematics/linear-equation/asset",
            "lesson/mathematics/linear-equation/answer.en.mdx",
            "lesson/mathematics/linear-equation/answer.id.mdx",
          ]);
        }

        return Effect.succeed([]);
      }
    );

    const manifest = await Effect.runPromise(readMdxSlugManifest());

    expect(manifest.en).toStrictEqual([
      "material/lesson/mathematics/linear-equation/answer",
      "material/lesson/mathematics/linear-equation/question",
    ]);
  });

  it("keeps typed localized file-stem assets at the root", async () => {
    mockReadContentDirectoryPaths.mockImplementation(
      (directoryPath: string) => {
        if (directoryPath === "/virtual/contents/material") {
          return Effect.succeed([
            "answer.en.mdx",
            "answer.id.mdx",
            "question.en.mdx",
            "question.id.mdx",
          ]);
        }

        return Effect.succeed([]);
      }
    );

    const manifest = await Effect.runPromise(readMdxSlugManifest());

    expect(manifest.en).toStrictEqual(["material/answer", "material/question"]);
    expect(manifest.id).toStrictEqual(["material/answer", "material/question"]);
  });

  it("fails when localized MDX paths drift", async () => {
    mockReadContentDirectoryPaths.mockImplementation(
      (directoryPath: string) => {
        if (directoryPath === "/virtual/contents/articles") {
          return Effect.succeed(["politics/en.mdx"]);
        }

        return Effect.succeed([]);
      }
    );

    const error = await Effect.runPromise(Effect.flip(readMdxSlugManifest()));

    expect(error).toBeInstanceOf(MdxLocaleParityError);
    if (!(error instanceof MdxLocaleParityError)) {
      return;
    }

    expect(error.missingSlugs).toStrictEqual(["articles/politics"]);
  });
});
