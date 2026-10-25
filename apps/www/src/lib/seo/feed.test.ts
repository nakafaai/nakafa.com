// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { Array as Arr, Effect, Exit } from "effect";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { readRssText } from "@/lib/seo/feed";

const readPublishedLatestArticlesMock = vi.hoisted(() => vi.fn());
const readPublishedLatestMaterialsMock = vi.hoisted(() => vi.fn());
const loadActiveContentIdentityMock = vi.hoisted(() => vi.fn());
const readServerTranslatorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/article/discovery", () => ({
  /** Controls the latest signed articles of one locale. */
  readPublishedLatestArticles: readPublishedLatestArticlesMock,
}));

vi.mock("@/lib/content/material/discovery", () => ({
  /** Controls the latest signed materials of one locale. */
  readPublishedLatestMaterials: readPublishedLatestMaterialsMock,
}));

vi.mock("@/lib/content/published/active", () => ({
  /** Answers the release that Convex holds right now. */
  loadActiveContentIdentity: loadActiveContentIdentityMock,
}));

vi.mock("@repo/internationalization/src/translator", () => ({
  /** Answers each copy key with its namespace, so the feed names its source. */
  readServerTranslator: readServerTranslatorMock,
}));

const RELEASE = "release-feed";
const BASE = COMPANY_IDENTITY.url;

/** Lists the item titles of a feed document in document order, without CDATA. */
function titles(xml: string) {
  return Arr.map(
    [...xml.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>/gu)],
    (match) => match[1].replace(/^<!\[CDATA\[|\]\]>$/gu, "")
  );
}

beforeEach(() => {
  loadActiveContentIdentityMock.mockReset().mockReturnValue(
    Effect.succeed({
      manifestHash: `sha256:${"a".repeat(64)}`,
      releaseId: RELEASE,
      sequence: 1,
    })
  );
  readServerTranslatorMock.mockReset().mockImplementation(
    async ({ namespace }: { readonly namespace: string }) =>
      (key: string) =>
        `${namespace}.${key}`
  );
  readPublishedLatestArticlesMock
    .mockReset()
    .mockImplementation((locale: string) =>
      Effect.succeed({
        articles:
          locale === "en"
            ? [
                {
                  authors: [{ name: "Nabil" }],
                  dateModified: "2026-03-01",
                  datePublished: "2026-01-02",
                  description: "Belajar aljabar",
                  publicPath: "articles/aljabar",
                  title: "Aljabar",
                },
                {
                  authors: [],
                  datePublished: "2026-02-10",
                  description: null,
                  publicPath: "articles/geometri",
                  title: "Geometri",
                },
              ]
            : [],
      })
    );
  readPublishedLatestMaterialsMock
    .mockReset()
    .mockImplementation((locale: string) =>
      Effect.succeed({
        materials:
          locale === "en"
            ? [
                {
                  authors: [],
                  datePublished: "2026-01-20",
                  description: "Materi integral",
                  publicPath: "subjects/math/integral",
                  sourcePath: "math/integral",
                  title: "Integral",
                },
              ]
            : [],
      })
    );
});

describe("rss feed text", () => {
  it.effect(
    "renders the feed of every signed route, newest first, under its own links",
    () =>
      Effect.gen(function* () {
        const xml = yield* readRssText();

        expect(titles(xml)).toEqual(["Geometri", "Integral", "Aljabar"]);
        expect(xml).toContain(`${BASE}/en/articles/aljabar`);
        expect(xml).toContain(`${BASE}/en/og/articles/aljabar/image.png`);
        expect(xml).toContain("Metadata.title");
      })
  );

  it.effect("renders an empty feed when no content is published", () =>
    Effect.gen(function* () {
      readPublishedLatestArticlesMock.mockReturnValue(
        Effect.succeed({ articles: [] })
      );
      readPublishedLatestMaterialsMock.mockReturnValue(
        Effect.succeed({ materials: [] })
      );

      const xml = yield* readRssText();

      expect(titles(xml)).toEqual([]);
    })
  );

  it.effect("fails without an active release, so the build stops", () =>
    Effect.gen(function* () {
      loadActiveContentIdentityMock.mockReturnValue(Effect.void);

      const error = yield* Effect.flip(readRssText());

      expect(error).toBeInstanceOf(PublishedProjectionError);
    })
  );

  it.effect("fails when the release changes during the read", () =>
    Effect.gen(function* () {
      loadActiveContentIdentityMock
        .mockReturnValueOnce(
          Effect.succeed({
            manifestHash: `sha256:${"a".repeat(64)}`,
            releaseId: RELEASE,
            sequence: 1,
          })
        )
        .mockReturnValueOnce(Effect.void);

      const exit = yield* Effect.exit(readRssText());

      expect(Exit.isFailure(exit)).toBe(true);
    })
  );
});
