import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import {
  type PageKey,
  PageKeySchema,
  type PublicPageProjection,
} from "@nakafa/aksara-contracts/projection/page";
import type { ContentProjection } from "@nakafa/aksara-contracts/projection/spec";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { pageCatalogValidator } from "@repo/backend/confect/contentRelease/page.spec";
import { decodeProjectionJson } from "@repo/backend/confect/contentRelease/parse";
import { Array as Arr, Effect, Option, Schema } from "effect";

const PRIVACY_POLICY_PAGE_KEY = PageKeySchema.make("privacy-policy");
const TERMS_OF_SERVICE_PAGE_KEY = PageKeySchema.make("terms-of-service");
const PageCatalogInputSchema = Schema.Struct({
  managed: pageCatalogValidator.fields.managed,
  projectionJson: Schema.Array(Schema.String),
});
export type PageCatalogInput = typeof PageCatalogInputSchema.Type;
function findPage(
  projections: readonly ContentProjection[],
  locale: AppLocaleCode,
  pageKey: PageKey
): PublicPageProjection | undefined {
  return Option.getOrUndefined(
    Arr.findFirst(
      projections,
      (projection): projection is PublicPageProjection =>
        projection.kind === "public-page" &&
        projection.appLocale === locale &&
        projection.pageKey === pageKey
    )
  );
}

/**
 * Resolves the privacy policy and terms of service links of one language from
 * the signed Pages. Every Nakafa email carries these two links in its footer,
 * so no email owns the resolver and no language falls back to another.
 */
export const resolveLegalLinks = Effect.fn("emails.legal.resolveLinks")(
  function* (catalog: PageCatalogInput, locale: AppLocaleCode, siteUrl: URL) {
    if (!catalog.managed) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "An email requires an active signed Page catalog."
      );
    }
    const projections = yield* Effect.forEach(
      catalog.projectionJson,
      decodeProjectionJson
    );
    if (
      Arr.some(projections, (projection) => projection.kind !== "public-page")
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "The Page catalog of an email contains a non-Page projection."
      );
    }
    const privacyPolicy = findPage(
      projections,
      locale,
      PRIVACY_POLICY_PAGE_KEY
    );
    const termsOfService = findPage(
      projections,
      locale,
      TERMS_OF_SERVICE_PAGE_KEY
    );
    if (!(privacyPolicy && termsOfService)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `An email requires ${locale} privacy policy and terms of service Pages.`
      );
    }
    return {
      privacyPolicyUrl: new URL(
        `/${privacyPolicy.appLocale}/${privacyPolicy.publicPath}`,
        siteUrl
      ).href,
      termsOfServiceUrl: new URL(
        `/${termsOfService.appLocale}/${termsOfService.publicPath}`,
        siteUrl
      ).href,
    };
  }
);
