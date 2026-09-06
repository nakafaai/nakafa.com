// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { getCachedLlmsSectionIndexText } from "@/lib/llms/index/cache";

const mockApplyContentCache = vi.hoisted(() => vi.fn());
const mockGetLlmsSectionIndexText = vi.hoisted(() => vi.fn());

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud" },
}));
vi.mock("@/lib/content/cache", () => ({
  applyContentCache: mockApplyContentCache,
}));
vi.mock("@/lib/llms/index/generate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/llms/index/generate")>()),
  getLlmsSectionIndexText: mockGetLlmsSectionIndexText,
}));

beforeEach(() => {
  mockApplyContentCache.mockReset();
  mockGetLlmsSectionIndexText.mockReset();
});

describe("LLMS index cache", () => {
  it.effect("applies the content cache without changing generated output", () =>
    Effect.gen(function* () {
      mockGetLlmsSectionIndexText.mockReturnValue(
        Effect.succeed("# Nakafa English Content")
      );

      const text = yield* Effect.promise(() =>
        getCachedLlmsSectionIndexText({ cleanSlug: "llms/en" })
      );

      expect(text).toBe("# Nakafa English Content");
      expect(mockApplyContentCache).toHaveBeenCalledExactlyOnceWith(
        "article",
        "material",
        "page",
        "quran"
      );
      expect(mockGetLlmsSectionIndexText).toHaveBeenCalledExactlyOnceWith(
        "llms/en"
      );
    })
  );

  it.effect.each([
    ["llms/en/articles/politics", "article"],
    ["llms/de/material/page/0/llms.txt", "material"],
    ["llms/id/quran", "quran"],
    ["llms/en/site", "page"],
  ])(
    "invalidates %s only when its owning scope changes",
    ([cleanSlug, scope]) =>
      Effect.gen(function* () {
        mockGetLlmsSectionIndexText.mockReturnValue(Effect.succeed("section"));
        expect(
          yield* Effect.promise(() =>
            getCachedLlmsSectionIndexText({ cleanSlug })
          )
        ).toBe("section");
        expect(mockApplyContentCache).toHaveBeenCalledExactlyOnceWith(scope);
      })
  );

  it.effect.each(["articles/en", "llms/fr", "llms/en/unsupported"])(
    "does not read publication sources for unsupported index %s",
    (cleanSlug) =>
      Effect.gen(function* () {
        expect(
          yield* Effect.promise(() =>
            getCachedLlmsSectionIndexText({ cleanSlug })
          )
        ).toBeNull();
        expect(mockApplyContentCache).not.toHaveBeenCalled();
        expect(mockGetLlmsSectionIndexText).not.toHaveBeenCalled();
      })
  );
});
