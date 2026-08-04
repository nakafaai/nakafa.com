import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRetainedTryoutMetadata,
  generateTryoutRouteMetadata,
} from "@/components/tryout/catalog/metadata";

const runtimeMocks = vi.hoisted(() => ({
  readTryoutMetadata: vi.fn(),
}));
const navigationMocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
const translationMocks = vi.hoisted(() => ({
  getTranslations: vi.fn(),
}));
const staticRouteMocks = vi.hoisted(() => ({
  loadCount: 0,
  readRoutes: vi.fn(),
}));

const STATIC_ROUTES = [
  {
    countryKey: "indonesia",
    examKey: "snbt",
    kind: "tryout-section",
    locale: "en",
    publicPath: "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
    sectionKey: "quantitative-knowledge",
    setKey: "set-1",
    title: "Quantitative Knowledge",
    trackKey: "2027",
  },
  {
    countryKey: "indonesia",
    examKey: "snbt",
    kind: "tryout-section",
    locale: "id",
    publicPath: "try-out/indonesia/snbt/2027/set-1/pengetahuan-kuantitatif",
    sectionKey: "quantitative-knowledge",
    setKey: "set-1",
    title: "Pengetahuan Kuantitatif",
    trackKey: "2027",
  },
  {
    countryKey: "indonesia",
    examKey: "snbt",
    kind: "tryout-section",
    locale: "en",
    publicPath: "try-out/indonesia/snbt/2027/set-1/general-reasoning",
    sectionKey: "general-reasoning",
    setKey: "set-1",
    title: "General Reasoning",
    trackKey: "2027",
  },
] as const;

vi.mock("server-only", () => ({}));
vi.mock("@/components/tryout/catalog/server", () => runtimeMocks);
vi.mock("next/navigation", () => navigationMocks);
vi.mock("next-intl/server", () => translationMocks);
vi.mock("@repo/contents/_types/route/tryout/static", () => {
  staticRouteMocks.loadCount += 1;
  return { readStaticPublicTryoutRoutes: staticRouteMocks.readRoutes };
});

beforeEach(() => {
  runtimeMocks.readTryoutMetadata.mockReset();
  navigationMocks.notFound.mockClear();
  translationMocks.getTranslations.mockReset();
  translationMocks.getTranslations.mockResolvedValue(
    (key: string) => `translated:${key}`
  );
  staticRouteMocks.readRoutes.mockReset();
  staticRouteMocks.readRoutes.mockReturnValue(STATIC_ROUTES);
});

describe("try-out route metadata", () => {
  it("keeps an authenticated retained route out of search indexes", () => {
    expect(
      createRetainedTryoutMetadata({
        description: "Frozen attempt section",
        title: "Quantitative Knowledge",
      })
    ).toEqual({
      description: "Frozen attempt section",
      robots: { follow: false, index: false },
      title: { absolute: "Quantitative Knowledge" },
    });
  });

  it("uses signed copy and exact localized canonical paths", async () => {
    expect(staticRouteMocks.loadCount).toBe(0);
    runtimeMocks.readTryoutMetadata.mockResolvedValue({
      managed: true,
      route: {
        alternates: [
          {
            locale: "en",
            publicPath:
              "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
          },
          {
            locale: "id",
            publicPath:
              "try-out/indonesia/snbt/2027/set-1/pengetahuan-kuantitatif",
          },
        ],
        description: "Signed section description",
        publicPath: "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
        title: "Quantitative Knowledge",
      },
    });

    const metadata = await generateTryoutRouteMetadata({
      kind: "section",
      locale: "en",
      publicPath: "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
    });

    expect(metadata).toMatchObject({
      alternates: {
        canonical:
          "/en/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
        languages: {
          en: "/en/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
          id: "/id/try-out/indonesia/snbt/2027/set-1/pengetahuan-kuantitatif",
          "x-default":
            "/en/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
        },
      },
      description: "Signed section description",
      title: { absolute: "Quantitative Knowledge" },
    });
    expect(staticRouteMocks.loadCount).toBe(0);
    expect(staticRouteMocks.readRoutes).not.toHaveBeenCalled();
  });

  it("uses the source registry and generic copy before activation", async () => {
    runtimeMocks.readTryoutMetadata.mockResolvedValue({
      managed: false,
      route: null,
    });

    const metadata = await generateTryoutRouteMetadata({
      kind: "section",
      locale: "id",
      publicPath: "try-out/indonesia/snbt/2027/set-1/pengetahuan-kuantitatif",
    });

    expect(metadata).toMatchObject({
      alternates: {
        languages: {
          en: "/en/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
          id: "/id/try-out/indonesia/snbt/2027/set-1/pengetahuan-kuantitatif",
        },
      },
      description: "translated:metadata-description",
    });
    expect(staticRouteMocks.loadCount).toBe(1);
    expect(staticRouteMocks.readRoutes).toHaveBeenCalledOnce();
  });

  it("returns the route-level 404 for an unknown hierarchy path", async () => {
    runtimeMocks.readTryoutMetadata.mockResolvedValue({
      managed: true,
      route: null,
    });

    await expect(
      generateTryoutRouteMetadata({
        kind: "country",
        locale: "id",
        publicPath: "try-out/missing",
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(navigationMocks.notFound).toHaveBeenCalledOnce();
  });

  it("returns the route-level 404 for an unknown static hierarchy path", async () => {
    runtimeMocks.readTryoutMetadata.mockResolvedValue({
      managed: false,
      route: null,
    });

    await expect(
      generateTryoutRouteMetadata({
        kind: "country",
        locale: "id",
        publicPath: "try-out/missing",
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(navigationMocks.notFound).toHaveBeenCalledOnce();
  });
});
