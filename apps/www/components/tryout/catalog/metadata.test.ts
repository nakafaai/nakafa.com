import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateTryoutRouteMetadata } from "@/components/tryout/catalog/metadata";

const runtimeMocks = vi.hoisted(() => ({
  getRuntimeTryoutMetadata: vi.fn(),
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
vi.mock("@/lib/content/runtime/routes", () => runtimeMocks);
vi.mock("next/navigation", () => navigationMocks);
vi.mock("next-intl/server", () => translationMocks);

beforeEach(() => {
  runtimeMocks.getRuntimeTryoutMetadata.mockReset();
  navigationMocks.notFound.mockClear();
  translationMocks.getTranslations.mockReset();
  translationMocks.getTranslations.mockResolvedValue(
    (key: string) => `translated:${key}`
  );
});

describe("try-out route metadata", () => {
  it("uses signed copy and exact localized canonical paths", async () => {
    runtimeMocks.getRuntimeTryoutMetadata.mockReturnValue(
      Effect.succeed({
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
          publicPath:
            "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
          title: "Quantitative Knowledge",
        },
      })
    );

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
  });

  it("uses the source registry and generic copy before activation", async () => {
    runtimeMocks.getRuntimeTryoutMetadata.mockReturnValue(
      Effect.succeed({ managed: false, route: null })
    );

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
  });

  it("returns the route-level 404 for an unknown hierarchy path", async () => {
    runtimeMocks.getRuntimeTryoutMetadata.mockReturnValue(
      Effect.succeed({ managed: true, route: null })
    );

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
    runtimeMocks.getRuntimeTryoutMetadata.mockReturnValue(
      Effect.succeed({ managed: false, route: null })
    );

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
