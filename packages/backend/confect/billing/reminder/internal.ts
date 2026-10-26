import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import { latestPersonalGrant } from "@repo/backend/confect/billing/grants";
import { EMAIL_FROM, sendMail } from "@repo/backend/confect/emails/client";
import { resolveLegalLinks } from "@repo/backend/confect/emails/legal";
import { isLoginAddress } from "@repo/backend/confect/identity/address";
import { readSiteUrl } from "@repo/backend/confect/site/config";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { readPageCatalog } from "@repo/backend/content/publication/page";
import { Clock, Effect, Option } from "effect";

/**
 * The learner a pass reminder still goes to: the owner of a running pass that
 * is still the last Pro they hold, so a later pass or a plan cancels it, with
 * an address mail reaches. A deleted, deleting or school-login account gets none.
 */
const readReminded = Effect.fn("billing.reminder.readReminded")(function* (
  grantId: Docs["billingGrants"]["_id"]
) {
  const reader = yield* DatabaseReader;
  const grant = yield* reader
    .table("billingGrants")
    .get(grantId)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIdFailure", () => Effect.succeedNone),
      Effect.orDie
    );
  if (
    Option.isNone(grant) ||
    grant.value.product !== "pro" ||
    grant.value.source.kind !== "pass"
  ) {
    return Option.none();
  }
  const now = yield* Clock.currentTimeMillis;
  const latest = yield* latestPersonalGrant(grant.value.userId, now);
  if (Option.isNone(latest) || latest.value._id !== grantId) {
    return Option.none();
  }
  const user = yield* reader
    .table("users")
    .get(grant.value.userId)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIdFailure", () => Effect.succeedNone),
      Effect.orDie
    );
  if (
    Option.isNone(user) ||
    isAccountDeletionPending(user.value) ||
    isLoginAddress(user.value.email)
  ) {
    return Option.none();
  }
  return Option.some({ endsAt: grant.value.validTo, email: user.value.email });
});

/**
 * What the reminder of one pass says, in the language the learner bought it in:
 * the moment it ends, the settings page that extends it, and the legal links of
 * that language. Nothing when the reminder no longer applies.
 */
export const readPassReminderInput = Effect.fn("billing.reminder.readInput")(
  function* (
    grantId: Docs["billingGrants"]["_id"],
    locale: ActiveAppLocaleCode
  ) {
    const reminded = yield* readReminded(grantId);
    if (Option.isNone(reminded)) {
      return null;
    }
    const siteUrl = yield* readSiteUrl();
    const catalog = yield* readPageCatalog().pipe(
      Effect.provide(publicationLayer)
    );
    const legal = yield* resolveLegalLinks(catalog, locale, siteUrl);
    return {
      endsAt: reminded.value.endsAt,
      extendUrl: new URL(`/${locale}/user/settings/subscriptions`, siteUrl)
        .href,
      locale,
      ...legal,
    };
  }
);

/**
 * Hands one rendered pass reminder to the mail provider. The pass names the
 * message, so a retried delivery sends it once, and a pass that was extended or
 * an account that went away since the render sends nothing.
 */
export const enqueuePassReminder = Effect.fn("billing.reminder.enqueue")(
  function* (
    grantId: Docs["billingGrants"]["_id"],
    message: {
      readonly html: string;
      readonly subject: string;
      readonly text: string;
    }
  ) {
    const reminded = yield* readReminded(grantId);
    if (Option.isNone(reminded)) {
      return null;
    }
    yield* sendMail(yield* MutationCtx, {
      ...message,
      from: EMAIL_FROM,
      idempotencyKey: `pass-reminder/${grantId}`,
      to: reminded.value.email,
    }).pipe(Effect.orDie);
    return null;
  }
);
