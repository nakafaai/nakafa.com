import { describe, expect, it } from "@effect/vitest";
import { canonicalizePublicPageProjection } from "@nakafa/aksara-contracts/projection/page";
import { resolveLegalLinks } from "@repo/backend/confect/emails/legal";
import { makeTestPageProjection } from "@repo/backend/test/content/page";
import { TEST_ARTICLE_PROJECTION_JSON } from "@repo/backend/test/content/runtime";
import { Array as Arr, Effect } from "effect";

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

/** The words that name one email: what a refusal shared by every email never says. */
const NAMES_AN_EMAIL = /welcome|invit/iu;

/** A catalog that holds the legal Pages of English alone. */
const englishOnly = {
  managed: true,
  projectionJson: [
    pageJson("en", "privacy-policy", "privacy-en"),
    pageJson("en", "terms-of-service", "terms-en"),
  ],
};

describe("emails/legal", () => {
  it.effect.each(["de", "en", "id"] as const)(
    "resolves exact %s links from signed Page projections",
    (locale) =>
      Effect.gen(function* () {
        const links = yield* resolveLegalLinks(
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
          privacyPolicyUrl: `https://nakafa.com/${locale}/privacy-${locale}`,
          termsOfServiceUrl: `https://nakafa.com/${locale}/terms-${locale}`,
        });
      })
  );

  it.effect("does not fall back to English legal pages", () =>
    Effect.gen(function* () {
      const error = yield* resolveLegalLinks(englishOnly, "de", SITE_URL).pipe(
        Effect.flip
      );

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
      const error = yield* resolveLegalLinks(catalog, "en", SITE_URL).pipe(
        Effect.flip
      );

      expect(error).toMatchObject({
        _tag: "ReleaseError",
        code: "CONTENT_RELEASE_INTEGRITY",
      });
    })
  );

  it.effect(
    "names no single email in what it refuses, because every email shares it",
    () =>
      Effect.gen(function* () {
        const refusals = yield* Effect.forEach(
          [
            resolveLegalLinks(
              { managed: false, projectionJson: [] },
              "en",
              SITE_URL
            ),
            resolveLegalLinks(
              { managed: true, projectionJson: [TEST_ARTICLE_PROJECTION_JSON] },
              "en",
              SITE_URL
            ),
            resolveLegalLinks(englishOnly, "de", SITE_URL),
          ],
          Effect.flip
        );

        expect(
          Arr.map(refusals, ({ message }) => NAMES_AN_EMAIL.test(message))
        ).toEqual(Arr.replicate(false, 3));
      })
  );
});
