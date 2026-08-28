// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  AppLocaleSchema,
  ArtifactLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  PageKeySchema,
  PublicPageProjectionSchema,
} from "@nakafa/aksara-contracts/projection/page";
import { Effect } from "effect";
import { vi } from "vitest";
import {
  getShellPageNavigation,
  PageNavigationMissingError,
  readPageNavigation,
} from "@/lib/content/page/navigation";
import { testPageProjection } from "@/test/content-page";

const catalogMock = vi.hoisted(() => vi.fn());
const previewMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());

function makeGermanPage({
  pageKey,
  publicPath,
  title,
}: {
  pageKey: "privacy-policy" | "security-policy" | "terms-of-service";
  publicPath: string;
  title: string;
}) {
  return PublicPageProjectionSchema.make({
    ...testPageProjection,
    appLocale: AppLocaleSchema.make("de"),
    artifactLocale: ArtifactLocaleSchema.make("de"),
    contentKey: ContentKeySchema.make(`pages/${pageKey}`),
    metadata: {
      ...testPageProjection.metadata,
      title,
    },
    pageKey: PageKeySchema.make(pageKey),
    publicPath: PublicPathSchema.make(publicPath),
    sourcePath: CorpusSourcePathSchema.make(
      `packages/corpus/pages/${pageKey}/de.mdx`
    ),
  });
}

const germanPages = [
  makeGermanPage({
    pageKey: "privacy-policy",
    publicPath: "privacy-policy",
    title: "Datenschutzrichtlinie",
  }),
  makeGermanPage({
    pageKey: "security-policy",
    publicPath: "security-policy",
    title: "Sicherheitsrichtlinie",
  }),
  makeGermanPage({
    pageKey: "terms-of-service",
    publicPath: "terms-of-service",
    title: "Nutzungsbedingungen",
  }),
];

vi.mock("@/lib/content/page/catalog", () => ({
  readPublishedPageCatalog: catalogMock,
}));

vi.mock("@/lib/content/preview/config", () => ({
  hasPreviewConfig: previewMock,
}));

vi.mock("@/lib/content/cache", () => ({
  applyPublishedCatalogCache: cacheMock,
}));

beforeEach(() => {
  cacheMock.mockReset();
  previewMock.mockReset().mockReturnValue(false);
  catalogMock.mockReset().mockReturnValue(
    Effect.succeed({
      activeReleaseId: "release-pages",
      projections: [testPageProjection, ...germanPages],
    })
  );
});

describe("signed Page navigation", () => {
  it.effect(
    "selects route and title metadata from the locale-owned catalog",
    () =>
      Effect.gen(function* () {
        const navigation = yield* readPageNavigation("de");

        expect(navigation).toEqual({
          items: [
            {
              href: "/privacy-policy",
              pageKey: "privacy-policy",
              title: "Datenschutzrichtlinie",
            },
            {
              href: "/security-policy",
              pageKey: "security-policy",
              title: "Sicherheitsrichtlinie",
            },
            {
              href: "/terms-of-service",
              pageKey: "terms-of-service",
              title: "Nutzungsbedingungen",
            },
          ],
          privacyPolicyHref: "/privacy-policy",
          termsOfServiceHref: "/terms-of-service",
        });
      })
  );

  it.effect("fails closed when a required legal destination is absent", () =>
    Effect.gen(function* () {
      catalogMock.mockReturnValue(
        Effect.succeed({
          activeReleaseId: "release-pages",
          projections: germanPages.filter(
            ({ pageKey }) => pageKey !== "privacy-policy"
          ),
        })
      );

      const failure = yield* readPageNavigation("de").pipe(Effect.flip);

      expect(failure).toEqual(
        new PageNavigationMissingError({
          locale: "de",
          pageKey: PageKeySchema.make("privacy-policy"),
        })
      );
    })
  );

  it.effect(
    "keeps isolated document previews independent from full Page state",
    () =>
      Effect.gen(function* () {
        previewMock.mockReturnValue(true);

        const navigation = yield* Effect.tryPromise(() =>
          getShellPageNavigation("de")
        );

        expect(navigation).toBeNull();
        expect(catalogMock).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "loads and caches complete signed navigation for the product shell",
    () =>
      Effect.gen(function* () {
        const navigation = yield* Effect.tryPromise(() =>
          getShellPageNavigation("de")
        );

        expect(navigation).toMatchObject({
          privacyPolicyHref: "/privacy-policy",
          termsOfServiceHref: "/terms-of-service",
        });
        expect(cacheMock).toHaveBeenCalledWith("page");
      })
  );
});
