import { FunctionImpl, GroupImpl } from "@confect/server";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import tryoutsInternal from "@repo/backend/confect/_generated/refs/tryouts.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  ActionRunner,
  DatabaseReader,
  MutationCtx,
  MutationRunner,
  QueryRunner,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { captureProductEvent } from "@repo/backend/confect/analytics/capture";
import {
  readMailBudget,
  spendMailBudget,
} from "@repo/backend/confect/emails/budget";
import { EMAIL_FROM, sendMail } from "@repo/backend/confect/emails/client";
import { resolveLegalLinks } from "@repo/backend/confect/emails/legal";
import {
  unsubscribePage,
  unsubscribePost,
} from "@repo/backend/confect/emails/unsubscribe/token";
import { isLoginAddress } from "@repo/backend/confect/identity/address";
import { noticeReminder } from "@repo/backend/confect/notifications/reminder";
import { TRYOUT_REMINDER_LEADS } from "@repo/backend/confect/notifications/rules";
import { accountSwitchedOff } from "@repo/backend/confect/notifications/switched";
import { readSiteUrl } from "@repo/backend/confect/site/config";
import spec from "@repo/backend/confect/tryouts/reminders/jobs.spec";
import {
  hoursLeft,
  lastActivityOf,
  REMINDER_IDLE,
  reminderTime,
  runningAttempt,
  variantOf,
} from "@repo/backend/confect/tryouts/reminders/timing";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { readPageCatalog } from "@repo/backend/content/publication/page";
import {
  Clock,
  DateTime,
  Duration,
  Effect,
  Layer,
  Option,
  Schema,
} from "effect";

/**
 * The reminder an hour before the attempt ends: the inbox row, at once, and its push, which keeps quiet from 21:00 to
 * 07:00. A push that quiet hours would hold until after the end is not sent, and the row still is; one held until
 * before the end runs this job again then, so the row and the push arrive together.
 */
const hour = FunctionImpl.make(
  databaseSchema,
  spec,
  "hour",
  Effect.fn("tryouts.reminders.hour")(function* (job) {
    const attempt = yield* runningAttempt(job);
    if (Option.isNone(attempt)) {
      return null;
    }
    const now = yield* Clock.currentTimeMillis;
    const time = reminderTime(now, job.expiresAt);
    if (time._tag === "At") {
      yield* (yield* Scheduler).runAt(
        DateTime.makeUnsafe(time.at),
        tryoutsInternal.reminders.jobs.hour,
        job
      );
      return null;
    }
    yield* noticeReminder(
      job.attemptId,
      attempt.value.userId,
      now,
      time._tag === "Now"
    );
    yield* captureProductEvent({
      distinctId: attempt.value.userId,
      event: {
        name: "tryout reminder sent",
        properties: {
          channel: "inbox",
          exam_key: attempt.value.examKey,
          hours_left: hoursLeft(job.expiresAt, now),
          set_key: attempt.value.setKey,
        },
      },
      timestamp: now,
    });
    return null;
  })
);

/**
 * What the email six hours before the end says, or why it waits or is not sent: a finished or replaced attempt, an
 * account that cannot be mailed or switched this email off, or a learner who answered within the hour gets none;
 * quiet hours hold it until 07:00 when that still leaves an hour before the end, and skip it otherwise.
 */
