import { vEmailId } from "@convex-dev/resend";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  type PageKey,
  PageKeySchema,
  type PublicPageProjection,
} from "@nakafa/aksara-contracts/projection/page";
import type { ContentProjection } from "@nakafa/aksara-contracts/projection/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { readPageCatalog } from "@repo/backend/convex/contentRelease/page/catalog";
import { decodeProjectionJson } from "@repo/backend/convex/contentRelease/parse";
import { resend } from "@repo/backend/convex/emails/client";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { siteOrigin } from "@repo/backend/convex/utils/site";
import { type Infer, v } from "convex/values";
import { Effect, Schema } from "effect";

const WELCOME_LOCALE = AppLocaleSchema.make("en");
const PRIVACY_POLICY_PAGE_KEY = PageKeySchema.make("privacy-policy");
const TERMS_OF_SERVICE_PAGE_KEY = PageKeySchema.make("terms-of-service");
const WELCOME_EMAIL_SUBJECT = "Welcome to Nakafa";
const canonicalSiteUrl = new URL(siteOrigin);

interface PageCatalogInput {
  readonly managed: boolean;
  readonly projectionJson: readonly string[];
}

/** Typed failure for durable welcome-email delivery. */
export class WelcomeEmailDeliveryError extends Schema.TaggedError<WelcomeEmailDeliveryError>()(
  "WelcomeEmailDeliveryError",
  {
    code: Schema.Literal("WELCOME_EMAIL_DELIVERY_FAILED"),
    message: Schema.String,
  }
) {}

function findWelcomePage(
  projections: readonly ContentProjection[],
  pageKey: PageKey
): PublicPageProjection | undefined {
  return projections.find(
    (projection): projection is PublicPageProjection =>
      projection.kind === "public-page" &&
      projection.appLocale === WELCOME_LOCALE &&
      projection.pageKey === pageKey
  );
}

/** Resolves welcome links from the authenticated active Page catalog. */
export const resolveWelcomeEmailLinks = Effect.fn(
  "emails.welcome.resolveLinks"
)(function* (catalog: PageCatalogInput, siteUrl: URL) {
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

  const privacyPolicy = findWelcomePage(projections, PRIVACY_POLICY_PAGE_KEY);
  const termsOfService = findWelcomePage(
    projections,
    TERMS_OF_SERVICE_PAGE_KEY
  );
  if (!(privacyPolicy && termsOfService)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Welcome email requires English privacy policy and terms of service Pages."
    );
  }

  return {
    privacyPolicyUrl: new URL(
      `/${privacyPolicy.appLocale}/${privacyPolicy.publicPath}`,
      siteUrl
    ).href,
    startLearningUrl: new URL(`/${WELCOME_LOCALE}`, siteUrl).href,
    termsOfServiceUrl: new URL(
      `/${termsOfService.appLocale}/${termsOfService.publicPath}`,
      siteUrl
    ).href,
  };
});

/** Reads one current recipient and its signed legal links for Node rendering. */
const readWelcomeEmailInputProgram = Effect.fn("emails.welcome.readInput")(
  function* (ctx: QueryCtx, userId: Id<"users">) {
    const user = yield* Effect.promise(() => ctx.db.get("users", userId));
    if (!user || isAccountDeletionPending(user)) {
      return null;
    }

    const catalog = yield* readPageCatalog(ctx);
    const links = yield* resolveWelcomeEmailLinks(catalog, canonicalSiteUrl);
    return {
      email: user.email,
      name: user.name,
      ...links,
    };
  }
);

export const welcomeEmailInputValidator = v.union(
  v.null(),
  v.object({
    email: v.string(),
    name: v.string(),
    privacyPolicyUrl: v.string(),
    startLearningUrl: v.string(),
    termsOfServiceUrl: v.string(),
  })
);
export type WelcomeEmailInput = Infer<typeof welcomeEmailInputValidator>;

export const readWelcomeEmailInput = internalQuery({
  args: { userId: vv.id("users") },
  returns: welcomeEmailInputValidator,
  handler: (ctx, { userId }) =>
    runConvexProgram(readWelcomeEmailInputProgram(ctx, userId)),
});

/** Queues one rendered welcome email and stores its cancellation handle atomically. */
const enqueueWelcomeEmailProgram = Effect.fn("emails.welcome.enqueue")(
  function* (
    ctx: MutationCtx,
    args: {
      readonly html: string;
      readonly text: string;
      readonly userId: Id<"users">;
    }
  ) {
    const user = yield* Effect.promise(() => ctx.db.get("users", args.userId));
    if (!user || isAccountDeletionPending(user)) {
      return null;
    }

    const welcomeEmailId = yield* Effect.tryPromise({
      catch: () =>
        new WelcomeEmailDeliveryError({
          code: "WELCOME_EMAIL_DELIVERY_FAILED",
          message: "Unable to enqueue the welcome email.",
        }),
      try: () =>
        resend.sendEmail(ctx, {
          from: "Nakafa <nakafa@notifications.nakafa.com>",
          html: args.html,
          subject: WELCOME_EMAIL_SUBJECT,
          text: args.text,
          to: user.email,
        }),
    });
    yield* Effect.promise(() =>
      ctx.db.patch("users", user._id, { welcomeEmailId })
    );
    return welcomeEmailId;
  }
);

export const enqueueWelcomeEmail = internalMutation({
  args: {
    html: v.string(),
    text: v.string(),
    userId: vv.id("users"),
  },
  returns: v.union(v.null(), vEmailId),
  handler: (ctx, args) =>
    runConvexProgram(enqueueWelcomeEmailProgram(ctx, args)),
});
