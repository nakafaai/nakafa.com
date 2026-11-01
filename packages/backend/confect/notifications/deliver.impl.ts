import { FunctionImpl, GroupImpl } from "@confect/server";
import type { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import notificationsInternal from "@repo/backend/confect/_generated/refs/notifications.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { pushSentence } from "@repo/backend/confect/notifications/copy";
import spec from "@repo/backend/confect/notifications/deliver.spec";
import {
  isAccountRow,
  type SchoolRow,
} from "@repo/backend/confect/notifications/schema";
import { SUBSCRIPTION_LIMIT } from "@repo/backend/confect/notifications/subscription";
import { sendPush } from "@repo/backend/confect/notifications/webpush";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { FetchClient } from "@repo/utilities/http/client";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Clock, Config, Effect, Layer, Option } from "effect";

/** The language of a row with no school: an account keeps none, and Nakafa's learners are Indonesian. */
const ACCOUNT_LOCALE: typeof AppLocaleCodeSchema.Type = "id";

/** The account behind a school row's Person, once the Person has claimed one. */
const claimedAccount = Effect.fn("notifications.deliver.account")(function* (
  row: SchoolRow
) {
  const person = yield* (yield* DatabaseReader)
    .table("tenantPeople")
    .get(row.recipientPersonId)
    .pipe(Effect.orDie);
  return person.account.state === "claimed"
    ? Option.some(person.account.userId)
    : Option.none();
});

/** The language of a school row's push: the language its school teaches in, or Indonesian. */
const schoolLocale = Effect.fn("notifications.deliver.locale")(function* (
  row: SchoolRow
) {
  const unit = yield* (yield* DatabaseReader)
    .table("tenantUnits")
    .index("by_tenantId_and_status", (query) =>
      query.eq("tenantId", row.tenantId).eq("status", "active")
    )
    .first()
    .pipe(Effect.orDie);
  return Option.match(unit, {
    onNone: () => ACCOUNT_LOCALE,
    onSome: (found) => found.contentLanguage,
  });
});

/**
 * What the push of one row sends, and to which browsers: none for a row that is
 * gone or read already, whose recipient holds no account, or whose account has
 * no browser subscribed. The payload carries the row's id, a general title and
 * sentence in the language of the row's school unit, or Indonesian for a row of
 * the account itself, and the inbox to open (ADR 0026).
 */
const notice = FunctionImpl.make(
  databaseSchema,
  spec,
  "notice",
  Effect.fn("notifications.deliver.notice")(function* ({ notificationId }) {
    const reader = yield* DatabaseReader;
    const row = yield* reader
      .table("notifications")
      .get(notificationId)
      .pipe(Effect.option);
    if (Option.isNone(row) || row.value.readAt !== undefined) {
      return null;
    }
    const account = isAccountRow(row.value)
      ? Option.some(row.value.recipientUserId)
      : yield* claimedAccount(row.value);
    if (Option.isNone(account)) {
      return null;
    }
    const targets = yield* reader
      .table("pushSubscriptions")
      .index("by_userId", (query) => query.eq("userId", account.value))
      .take(SUBSCRIPTION_LIMIT)
      .pipe(Effect.orDie);
    if (Arr.isReadonlyArrayEmpty(targets)) {
      return null;
    }
    const locale = isAccountRow(row.value)
      ? ACCOUNT_LOCALE
      : yield* schoolLocale(row.value);
    return {
      payload: encodeJsonText({
        body: pushSentence(row.value.changeType, locale),
        id: row.value._id,
        title: "Nakafa",
        url: `${SITE_ORIGIN}/${locale}/notifications`,
      }),
      targets: Arr.map(targets, (target) => ({
        auth: target.auth,
        endpoint: target.endpoint,
        p256dh: target.p256dh,
      })),
    };
  })
);

/** Forgets a subscription whose push service said it is gone (RFC 8030 section 7.3). */
const forget = FunctionImpl.make(
  databaseSchema,
  spec,
  "forget",
  Effect.fn("notifications.deliver.forget")(function* ({ endpoint }) {
    const found = yield* (yield* DatabaseReader)
      .table("pushSubscriptions")
      .index("by_endpoint", (query) => query.eq("endpoint", endpoint))
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(found)) {
      yield* (yield* DatabaseWriter)
        .table("pushSubscriptions")
        .delete(found.value._id)
        .pipe(Effect.orDie);
    }
    return null;
  })
);

/** The operator's VAPID keys, or none while push is not set up on this deployment. */
const vapidKeys = Config.option(
  Config.all({
    privateKey: Config.Redacted("WEB_PUSH_PRIVATE_KEY"),
    publicKey: Config.String("WEB_PUSH_PUBLIC_KEY"),
    subject: Config.String("WEB_PUSH_SUBJECT"),
  })
);

/**
 * Sends the push of one row to each browser of its recipient, once each. A
 * deployment without VAPID keys sends nothing, and a push that fails is logged
 * and dropped: push is best effort, and the inbox holds the notice (ADR 0027).
 */
const send = FunctionImpl.make(
  databaseSchema,
  spec,
  "send",
  Effect.fn("notifications.deliver.send")(function* ({ notificationId }) {
    const keys = yield* vapidKeys.pipe(Effect.orDie);
    if (Option.isNone(keys)) {
      return null;
    }
    const { runQuery } = yield* QueryRunner;
    const { runMutation } = yield* MutationRunner;
    const found = yield* runQuery(notificationsInternal.deliver.notice, {
      notificationId,
    }).pipe(Effect.orDie);
    if (found === null) {
      return null;
    }
    const nowSeconds = Math.floor((yield* Clock.currentTimeMillis) / 1000);
    yield* Effect.forEach(
      found.targets,
      (target) =>
        sendPush(target, found.payload, keys.value, nowSeconds).pipe(
          Effect.flatMap((outcome) =>
            outcome === "gone"
              ? runMutation(notificationsInternal.deliver.forget, {
                  endpoint: target.endpoint,
                }).pipe(Effect.orDie)
              : Effect.void
          ),
          Effect.catchTag("PushFailed", (failure) =>
            Effect.logWarning("A push was not delivered.", {
              reason: failure.reason,
              status: failure.status,
            })
          )
        ),
      { discard: true }
    );
    return null;
  }, Effect.provide(FetchClient))
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(notice),
  Layer.provide(forget),
  Layer.provide(send),
  GroupImpl.finalize
);
