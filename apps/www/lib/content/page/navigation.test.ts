// @vitest-environment node

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
import { Cause, Effect, Exit, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  pageKey:
    | "developers"
    | "privacy-policy"
    | "security-policy"
    | "terms-of-service";
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
    pageKey: "developers",
    publicPath: "developers",
    title: "Nakafa Entwicklerressourcen",
  }),
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
  it("selects route and title metadata from the locale-owned catalog", async () => {
    await expect(Effect.runPromise(readPageNavigation("de"))).resolves.toEqual({
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
  });

  it("keeps non-legal signed Pages out of the policy navigation", async () => {
    const navigation = await Effect.runPromise(readPageNavigation("de"));

    expect(navigation.items).not.toContainEqual(
      expect.objectContaining({ pageKey: "developers" })
    );
  });

  it("fails closed when a required legal destination is absent", async () => {
    catalogMock.mockReturnValue(
      Effect.succeed({
        activeReleaseId: "release-pages",
        projections: germanPages.filter(
          ({ pageKey }) => pageKey !== "privacy-policy"
        ),
      })
    );

    const exit = await Effect.runPromiseExit(readPageNavigation("de"));
    const failure = Exit.isFailure(exit)
      ? Cause.findErrorOption(exit.cause)
      : Option.none();

    expect(Option.isSome(failure)).toBe(true);
    if (Option.isSome(failure)) {
      expect(failure.value).toEqual(
        new PageNavigationMissingError({
          locale: "de",
          pageKey: PageKeySchema.make("privacy-policy"),
        })
      );
    }
  });

  it("keeps isolated document previews independent from full Page state", async () => {
    previewMock.mockReturnValue(true);

    await expect(getShellPageNavigation("de")).resolves.toBeNull();
    expect(catalogMock).not.toHaveBeenCalled();
  });

  it("loads and caches complete signed navigation for the product shell", async () => {
    await expect(getShellPageNavigation("de")).resolves.toMatchObject({
      privacyPolicyHref: "/privacy-policy",
      termsOfServiceHref: "/terms-of-service",
    });
    expect(cacheMock).toHaveBeenCalledWith("page");
  });
});
