import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockReadMdxSlugManifest } = vi.hoisted(() => ({
  mockReadMdxSlugManifest: vi.fn(),
}));

vi.mock("@repo/contents/_lib/mdx-slugs/source", () => ({
  getMdxSlugsFromManifest: (
    manifest: ReadonlyMap<string, readonly string[]>,
    locale: string
  ) => {
    const slugs = manifest.get(locale);

    if (!slugs) {
      return [];
    }

    return [...slugs];
  },
  isMdxContentLocale: (locale: string) => ["en", "id"].includes(locale),
  readMdxSlugManifest: mockReadMdxSlugManifest,
}));

import {
  clearMdxSlugCache,
  getMdxSlugsForLocale,
} from "@repo/contents/_lib/mdx-slugs/cache";

beforeEach(() => {
  mockReadMdxSlugManifest.mockReset();
  Effect.runSync(clearMdxSlugCache());
});

describe("getMdxSlugsForLocale", () => {
  it("caches the all-locale slug manifest through native Effect Cache", async () => {
    mockReadMdxSlugManifest.mockImplementation(() =>
      Effect.succeed(
        new Map([
          ["en", ["articles/en"]],
          ["id", ["articles/id"]],
        ])
      )
    );

    const result = await Effect.runPromise(
      Effect.all([getMdxSlugsForLocale("en"), getMdxSlugsForLocale("id")], {
        concurrency: "unbounded",
      })
    );

    expect(result).toStrictEqual([["articles/en"], ["articles/id"]]);
    expect(mockReadMdxSlugManifest).toHaveBeenCalledTimes(1);
  });

  it("invalidates cached locale slug lookups", async () => {
    mockReadMdxSlugManifest.mockImplementation(() =>
      Effect.succeed(new Map([["id", ["articles/id"]]]))
    );

    await Effect.runPromise(getMdxSlugsForLocale("id"));
    await Effect.runPromise(clearMdxSlugCache());
    await Effect.runPromise(getMdxSlugsForLocale("id"));

    expect(mockReadMdxSlugManifest).toHaveBeenCalledTimes(2);
  });

  it("returns no slugs when a supported locale is absent from the manifest", async () => {
    mockReadMdxSlugManifest.mockImplementation(() =>
      Effect.succeed(new Map([["id", ["articles/id"]]]))
    );

    const result = await Effect.runPromise(getMdxSlugsForLocale("en"));

    expect(result).toStrictEqual([]);
    expect(mockReadMdxSlugManifest).toHaveBeenCalledTimes(1);
  });

  it("skips the cache for unsupported locales", async () => {
    const result = await Effect.runPromise(getMdxSlugsForLocale("fr"));

    expect(result).toStrictEqual([]);
    expect(mockReadMdxSlugManifest).not.toHaveBeenCalled();
  });
});
