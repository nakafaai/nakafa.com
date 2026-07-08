import { DirectoryReadError } from "@repo/contents/_shared/error";
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

vi.mock("@repo/internationalization/src/routing", () => ({
  routing: {
    locales: ["en", "id"],
  },
}));

import {
  getMdxSlugsFromManifest,
  isMdxContentLocale,
  readMdxSlugManifest,
} from "@repo/contents/_lib/mdx-slugs/source";

beforeEach(() => {
  mockResolveContentsDir.mockReturnValue("/virtual/contents");
  mockReadContentDirectoryPaths.mockReset();
});

describe("readMdxSlugManifest", () => {
  it("copies slugs from a manifest without exposing cached arrays", () => {
    const slugs = ["articles/en"];
    const manifest = new Map([["en", slugs]]);
    const result = getMdxSlugsFromManifest(manifest, "en");

    result.push("articles/mutated");

    expect(result).toStrictEqual(["articles/en", "articles/mutated"]);
    expect(slugs).toStrictEqual(["articles/en"]);
    expect(getMdxSlugsFromManifest(manifest, "id")).toStrictEqual([]);
  });

  it("checks content locales without scanning files", () => {
    expect(isMdxContentLocale("en")).toBe(true);
    expect(isMdxContentLocale("fr")).toBe(false);

    expect(mockReadContentDirectoryPaths).not.toHaveBeenCalled();
  });

  it("reads localized MDX slugs from regular content folders", async () => {
    mockReadContentDirectoryPaths.mockImplementation(
      (directoryPath: string) => {
        if (directoryPath === "/virtual/contents/articles") {
          return Effect.succeed([
            "politics",
            "politics/dynasty",
            "politics/en.mdx",
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

    expect(getMdxSlugsFromManifest(manifest, "en")).toStrictEqual([
      "articles/politics",
      "articles/politics/dynasty",
    ]);
    expect(getMdxSlugsFromManifest(manifest, "id")).toStrictEqual([
      "articles/politics/dynasty",
    ]);
  });

  it("ignores root files and non-content directory entries", async () => {
    mockReadContentDirectoryPaths.mockImplementation(
      (directoryPath: string) => {
        if (directoryPath === "/virtual/contents/articles") {
          return Effect.succeed(["en.mdx", "socket"]);
        }

        return Effect.succeed([]);
      }
    );

    const manifest = await Effect.runPromise(readMdxSlugManifest());

    expect(getMdxSlugsFromManifest(manifest, "en")).toStrictEqual(["articles"]);
  });

  it("treats unreadable directories as empty content folders", async () => {
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

    const manifest = await Effect.runPromise(readMdxSlugManifest());

    expect(getMdxSlugsFromManifest(manifest, "en")).toStrictEqual([]);
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

    expect(getMdxSlugsFromManifest(manifest, "en")).toStrictEqual([
      "material/lesson/mathematics/linear-equation/answer",
      "material/lesson/mathematics/linear-equation/question",
    ]);
  });

  it("keeps typed localized file-stem assets at the root", async () => {
    mockReadContentDirectoryPaths.mockImplementation(
      (directoryPath: string) => {
        if (directoryPath === "/virtual/contents/material") {
          return Effect.succeed(["question.en.mdx", "answer.id.mdx"]);
        }

        return Effect.succeed([]);
      }
    );

    const manifest = await Effect.runPromise(readMdxSlugManifest());

    expect(getMdxSlugsFromManifest(manifest, "en")).toStrictEqual([
      "material/question",
    ]);
    expect(getMdxSlugsFromManifest(manifest, "id")).toStrictEqual([
      "material/answer",
    ]);
  });
});
