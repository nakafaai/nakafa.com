// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Effect, Option, Schema } from "effect";
import { getPublishedPageCatalog } from "@/lib/content/page/catalog";
import { getCurrentPublishedPage } from "@/lib/content/page/published";
import {
  LegalPageInput,
  readLegalPageHandler,
} from "@/lib/content/page/read.fn";
import { testPageProjection } from "@/test/content-page";

process.env.VITE_CONVEX_URL = "https://example.convex.cloud";

/** The signed page that the published reader answers in the current test. */
let signedPage: typeof testPageProjection | null = null;

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.com/en/privacy-policy"),
}));

vi.mock("@/lib/content/page/published", () => ({
  getCurrentPublishedPage: vi.fn(() =>
    Promise.resolve(signedPage === null ? null : { projection: signedPage })
  ),
}));

vi.mock("@/lib/content/page/catalog", () => ({
  getPublishedPageCatalog: vi.fn(() => Promise.resolve({ projections: [] })),
  verifyPublishedPageCatalog: vi.fn(() => Effect.succeed([])),
}));

describe("legal page input", () => {
  it("decodes a locale that the contracts name", () => {
    const decode = Schema.decodeUnknownOption(LegalPageInput);
    expect(
      Option.isSome(decode({ locale: "en", publicPath: "privacy-policy" }))
    ).toBe(true);
    expect(
      Option.isNone(decode({ locale: "fr", publicPath: "privacy-policy" }))
    ).toBe(true);
  });
});

describe("legal page head facts", () => {
  it("answers no page for a path that the contracts refuse", async () => {
    signedPage = testPageProjection;
    await expect(
      readLegalPageHandler({ data: { locale: "en", publicPath: "" } })
    ).resolves.toBeNull();
    expect(getCurrentPublishedPage).not.toHaveBeenCalled();
  });

  it("answers no page when no signed page answers the path", async () => {
    signedPage = null;
    await expect(
      readLegalPageHandler({
        data: { locale: "en", publicPath: "privacy-policy" },
      })
    ).resolves.toBeNull();
    expect(getPublishedPageCatalog).not.toHaveBeenCalled();
  });

  it("returns the title, the description and the alternates of a signed page", async () => {
    signedPage = testPageProjection;
    const facts = await readLegalPageHandler({
      data: { locale: "en", publicPath: "privacy-policy" },
    });
    expect(getCurrentPublishedPage).toHaveBeenCalledWith({
      appLocale: "en",
      publicPath: "privacy-policy",
    });
    expect(facts).toStrictEqual({
      alternates: expect.any(Object),
      description: testPageProjection.metadata.description,
      title: testPageProjection.metadata.title,
    });
  });
});
