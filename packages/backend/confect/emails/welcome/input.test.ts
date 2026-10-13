import { describe, expect, it } from "@effect/vitest";
import { canonicalizePublicPageProjection } from "@nakafa/aksara-contracts/projection/page";
import { resolveWelcomeEmailLinks } from "@repo/backend/confect/emails/welcome/input";
import { makeTestPageProjection } from "@repo/backend/test/content/page";
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
    "adds the %s continue link to the legal links of the signed Pages",
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
});
