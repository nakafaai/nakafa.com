import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  type PageCatalogInput,
  resolveLegalLinks,
} from "@repo/backend/confect/emails/legal";
import {
  deferWelcomeIntent,
  toWelcomeIntentError,
} from "@repo/backend/confect/emails/welcome/impl";
import type { welcomeIntentInputValidator } from "@repo/backend/confect/emails/welcome/schema";
import { readSiteUrl } from "@repo/backend/confect/site/config";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { readPageCatalog } from "@repo/backend/content/publication/page";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect, flow } from "effect";

/** Resolves locale-exact legal and continuation links from signed content. */
export const resolveWelcomeEmailLinks = Effect.fn(
  "emails.welcome.resolveLinks"
)(function* (catalog: PageCatalogInput, locale: AppLocaleCode, siteUrl: URL) {
  const legal = yield* resolveLegalLinks(catalog, locale, siteUrl);
  return { continueUrl: new URL(`/${locale}/home`, siteUrl).href, ...legal };
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
