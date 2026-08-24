// @vitest-environment node

import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  PublicPathSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  AppLocaleSchema,
  ArtifactLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  PageKeySchema,
  PublicPageProjectionSchema,
} from "@nakafa/aksara-contracts/projection/page";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it, vi } from "vitest";
import { testPageProjection } from "@/test/content-page";
import {
  ContactPageMissingError,
  getContactPageInput,
  readContactPageInput,
} from "./contact";

const mockReadPublishedPageCatalog = vi.hoisted(() => vi.fn());
const mockApplyPublishedCatalogCache = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/page/catalog", () => ({
  readPublishedPageCatalog: mockReadPublishedPageCatalog,
}));

vi.mock("@/lib/content/cache", () => ({
  applyPublishedCatalogCache: mockApplyPublishedCatalogCache,
}));

const imprintProjection = PublicPageProjectionSchema.make({
  ...testPageProjection,
  appLocale: AppLocaleSchema.make("en"),
  artifactLocale: ArtifactLocaleSchema.make("en"),
  contentKey: ContentKeySchema.make("pages/imprint"),
  pageKey: PageKeySchema.make("imprint"),
  publicPath: PublicPathSchema.make("legal-notice"),
  sourcePath: CorpusSourcePathSchema.make(
    "packages/corpus/pages/imprint/en.mdx"
  ),
});
const catalog = {
  activeReleaseId: ReleaseIdSchema.make("release-contact"),
  projections: [testPageProjection, imprintProjection],
};

describe("contact Page alias", () => {
  it("selects the reviewed company-information Page by stable identity", async () => {
    mockReadPublishedPageCatalog.mockReturnValue(Effect.succeed(catalog));

    await expect(
      Effect.runPromise(readContactPageInput("en"))
    ).resolves.toEqual({
      activeReleaseId: "release-contact",
      appLocale: "en",
      publicPath: "legal-notice",
    });
  });

  it("reads and caches the signed contact target at framework boundaries", async () => {
    mockReadPublishedPageCatalog.mockReturnValue(Effect.succeed(catalog));

    await expect(
      Effect.runPromise(readContactPageInput("en"))
    ).resolves.toEqual({
      activeReleaseId: "release-contact",
      appLocale: "en",
      publicPath: "legal-notice",
    });
    await expect(getContactPageInput("en")).resolves.toEqual({
      activeReleaseId: "release-contact",
      appLocale: "en",
      publicPath: "legal-notice",
    });
    expect(mockApplyPublishedCatalogCache).toHaveBeenCalledWith("page");
  });

  it("fails with a typed error when the reviewed target is absent", async () => {
    mockReadPublishedPageCatalog.mockReturnValue(
      Effect.succeed({
        activeReleaseId: ReleaseIdSchema.make("release-contact"),
        projections: [testPageProjection],
      })
    );
    const exit = await Effect.runPromiseExit(readContactPageInput("de"));
    const failure = Exit.isFailure(exit)
      ? Cause.findErrorOption(exit.cause)
      : Option.none();

    expect(Option.isSome(failure)).toBe(true);
    if (Option.isSome(failure)) {
      expect(failure.value).toEqual(
        new ContactPageMissingError({ locale: AppLocaleSchema.make("de") })
      );
    }
  });
});