const readEmail = FunctionImpl.make(
  databaseSchema,
  spec,
  "readEmail",
  Effect.fn("tryouts.reminders.readEmail")(function* (job) {
    const skip = { _tag: "Skip" } as const;
    const attempt = yield* runningAttempt(job);
    if (Option.isNone(attempt)) {
      return skip;
    }
    // The email is written in the language the attempt runs in, so an attempt in a language Nakafa does not serve yet
    // gets none; once the language is served, the active locales hold it and its reminder goes out.
    const locale = attempt.value.appLocale;
    if (!Schema.is(ActiveAppLocaleCodeSchema)(locale)) {
      return skip;
    }
    const { userId } = attempt.value;
    const user = yield* (yield* DatabaseReader)
      .table("users")
      .get(userId)
      .pipe(Effect.option);
    if (
      Option.isNone(user) ||
      user.value.deletedAt !== undefined ||
      isLoginAddress(user.value.email) ||
      Option.isSome(
        yield* accountSwitchedOff(userId, "tryoutReminder", "email")
      )
    ) {
      return skip;
    }
    const now = yield* Clock.currentTimeMillis;
    if (
      (yield* lastActivityOf(attempt.value)) >
      now - Duration.toMillis(REMINDER_IDLE)
    ) {
      return skip;
    }
    const time = reminderTime(
      now,
      job.expiresAt - Duration.toMillis(TRYOUT_REMINDER_LEADS.hour)
    );
    if (time._tag !== "Now") {
      return time._tag === "At"
        ? ({ _tag: "Later", at: time.at } as const)
        : skip;
    }
    const siteUrl = yield* readSiteUrl();
    const legal = yield* resolveLegalLinks(
      yield* readPageCatalog().pipe(Effect.provide(publicationLayer)),
      locale,
      siteUrl
    );
    return {
      _tag: "Send",
      input: {
        continueUrl: new URL(
          `/${locale}/${attempt.value.setPublicPath}`,
          siteUrl
        ).href,
        hoursLeft: hoursLeft(job.expiresAt, now),
        locale,
        privacyPolicyUrl: legal.privacyPolicyUrl,
        setTitle: job.setTitle,
        termsOfServiceUrl: legal.termsOfServiceUrl,
        unsubscribeUrl: yield* unsubscribePage(
          { _tag: "Account", userId },
          locale
        ),
        variant: variantOf(job.attemptId),
      },
      userId,
    } as const;
  })
);

/**
 * Hands the rendered reminder to the mail provider when the attempt still runs and the day's notice mails leave room,
 * and counts it there. The attempt and its end name the message, so a retried job sends it once.
 */
const enqueueEmail = FunctionImpl.make(
  databaseSchema,
  spec,
  "enqueueEmail",
  Effect.fn("tryouts.reminders.enqueueEmail")(function* ({
    html,
    subject,
    text,
    variant,
    ...job
  }) {
    const attempt = yield* runningAttempt(job);
    const now = yield* Clock.currentTimeMillis;
    const budget = yield* readMailBudget(now);
    if (Option.isNone(attempt) || budget.left <= 0) {
      return null;
    }
    const { userId } = attempt.value;
    const user = yield* (yield* DatabaseReader)
      .table("users")
      .get(userId)
      .pipe(Effect.orDie);
    yield* sendMail(
      yield* MutationCtx,
      {
        from: EMAIL_FROM,
        html,
        idempotencyKey: `tryout-reminder/${job.attemptId}/${job.expiresAt}`,
        subject,
        text,
        to: user.email,
      },
      yield* unsubscribePost({ _tag: "Account", userId })
    ).pipe(Effect.orDie);
    yield* spendMailBudget(budget, 1);
    yield* captureProductEvent({
      distinctId: userId,
      event: {
        name: "tryout reminder sent",
        properties: {
          channel: "email",
          exam_key: attempt.value.examKey,
          hours_left: hoursLeft(job.expiresAt, now),
          set_key: attempt.value.setKey,
          variant,
        },
      },
      timestamp: now,
    });
    return null;
  })
);

/** Sends the email six hours before the end: it reads what to say, renders it in the Node runtime, and hands it over. */
const email = FunctionImpl.make(
  databaseSchema,
  spec,
  "email",
  Effect.fn("tryouts.reminders.email")(function* (job) {
    const decision = yield* (yield* QueryRunner)
      .runQuery(tryoutsInternal.reminders.jobs.readEmail, job)
      .pipe(Effect.orDie);
    if (decision._tag === "Skip") {
      return null;
    }
    if (decision._tag === "Later") {
      yield* (yield* Scheduler).runAt(
        DateTime.makeUnsafe(decision.at),
        tryoutsInternal.reminders.jobs.email,
        job
      );
      return null;
    }
    const message = yield* (yield* ActionRunner)
      .runAction(tryoutsInternal.reminders.delivery.render, decision.input)
      .pipe(Effect.orDie);
    yield* (yield* MutationRunner)
      .runMutation(tryoutsInternal.reminders.jobs.enqueueEmail, {
        ...job,
        ...message,
        variant: decision.input.variant,
      })
      .pipe(Effect.orDie);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(hour),
  Layer.provide(readEmail),
  Layer.provide(enqueueEmail),
  Layer.provide(email),
  GroupImpl.finalize
);
