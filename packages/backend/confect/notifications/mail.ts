import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { digestInstant } from "@repo/backend/confect/notifications/clock";
import { deliveriesOf } from "@repo/backend/confect/notifications/delivery";
import type {
  NoticeKind,
  Relation,
} from "@repo/backend/confect/notifications/rules";
import { switchedOff } from "@repo/backend/confect/notifications/switched";
import { DigestChange } from "@repo/email/templates/digest/content";
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

/**
 * One mail that waits: its recipient, the unit whose language and clock it follows, what it tells, when it is due, when
 * it no longer tells anything, and its rank, so a mail about an exam leaves ahead of a digest when the day's limit is
 * tight. It holds IDs and codes only, because an email names no one (ADR 0027).
 */
export const noticeMailValidator = Schema.Struct({
  change: DigestChange,
  dueAt: Schema.Finite,
  expiresAt: Schema.Finite,
  rank: Schema.Int,
  recipientPersonId: Id("tenantPeople"),
  tenantId: Id("tenants"),
  unitId: Id("tenantUnits"),
});

/** The notice mails counted for one UTC day. */
export const noticeMailBudgetValidator = Schema.Struct({
  day: Schema.String,
  sent: Schema.Int,
});

/** The ranks of the queue, first to leave first: what opens soon, what happened now, and the digest. */
export const MAIL_RANKS = [0, 1, 2];

/** How long a mail waits for room: a notice a week old tells nothing the inbox does not. */
const MAIL_LIFETIME = Duration.days(7);

/** What each kind that sends email tells, and its rank. */
const MAIL_OF = {
  examGuardianReminder: { change: "exam.reminder", rank: 0 },
  examStart: { change: "exam.starting", rank: 0 },
  forumMention: { change: "forum.mentioned", rank: 2 },
  gradeReleased: { change: "grade.released", rank: 1 },
  taskMissed: { change: "assignment.missed", rank: 1 },
  taskPublished: { change: "assignment.published", rank: 2 },
} as const satisfies Partial<
  Record<
    typeof NoticeKind.Type,
    { readonly change: typeof DigestChange.Type; readonly rank: number }
  >
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
  unitId: typeof noticeMailValidator.Type.unitId,
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
