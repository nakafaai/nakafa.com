import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";
import {
  fetchSEOTranslationsNamespace,
  SEOTranslationLoadError,
} from "@/lib/seo/translations";

const { mockGetTranslations } = vi.hoisted(() => ({
  mockGetTranslations: vi.fn(),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: mockGetTranslations,
}));
describe("fetchSEOTranslationsNamespace", () => {
  beforeEach(() => {
    mockGetTranslations.mockReset();
  });
  it.effect(
    "preserves thrown Error messages in the typed failure channel",
    () =>
      Effect.gen(function* () {
        mockGetTranslations.mockRejectedValue(
          new Error("dictionary unavailable")
        );
        const failure = yield* fetchSEOTranslationsNamespace("en", "SEO").pipe(
          Effect.flip
        );

        expect(failure).toBeInstanceOf(SEOTranslationLoadError);
        expect(failure).toMatchObject({
          _tag: "SEOTranslationLoadError",
          locale: "en",
          message: "Failed to load SEO translations: dictionary unavailable",
          namespace: "SEO",
        });
      })
  );
});
