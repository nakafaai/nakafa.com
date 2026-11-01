import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import type { NoticeMailsDoc } from "@repo/backend/confect/_generated/docs";
import emailsInternal from "@repo/backend/confect/_generated/refs/emails.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  ActionRunner,
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
  MutationRunner,
} from "@repo/backend/confect/_generated/services";
import { EMAIL_FROM, sendMail } from "@repo/backend/confect/emails/client";
import spec from "@repo/backend/confect/emails/digest/internal.spec";
import { resolveLegalLinks } from "@repo/backend/confect/emails/legal";
import { isLoginAddress } from "@repo/backend/confect/identity/address";
import { ACCOUNT_LOCALE } from "@repo/backend/confect/notifications/copy";
import {
  isAccountMail,
  isSchoolMail,
  MAIL_RANKS,
} from "@repo/backend/confect/notifications/mail";
import { readSiteUrl } from "@repo/backend/confect/site/config";
import { schoolAddress } from "@repo/backend/confect/tenancy/address";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { readPageCatalog } from "@repo/backend/content/publication/page";
import {
  type DigestEmailInput,
  SchoolChange,
} from "@repo/email/templates/digest/content";
import {
  Array as Arr,
  Clock,
  DateTime,
  Effect,
  Layer,
  Number as Num,
  Option,
} from "effect";

/**
 * The notice mails one day sends. Resend's free plan takes 100 emails a day, and these keep 20 for what is always sent,
 * an invitation, a sign-in code, a welcome, so a burst of notices never holds an invitation back.
 */
const DAILY_LIMIT = 80;

/** The mails one sweep claims, so one run stays within what one action renders. */
const SWEEP_MAILS = 40;

/** The rows one rank shows a sweep: more than it claims, since the rows of one recipient share a mail. */
const RANK_PAGE = 200;

/** The rows one mail counts. More than that wait for the next mail. */
const RECIPIENT_PAGE = 50;

/** The signed Pages a mail links to. */
type Catalog = Effect.Success<ReturnType<typeof readPageCatalog>>;

/** Takes a recipient's due rows off the queue, and keeps the ones that still tell something. */
const leaveQueue = Effect.fn("emails.digest.leave")(function* (
  rows: readonly NoticeMailsDoc[],
  now: number
) {
  const writer = yield* DatabaseWriter;
  yield* Effect.forEach(
    rows,
    (row) => writer.table("noticeMails").delete(row._id).pipe(Effect.orDie),
    { discard: true }
  );
  return Arr.filter(rows, (row) => row.expiresAt > now);
});

/** What one mail says: what it counts, the inbox it opens, and its language with that language's legal links. */
const inputOf = Effect.fn("emails.digest.input")(function* (
  counts: DigestEmailInput["counts"],
  inboxUrl: string,
  locale: DigestEmailInput["locale"],
  catalog: Catalog,
  siteUrl: URL
) {
  const links = yield* resolveLegalLinks(catalog, locale, siteUrl);
  return {
    counts,
    inboxUrl,
    locale,
    privacyPolicyUrl: links.privacyPolicyUrl,
    termsOfServiceUrl: links.termsOfServiceUrl,
  };
});

/**
 * One Person's mail: every row of theirs that is due leaves the queue, and what still tells something is counted by
 * kind. A recipient who left, has no real address, sits in an archived unit, or whose rows all expired gets none.
 */
const schoolMail = Effect.fn("emails.digest.school")(function* (
  personId: GenericId.GenericId<"tenantPeople">,
  now: number,
  catalog: Catalog,
  siteUrl: URL
) {
  const reader = yield* DatabaseReader;
  const rows = yield* reader
    .table("noticeMails")
    .index("by_recipientPersonId_and_dueAt", (query) =>
      query.eq("recipientPersonId", personId).lte("dueAt", now)
    )
    .take(RECIPIENT_PAGE)
    .pipe(Effect.orDie);
  const live = Arr.filter(yield* leaveQueue(rows, now), isSchoolMail);
  const person = yield* reader
    .table("tenantPeople")
    .get(personId)
    .pipe(Effect.orDie);
  if (
    !Arr.isReadonlyArrayNonEmpty(live) ||
    person.status !== "active" ||
    person.account.state !== "claimed"
  ) {
    return Option.none();
  }
  const user = yield* reader
    .table("users")
    .get(person.account.userId)
    .pipe(Effect.orDie);
  if (isLoginAddress(user.email)) {
    return Option.none();
  }
  const first = Arr.headNonEmpty(live);
  const unit = yield* reader
    .table("tenantUnits")
    .get(first.unitId)
    .pipe(Effect.orDie);
  if (unit.status !== "active") {
    return Option.none();
  }
  const tenant = yield* reader
    .table("tenants")
    .get(first.tenantId)
    .pipe(Effect.orDie);
  const school = yield* schoolAddress(siteUrl, tenant.slug);
  return Option.some({
    address: user.email,
    input: yield* inputOf(
      Arr.filter(
        Arr.map(SchoolChange.literals, (change) => ({
          change,
          count: Arr.filter(live, (row) => row.change === change).length,
        })),
        ({ count }) => count > 0
      ),
      new URL("/notifications", school).href,
      unit.contentLanguage,
      catalog,
      siteUrl
    ),
    key: `notice-mail/${personId}/${first._id}`,
  });
});

/**
 * One account's digest of the replies to its comments, which opens the Nakafa inbox in the language of an account. An
 * account that is gone, has no real address, or whose rows all expired gets none, and its rows still leave the queue.
 */
