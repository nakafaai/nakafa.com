import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import {
  type PageKey,
  PageKeySchema,
  type PublicPageProjection,
} from "@nakafa/aksara-contracts/projection/page";
import type { ContentProjection } from "@nakafa/aksara-contracts/projection/spec";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import { readPageCatalog } from "@repo/backend/content/publication/page";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { decodeProjectionJson } from "@repo/backend/convex/contentRelease/parse";
import { appLocaleValidator } from "@repo/backend/convex/contentRelease/spec";
import {
  deferWelcomeIntent,
  tryWelcomeIntent,
} from "@repo/backend/convex/emails/welcome/impl";
import { siteOrigin } from "@repo/backend/convex/utils/site";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { Effect } from "effect";

const PRIVACY_POLICY_PAGE_KEY = PageKeySchema.make("privacy-policy");
const TERMS_OF_SERVICE_PAGE_KEY = PageKeySchema.make("terms-of-service");
const canonicalSiteUrl = new URL(siteOrigin);

interface PageCatalogInput {
  readonly managed: boolean;
  readonly projectionJson: readonly string[];
}

function findWelcomePage(
  projections: readonly ContentProjection[],
  locale: AppLocaleCode,
  pageKey: PageKey
): PublicPageProjection | undefined {
  return projections.find(
    (projection): projection is PublicPageProjection =>
      projection.kind === "public-page" &&
      projection.appLocale === locale &&
      projection.pageKey === pageKey
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
  if (projections.some((projection) => projection.kind !== "public-page")) {
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

export const welcomeIntentInputValidator = v.union(
  v.null(),
  v.object({
    continueUrl: v.string(),
    locale: appLocaleValidator,
    privacyPolicyUrl: v.string(),
    termsOfServiceUrl: v.string(),
  })
);

export type WelcomeIntentInput = Infer<typeof welcomeIntentInputValidator>;

/** Reads one scheduled intent and its signed locale-exact links. */
export const readWelcomeIntentInput = Effect.fn(
  "emails.welcome.readIntentInput"
)(function* (ctx: QueryCtx, intentId: Id<"welcomeEmailIntents">) {
  const intent = yield* tryWelcomeIntent(() => ctx.db.get(intentId));
  if (intent?.phase !== "scheduled") {
    return null;
  }

  const user = yield* tryWelcomeIntent(() => ctx.db.get(intent.userId));
  if (!user || user.deletedAt !== undefined) {
    return null;
  }
  if (user.deletionPreparedAt !== undefined) {
    return yield* deferWelcomeIntent();
  }

  const catalog = yield* readPageCatalog().pipe(
    Effect.provide(convexPublicationLayer(ctx))
  );
  const links = yield* resolveWelcomeEmailLinks(
    catalog,
    intent.locale,
    canonicalSiteUrl
  );

  return {
    locale: intent.locale,
    ...links,
  };
});
