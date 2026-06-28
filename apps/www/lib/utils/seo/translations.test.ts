import { Cause, Effect, Exit, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchSEOTranslationsNamespace,
  SEOTranslationLoadError,
} from "@/lib/utils/seo/translations";

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

  it("preserves thrown Error messages in the typed failure channel", async () => {
    mockGetTranslations.mockRejectedValue(new Error("dictionary unavailable"));

    const exit = await Effect.runPromiseExit(
      fetchSEOTranslationsNamespace("en", "SEO")
    );
    const failure = Exit.isFailure(exit)
      ? Cause.failureOption(exit.cause)
      : Option.none();

    expect(Option.isSome(failure)).toBe(true);
    if (Option.isSome(failure)) {
      expect(failure.value).toBeInstanceOf(SEOTranslationLoadError);
      expect(failure.value).toMatchObject({
        _tag: "SEOTranslationLoadError",
        locale: "en",
        message: "Failed to load SEO translations: dictionary unavailable",
        namespace: "SEO",
      });
    }
  });
});
