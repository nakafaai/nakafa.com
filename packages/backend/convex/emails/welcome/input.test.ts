import { describe, expect, it } from "@effect/vitest";
import { canonicalizePublicPageProjection } from "@nakafa/aksara-contracts/projection/page";
import { resolveWelcomeEmailLinks } from "@repo/backend/convex/emails/welcome/input";
import { makeTestPageProjection } from "@repo/backend/test/content/page";
import { TEST_ARTICLE_PROJECTION_JSON } from "@repo/backend/test/content/runtime";
import { Effect } from "effect";

const SITE_URL = new URL("https://nakafa.com");

function pageJson(
  locale: "de" | "en" | "id",
  pageKey: string,
  publicPath: string
) {
  return canonicalizePublicPageProjection(
    makeTestPageProjection(locale, pageKey, publicPath)
  );
}

describe("emails/welcome/input", () => {
  it.effect.each(["de", "en", "id"] as const)(
    "resolves exact %s links from signed Page projections",
    (locale) =>
      Effect.gen(function* () {
        const links = yield* resolveWelcomeEmailLinks(
          {
            managed: true,
            projectionJson: [
              pageJson(locale, "privacy-policy", `privacy-${locale}`),
              pageJson(locale, "terms-of-service", `terms-${locale}`),
            ],
          },
          locale,
          SITE_URL
        );

        expect(links).toEqual({
          continueUrl: `https://nakafa.com/${locale}/home`,
          privacyPolicyUrl: `https://nakafa.com/${locale}/privacy-${locale}`,
          termsOfServiceUrl: `https://nakafa.com/${locale}/terms-${locale}`,
        });
      })
  );

  it.effect("does not fall back to English legal pages", () =>
    Effect.gen(function* () {
      const error = yield* resolveWelcomeEmailLinks(
        {
          managed: true,
          projectionJson: [
            pageJson("en", "privacy-policy", "privacy-en"),
            pageJson("en", "terms-of-service", "terms-en"),
          ],
        },
        "de",
        SITE_URL
      ).pipe(Effect.flip);

      expect(error).toMatchObject({
        _tag: "ReleaseError",
        code: "CONTENT_RELEASE_INTEGRITY",
      });
    })
  );

  it.effect.each([
    ["an unmanaged catalog", { managed: false, projectionJson: [] }],
    ["a malformed projection", { managed: true, projectionJson: ["bad"] }],
    [
      "a non-Page projection",
      { managed: true, projectionJson: [TEST_ARTICLE_PROJECTION_JSON] },
    ],
  ] as const)("rejects %s", ([, catalog]) =>
    Effect.gen(function* () {
      const error = yield* resolveWelcomeEmailLinks(
        catalog,
        "en",
        SITE_URL
      ).pipe(Effect.flip);

      expect(error).toMatchObject({
        _tag: "ReleaseError",
        code: "CONTENT_RELEASE_INTEGRITY",
      });
    })
  );
});