const accountMail = Effect.fn("emails.digest.account")(function* (
  userId: GenericId.GenericId<"users">,
  now: number,
  catalog: Catalog,
  siteUrl: URL
) {
  const reader = yield* DatabaseReader;
  const rows = yield* reader
    .table("noticeMails")
    .index("by_recipientUserId_and_dueAt", (query) =>
      query.eq("recipientUserId", userId).lte("dueAt", now)
    )
    .take(RECIPIENT_PAGE)
    .pipe(Effect.orDie);
  const live = yield* leaveQueue(rows, now);
  const user = yield* reader.table("users").get(userId).pipe(Effect.option);
  if (
    !Arr.isReadonlyArrayNonEmpty(live) ||
    Option.isNone(user) ||
    user.value.deletedAt !== undefined ||
    isLoginAddress(user.value.email)
  ) {
    return Option.none();
  }
  return Option.some({
    address: user.value.email,
    input: yield* inputOf(
      [{ change: "comment.replied", count: live.length }],
      new URL(`/${ACCOUNT_LOCALE}/notifications`, siteUrl).href,
      ACCOUNT_LOCALE,
      catalog,
      siteUrl
    ),
    key: `notice-mail/${userId}/${Arr.headNonEmpty(live)._id}`,
  });
});

/** The one recipient of a row: a Person of a school, or an account. */
const recipientOf = (row: NoticeMailsDoc) =>
  isAccountMail(row) ? row.recipientUserId : row.recipientPersonId;

/**
 * Takes the mails that are due off the queue, the ones that cannot wait first, as far as the day's limit reaches, and
 * counts them against it. What the limit leaves waits for the next sweep and the next day, so a burst queues and its
 * rows share a mail when it leaves (ADR 0027). An expired row leaves with no mail.
 */
const claim = FunctionImpl.make(
  databaseSchema,
  spec,
  "claim",
  Effect.fn("emails.digest.claim")(function* () {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const now = yield* Clock.currentTimeMillis;
    const day = DateTime.formatIsoDateUtc(DateTime.makeUnsafe(now));
    const budget = yield* reader
      .table("noticeMailBudget")
      .index("by_creation_time")
      .first()
      .pipe(Effect.orDie);
    const sent = Option.match(budget, {
      onNone: () => 0,
      onSome: (row) => (row.day === day ? row.sent : 0),
    });
    const room = Num.min(DAILY_LIMIT - sent, SWEEP_MAILS);
    const waiting = yield* Effect.forEach(MAIL_RANKS, (rank) =>
      reader
        .table("noticeMails")
        .index("by_rank_and_dueAt", (query) =>
          query.eq("rank", rank).lte("dueAt", now)
        )
        .take(RANK_PAGE)
        .pipe(Effect.orDie)
    );
    const recipients = Arr.take(
      Arr.dedupeWith(
        Arr.flatten(waiting),
        (self, that) => recipientOf(self) === recipientOf(that)
      ),
      room
    );
    if (!Arr.isReadonlyArrayNonEmpty(recipients)) {
      return [];
    }
    const siteUrl = yield* readSiteUrl();
    const catalog = yield* readPageCatalog().pipe(
      Effect.provide(publicationLayer)
    );
    const mails = Arr.getSomes(
      yield* Effect.forEach(recipients, (row) =>
        isAccountMail(row)
          ? accountMail(row.recipientUserId, now, catalog, siteUrl)
          : schoolMail(row.recipientPersonId, now, catalog, siteUrl)
      )
    );
    const spent = { day, sent: sent + mails.length };
    yield* Option.match(budget, {
      onNone: () => writer.table("noticeMailBudget").insert(spent),
      onSome: (row) => writer.table("noticeMailBudget").patch(row._id, spent),
    }).pipe(Effect.orDie);
    return mails;
  })
);

/** Hands rendered mails to the mail provider. The recipient and the first row are the idempotency key. */
const enqueue = FunctionImpl.make(
  databaseSchema,
  spec,
  "enqueue",
  Effect.fn("emails.digest.enqueue")(function* ({ messages }) {
    const ctx = yield* MutationCtx;
    yield* Effect.forEach(
      messages,
      ({ address, key, ...message }) =>
        sendMail(ctx, {
          ...message,
          from: EMAIL_FROM,
          idempotencyKey: key,
          to: address,
        }).pipe(Effect.orDie),
      { discard: true }
    );
    return null;
  })
);

/**
 * Sends what is due: it claims the mails, renders each in the Node runtime, and hands them over. A mail is a notice and
 * the inbox holds it either way, so a failed render fails this action, which Convex does not repeat, and sends nothing.
 */
const send = FunctionImpl.make(
  databaseSchema,
  spec,
  "send",
  Effect.fn("emails.digest.send")(function* () {
    const { runAction } = yield* ActionRunner;
    const { runMutation } = yield* MutationRunner;
    const mails = yield* runMutation(
      emailsInternal.digest.internal.claim,
      {}
    ).pipe(Effect.orDie);
    if (Arr.isReadonlyArrayEmpty(mails)) {
      return null;
    }
    const messages = yield* Effect.forEach(
      mails,
      ({ address, input, key }) =>
        runAction(emailsInternal.digest.delivery.render, input).pipe(
          Effect.map((message) => ({ ...message, address, key })),
          Effect.orDie
        ),
      { concurrency: 4 }
    );
    yield* runMutation(emailsInternal.digest.internal.enqueue, {
      messages,
    }).pipe(Effect.orDie);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(claim),
  Layer.provide(enqueue),
  Layer.provide(send),
  GroupImpl.finalize
);
