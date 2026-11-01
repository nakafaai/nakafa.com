import type { GenericId } from "@confect/core";
import type {
  NoticeMailsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  ACCOUNT_TIME_ZONE,
  digestInstant,
} from "@repo/backend/confect/notifications/clock";
import { deliveriesOf } from "@repo/backend/confect/notifications/delivery";
import type {
  NoticeKind,
  Relation,
} from "@repo/backend/confect/notifications/rules";
import {
  accountSwitchedOff,
  switchedOff,
} from "@repo/backend/confect/notifications/switched";
import { SchoolChange } from "@repo/email/templates/digest/content";
import { namedTimeZone } from "@repo/utilities/timezone";
import {
  Array as Arr,
  Clock,
  DateTime,
  Duration,
  Effect,
  Option,
  Schema,
} from "effect";

/** What every waiting mail holds: when it is due, when it no longer tells anything, and its rank in the queue. */
const mailFields = {
  dueAt: Schema.Finite,
  expiresAt: Schema.Finite,
  rank: Schema.Int,
};

/**
 * One mail that waits: its recipient, the unit whose language and clock it follows, what it tells, when it is due, when
 * it no longer tells anything, and its rank, so a mail about an exam leaves ahead of a digest when the day's limit is
 * tight, or the digest of a reply, which goes to the account because a comment belongs to no school. It holds IDs and
 * codes only, because an email names no one (ADR 0027).
 */
export const noticeMailValidator = Schema.Union([
  Schema.Struct({
    ...mailFields,
    change: SchoolChange,
    recipientPersonId: Id("tenantPeople"),
    tenantId: Id("tenants"),
    unitId: Id("tenantUnits"),
  }),
  Schema.Struct({
    ...mailFields,
    change: Schema.Literal("comment.replied"),
    recipientUserId: Id("users"),
  }),
]);

/** A mail addressed to an account, which no school holds. */
type AccountMail = Extract<
  NoticeMailsDoc,
  { readonly change: "comment.replied" }
>;

/** A mail addressed to a Person of a school. */
type SchoolMail = Exclude<NoticeMailsDoc, AccountMail>;

/** Whether a mail is addressed to an account. */
export const isAccountMail = (row: NoticeMailsDoc): row is AccountMail =>
  row.change === "comment.replied";

/** Whether a mail is addressed to a Person of a school. */
export const isSchoolMail = (row: NoticeMailsDoc): row is SchoolMail =>
  !isAccountMail(row);

/** The notice mails counted for one UTC day. */
export const noticeMailBudgetValidator = Schema.Struct({
  day: Schema.String,
  sent: Schema.Int,
});

/** The ranks of the queue, first to leave first: what opens soon, what happened now, and the digest. */
export const MAIL_RANKS = [0, 1, 2];

/** How long a mail waits for room: a notice a week old tells nothing the inbox does not. */
const MAIL_LIFETIME = Duration.days(7);

/** The rank of a digest, the last to leave. */
const DIGEST_RANK = 2;

/** What one kind of mail tells, and its rank. */
const MailRoute = Schema.Struct({ change: SchoolChange, rank: Schema.Int });

/** What each kind that sends a school's email tells, and its rank. */
const MAIL_OF = {
  examGuardianReminder: { change: "exam.reminder", rank: 0 },
  examStart: { change: "exam.starting", rank: 0 },
  forumMention: { change: "forum.mentioned", rank: DIGEST_RANK },
  gradeReleased: { change: "grade.released", rank: 1 },
  taskMissed: { change: "assignment.missed", rank: 1 },
  taskPublished: { change: "assignment.published", rank: DIGEST_RANK },
} as const satisfies Partial<
  Record<typeof NoticeKind.Type, typeof MailRoute.Type>
>;

/**
 * Queues the mail of one notice for one recipient, when the rules give their relation an email (ADR 0027). A digest is
 * due at the next 17:00 on the clock of the unit, or at once in a unit whose zone is no named zone, and any other mail
 * at once. A mail with an anchor expires there,
 * because it says what is about to happen. A recipient without an account has no address, so nothing is queued.
 */
export const queueMail = Effect.fn("notifications.mail.queue")(function* (
  kind: keyof typeof MAIL_OF,
  relation: typeof Relation.Type,
  person: TenantPeopleDoc,
  unitId: GenericId.GenericId<"tenantUnits">,
  anchor: Option.Option<number>
) {
  const email = Arr.findFirst(
    deliveriesOf(kind, relation, false),
    (delivery) => delivery.channel === "email"
  );
  if (Option.isNone(email) || person.account.state !== "claimed") {
    return;
  }
  if (Option.isSome(yield* switchedOff(person._id, kind, "email"))) {
    return;
  }
  const now = yield* Clock.currentTimeMillis;
  const unit = yield* (yield* DatabaseReader)
    .table("tenantUnits")
    .get(unitId)
    .pipe(Effect.orDie);
  const zone = namedTimeZone(unit.timeZone);
  yield* (yield* DatabaseWriter)
    .table("noticeMails")
    .insert({
      ...MAIL_OF[kind],
      dueAt:
        email.value.timing._tag === "Digest" && Option.isSome(zone)
          ? DateTime.toEpochMillis(
              digestInstant(DateTime.makeUnsafe(now), zone.value)
            )
          : now,
      expiresAt: Option.getOrElse(
        anchor,
        () => now + Duration.toMillis(MAIL_LIFETIME)
      ),
      recipientPersonId: person._id,
      tenantId: person.tenantId,
      unitId,
    })
    .pipe(Effect.orDie);
});

/**
 * Queues the digest of one reply for the account whose comment it answers, unless the account switched that mail off
 * (ADR 0027). It is due at the next 17:00 on the clock of an account, and the sweep reads the address when it leaves, so
 * a school login leaves the queue with no mail.
 */
export const queueReplyMail = Effect.fn("notifications.mail.reply")(function* (
  userId: GenericId.GenericId<"users">
) {
  if (
    Option.isSome(yield* accountSwitchedOff(userId, "commentReply", "email"))
  ) {
    return;
  }
  const now = yield* Clock.currentTimeMillis;
  yield* (yield* DatabaseWriter)
    .table("noticeMails")
    .insert({
      change: "comment.replied",
      dueAt: DateTime.toEpochMillis(
        digestInstant(
          DateTime.makeUnsafe(now),
          DateTime.zoneMakeNamedUnsafe(ACCOUNT_TIME_ZONE)
        )
      ),
      expiresAt: now + Duration.toMillis(MAIL_LIFETIME),
      rank: DIGEST_RANK,
      recipientUserId: userId,
    })
    .pipe(Effect.orDie);
});
