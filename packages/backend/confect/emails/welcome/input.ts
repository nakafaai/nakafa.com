import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import {
  type PageKey,
  PageKeySchema,
  type PublicPageProjection,
} from "@nakafa/aksara-contracts/projection/page";
import type { ContentProjection } from "@nakafa/aksara-contracts/projection/spec";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { decodeProjectionJson } from "@repo/backend/confect/contentRelease/parse";
import {
  deferWelcomeIntent,
  toWelcomeIntentError,
} from "@repo/backend/confect/emails/welcome/impl";
import type { welcomeIntentInputValidator } from "@repo/backend/confect/emails/welcome/schema";
import { readSiteUrl } from "@repo/backend/confect/site/config";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { readPageCatalog } from "@repo/backend/content/publication/page";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect, flow, Option } from "effect";

const PRIVACY_POLICY_PAGE_KEY = PageKeySchema.make("privacy-policy");
const TERMS_OF_SERVICE_PAGE_KEY = PageKeySchema.make("terms-of-service");
interface PageCatalogInput {
  readonly managed: boolean;
  readonly projectionJson: readonly string[];
}
function findWelcomePage(
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

/** Resolves locale-exact legal and continuation links from signed content. */
export const resolveWelcomeEmailLinks = Effect.fn(
  "emails.welcome.resolveLinks"
)(function* (catalog: PageCatalogInput, locale: AppLocaleCode, siteUrl: URL) {
  if (!catalog.managed) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Welcome email requires an active signed Page catalog."
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
      "Welcome email Page catalog contains a non-Page projection."
    );
  }
  const privacyPolicy = findWelcomePage(
    projections,
    locale,
    PRIVACY_POLICY_PAGE_KEY
  );
  const termsOfService = findWelcomePage(
    projections,
    locale,
    TERMS_OF_SERVICE_PAGE_KEY
  );
  if (!(privacyPolicy && termsOfService)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Welcome email requires ${locale} privacy policy and terms of service Pages.`
    );
  }
  return {
    continueUrl: new URL(`/${locale}/home`, siteUrl).href,
    privacyPolicyUrl: new URL(
      `/${privacyPolicy.appLocale}/${privacyPolicy.publicPath}`,
      siteUrl
    ).href,
    termsOfServiceUrl: new URL(
      `/${termsOfService.appLocale}/${termsOfService.publicPath}`,
      siteUrl
    ).href,
  };
});
export type WelcomeIntentInput = typeof welcomeIntentInputValidator.Type;

/** Reads one scheduled intent and its signed locale-exact links. */
export const readWelcomeIntentInput = Effect.fn(
  "emails.welcome.readIntentInput"
)(
  function* (intentId: Id<"welcomeEmailIntents">) {
    const database = yield* DatabaseReader;
    const intent = yield* database
      .table("welcomeEmailIntents")
      .get(intentId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (intent?.phase !== "scheduled") {
      return null;
    }
    const user = yield* database
      .table("users")
      .get(intent.userId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!user || user.deletedAt !== undefined) {
      return null;
    }
    if (user.deletionPreparedAt !== undefined) {
      return yield* deferWelcomeIntent();
    }
    const catalog = yield* readPageCatalog().pipe(
      Effect.provide(publicationLayer)
    );
    const links = yield* resolveWelcomeEmailLinks(
      catalog,
      intent.locale,
      yield* readSiteUrl()
    );
    return {
      locale: intent.locale,
      ...links,
    };
  },
  Effect.catchDefect(flow(toWelcomeIntentError, Effect.fail))
);
