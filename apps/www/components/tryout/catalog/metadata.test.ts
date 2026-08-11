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

vi.mock("server-only", () => ({}));
vi.mock("@/components/tryout/catalog/server", () => runtimeMocks);
vi.mock("next/navigation", () => navigationMocks);
vi.mock("next-intl/server", () => translationMocks);

beforeEach(() => {
  runtimeMocks.readTryoutMetadata.mockReset();
  navigationMocks.notFound.mockClear();
  translationMocks.getTranslations.mockReset();
  translationMocks.getTranslations.mockResolvedValue(
    (key: string) => `translated:${key}`
  );
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
    runtimeMocks.readTryoutMetadata.mockResolvedValue({
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
      openGraph: {
        images: [
          {
            url: "/en/og/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge/image.png",
          },
        ],
      },
      title: { absolute: "Quantitative Knowledge" },
      twitter: {
        images: [
          {
            url: "/en/og/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge/image.png",
          },
        ],
      },
    });
  });

  it("uses reviewed artwork for an Indonesian exam root", async () => {
    runtimeMocks.readTryoutMetadata.mockResolvedValue({
      route: {
        alternates: [],
        description: "Signed SNBT description",
        publicPath: "try-out/indonesia/snbt",
        title: "SNBT",
      },
    });

    const metadata = await generateTryoutRouteMetadata({
      countryKey: "indonesia",
      examKey: "snbt",
      kind: "exam",
      locale: "id",
      publicPath: "try-out/indonesia/snbt",
    });

    expect(metadata).toMatchObject({
      openGraph: {
        images: [{ url: "/open-graph/tryout/indonesia/id-snbt.png" }],
      },
      twitter: {
        images: [{ url: "/open-graph/tryout/indonesia/id-snbt.png" }],
      },
    });
    expect(runtimeMocks.readTryoutMetadata).toHaveBeenCalledWith({
      kind: "exam",
      locale: "id",
      publicPath: "try-out/indonesia/snbt",
    });
  });

  it.each(["country", "track", "set", "section"] as const)(
    "keeps generated social images for a %s route",
    async (kind) => {
      const publicPath = "try-out/indonesia/snbt/2027/set-1";
      runtimeMocks.readTryoutMetadata.mockResolvedValue({
        route: {
          alternates: [],
          publicPath,
          title: "Signed route",
        },
      });

      const metadata = await generateTryoutRouteMetadata({
        kind,
        locale: "en",
        publicPath,
      });

      expect(metadata).toMatchObject({
        openGraph: {
          images: [
            {
              url: "/en/og/try-out/indonesia/snbt/2027/set-1/image.png",
            },
          ],
        },
        twitter: {
          images: [
            {
              url: "/en/og/try-out/indonesia/snbt/2027/set-1/image.png",
            },
          ],
        },
      });
    }
  );

  it("uses localized fallback copy when the signed route has no description", async () => {
    runtimeMocks.readTryoutMetadata.mockResolvedValue({
      route: {
        alternates: [],
        publicPath: "try-out/indonesia",
        title: "Indonesia",
      },
    });

    const metadata = await generateTryoutRouteMetadata({
      kind: "country",
      locale: "en",
      publicPath: "try-out/indonesia",
    });

    expect(metadata.description).toBe("translated:metadata-description");
  });

  it("returns the route-level 404 for an unknown hierarchy path", async () => {
    runtimeMocks.readTryoutMetadata.mockResolvedValue({
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
