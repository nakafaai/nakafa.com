// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { getCachedSEOMetadata } from "@/lib/seo/cache";
import type { SEOContext } from "@/lib/seo/contract";

const generateSEOMetadataMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/seo/generator", () => ({
  /** Records the context and the locale that the metadata is built from. */
  generateSEOMetadata: generateSEOMetadataMock,
}));

const CONTEXT: SEOContext = {
  categoryLabel: "Belajar",
  data: { description: "Dasar", title: "Aljabar" },
  type: "article",
};

describe("seo metadata of a page", () => {
  it("builds the metadata of the page from its context and locale", async () => {
    generateSEOMetadataMock.mockReturnValue(
      Effect.succeed({ description: "Dasar", title: "Aljabar" })
    );

    await expect(getCachedSEOMetadata(CONTEXT, "id")).resolves.toEqual({
      description: "Dasar",
      title: "Aljabar",
    });
    expect(generateSEOMetadataMock).toHaveBeenCalledWith(CONTEXT, "id");
  });
});
