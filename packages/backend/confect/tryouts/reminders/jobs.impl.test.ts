import resendTest from "@convex-dev/resend/test";
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DAILY_LIMIT } from "@repo/backend/confect/emails/budget";
import { resend } from "@repo/backend/confect/emails/client";
import { signedPages } from "@repo/backend/test/mail";
import {
  insertStartedAttempt,
  TRYOUT_NOW,
  type TryoutWorld,
  tryoutWorld,
} from "@repo/backend/test/tryout/world";
import { Array as Arr, DateTime, Duration, Effect } from "effect";

const { email, enqueueEmail, hour } = refs.internal.tryouts.reminders.jobs;
const HOUR = Duration.toMillis(Duration.hours(1));

/**
 * Starts the learner's attempt and its first section, and reads the job its reminders carry. A reminder reads no
 * question, so once the attempt has started, the active release becomes the one that signs the legal Pages every email links, and the
 * mail component is registered for the email to reach.
 */
const started = Effect.fn("test.reminders.started")(function* (
  world: TryoutWorld
) {
  const attemptId = yield* Effect.promise(() =>
    world.t.mutation((ctx) => insertStartedAttempt(ctx, world.userId))
  );
  yield* world.startSection(attemptId, "section-a");
  yield* Effect.promise(() =>
    world.t.run(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      assert.ok(state, "Expected the try-out world's content state.");
      await ctx.db.delete("contentState", state._id);
    })
  );
  yield* world.run(signedPages);
  resendTest.register(world.t);
  const attempt = yield* Effect.promise(() =>
    world.t.run((ctx) => ctx.db.get("tryoutAttempts", attemptId))
  );
  return {
    attemptId,
    expiresAt: attempt?.expiresAt ?? 0,
    setTitle: "Set 1",
  };
});

/** The rows and the scheduled jobs a world holds. */
const stored = (world: TryoutWorld) =>
  Effect.promise(() =>
    world.t.run(async (ctx) => ({
      jobs: Arr.map(
        await ctx.db.system.query("_scheduled_functions").collect(),
        ({ name, state }) => ({ name, state: state.kind })
      ),
      rows: await ctx.db.query("notifications").collect(),
    }))
  );

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TRYOUT_NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("tryouts/reminders/jobs", () => {
  it.effect(
    "schedules the email six hours and the inbox row an hour before a started attempt ends",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        yield* started(world);
        const { jobs } = yield* stored(world);
        expect(Arr.map(jobs, ({ name }) => name)).toEqual(
          expect.arrayContaining([
            "tryouts/reminders/jobs:email",
            "tryouts/reminders/jobs:hour",
          ])
        );
      })
  );

  it.effect(
    "writes the inbox row an hour before the end, which the learner's inbox shows with the set it opens, and nothing once the attempt ended",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const job = yield* started(world);
        vi.setSystemTime(job.expiresAt - HOUR);
        yield* world.internal.mutation(hour, job);
        const { rows } = yield* stored(world);
        expect(rows).toMatchObject([
          { attemptId: job.attemptId, changeType: "tryout.reminder" },
        ]);
        const inbox = yield* world.learner.query(
          refs.public.notifications.inbox.list,
          { paginationOpts: { cursor: null, numItems: 10 }, personal: true }
        );
        expect(inbox.page).toMatchObject([
          {
            changeType: "tryout.reminder",
            set: { setKey: "set-1" },
          },
        ]);
        yield* Effect.promise(() =>
          world.t.run((ctx) =>
            ctx.db.patch("tryoutAttempts", job.attemptId, {
              status: "completed",
            })
          )
        );
        yield* world.internal.mutation(hour, job);
        expect((yield* stored(world)).rows).toHaveLength(1);
      })
  );

  it.effect(
    "holds the hour's reminder to 07:00 in Jakarta when that is still before the end, and writes the row without a push when it is not",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        // An end at 11:00 the next morning in Jakarta, so 23:00 falls in quiet hours with time left after them.
        const job = {
          ...(yield* started(world)),
          expiresAt: Date.UTC(2026, 6, 10, 4, 0),
        };
        yield* Effect.promise(() =>
          world.t.run((ctx) =>
            ctx.db.patch("tryoutAttempts", job.attemptId, {
              expiresAt: job.expiresAt,
            })
          )
        );
        // 23:00 in Jakarta, more than eight hours before the end.
        vi.setSystemTime(
          DateTime.toEpochMillis(DateTime.makeUnsafe("2026-07-09T16:00:00Z"))
        );
        yield* world.internal.mutation(hour, job);
        const held = yield* stored(world);
        expect(held.rows).toEqual([]);
        expect(
          Arr.filter(
            held.jobs,
            ({ name, state }) =>
              name === "tryouts/reminders/jobs:hour" && state === "pending"
          ).length
        ).toBeGreaterThan(1);
        // Half an hour before an end at 23:30, quiet hours would hold the push past it, so only the row is written.
        const late = { ...job, expiresAt: Date.UTC(2026, 6, 9, 16, 30) };
        yield* Effect.promise(() =>
          world.t.run((ctx) =>
            ctx.db.patch("tryoutAttempts", job.attemptId, {
              expiresAt: late.expiresAt,
            })
          )
        );
        yield* world.internal.mutation(hour, late);
        expect((yield* stored(world)).rows).toHaveLength(1);
      })
  );

  it.effect(
    "emails an idle learner six hours before the end with the one-click unsubscribe, and counts each mail in the day's one row",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const job = yield* started(world);
        vi.setSystemTime(job.expiresAt - 6 * HOUR);
        const send = vi.spyOn(resend, "sendEmail");
        yield* world.internal.action(email, job);
        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0]?.[1]).toMatchObject({
          headers: [
            { name: "List-Unsubscribe" },
            { name: "List-Unsubscribe-Post" },
          ],
          idempotencyKey: `tryout-reminder/${job.attemptId}/${job.expiresAt}`,
          subject: expect.stringContaining("Set 1"),
        });
        const budget = yield* Effect.promise(() =>
          world.t.run((ctx) => ctx.db.query("noticeMailBudget").first())
        );
        expect(budget?.sent).toBe(1);
        yield* world.internal.mutation(enqueueEmail, {
          ...job,
          html: "<p>Lanjutkan</p>",
          subject: "6 jam lagi",
          text: "Lanjutkan",
          variant: "a",
        });
        const counted = yield* Effect.promise(() =>
          world.t.run((ctx) => ctx.db.query("noticeMailBudget").collect())
        );
        expect(counted).toMatchObject([{ sent: 2 }]);
      })
  );

  it.effect(
    "sends no email to a learner who answered within the hour, and none once the day's notice mails ran out until the next day",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const job = yield* started(world);
        const at = job.expiresAt - 6 * HOUR;
        vi.setSystemTime(at);
        const send = vi.spyOn(resend, "sendEmail");
        // An answer half an hour ago writes the section the learner works in.
        yield* Effect.promise(() =>
          world.t.run(async (ctx) => {
            const section = await ctx.db
              .query("tryoutSectionAttempts")
              .withIndex("by_tryoutAttemptId_and_sectionOrder", (query) =>
                query.eq("tryoutAttemptId", job.attemptId)
              )
              .first();
            assert.ok(section, "Expected the section the learner started.");
            await ctx.db.patch("tryoutSectionAttempts", section._id, {
              lastActivityAt: at - HOUR / 2,
            });
          })
        );
        yield* world.internal.action(email, job);
        expect(send).not.toHaveBeenCalled();
        yield* Effect.promise(() =>
          world.t.run((ctx) =>
            ctx.db.insert("noticeMailBudget", {
              day: DateTime.formatIsoDateUtc(DateTime.makeUnsafe(at)),
              sent: DAILY_LIMIT,
            })
          )
        );
        yield* world.internal.mutation(enqueueEmail, {
          ...job,
          html: "<p>Lanjutkan</p>",
          subject: "6 jam lagi",
          text: "Lanjutkan",
          variant: "a",
        });
        expect(send).not.toHaveBeenCalled();
        // The next day's first mail takes the row over.
        yield* Effect.promise(() =>
          world.t.run(async (ctx) => {
            const row = await ctx.db.query("noticeMailBudget").unique();
            assert.ok(row, "Expected the day's budget row.");
            await ctx.db.patch("noticeMailBudget", row._id, {
              day: DateTime.formatIsoDateUtc(
                DateTime.makeUnsafe(at - 24 * HOUR)
              ),
            });
          })
        );
        yield* world.internal.mutation(enqueueEmail, {
          ...job,
          html: "<p>Lanjutkan</p>",
          subject: "6 jam lagi",
          text: "Lanjutkan",
          variant: "a",
        });
        expect(send).toHaveBeenCalledTimes(1);
        const taken = yield* Effect.promise(() =>
          world.t.run((ctx) => ctx.db.query("noticeMailBudget").collect())
        );
        expect(taken).toMatchObject([
          { day: DateTime.formatIsoDateUtc(DateTime.makeUnsafe(at)), sent: 1 },
        ]);
      })
  );

  it.effect(
    "sends no email for an attempt in a language Nakafa does not serve yet",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const job = yield* started(world);
        vi.setSystemTime(job.expiresAt - 6 * HOUR);
        yield* Effect.promise(() =>
          world.t.run((ctx) =>
            ctx.db.patch("tryoutAttempts", job.attemptId, { appLocale: "ms" })
          )
        );
        const send = vi.spyOn(resend, "sendEmail");
        yield* world.internal.action(email, job);
        expect(send).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "sends no email to an account that switched it off, cannot be mailed, or is gone, nor for an attempt that ended",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const job = yield* started(world);
        vi.setSystemTime(job.expiresAt - 6 * HOUR);
        const send = vi.spyOn(resend, "sendEmail");
        const change = (write: Parameters<typeof world.t.run>[0]) =>
          Effect.promise(() => world.t.run(write));
        const off = yield* Effect.promise(() =>
          world.t.run((ctx) =>
            ctx.db.insert("noticePreferences", {
              channel: "email",
              kind: "tryoutReminder",
              userId: world.userId,
            })
          )
        );
        yield* world.internal.action(email, job);
        yield* change((ctx) => ctx.db.delete(off));
        yield* change((ctx) =>
          ctx.db.patch("users", world.userId, {
            email: "raka@login.nakafa.invalid",
          })
        );
        yield* world.internal.action(email, job);
        yield* change((ctx) =>
          ctx.db.patch("users", world.userId, { deletedAt: TRYOUT_NOW })
        );
        yield* world.internal.action(email, job);
        yield* change((ctx) => ctx.db.delete(world.userId));
        yield* world.internal.action(email, job);
        yield* change((ctx) =>
          ctx.db.patch("tryoutAttempts", job.attemptId, { status: "completed" })
        );
        yield* world.internal.action(email, job);
        yield* world.internal.mutation(enqueueEmail, {
          ...job,
          html: "<p>Lanjutkan</p>",
          subject: "6 jam lagi",
          text: "Lanjutkan",
          variant: "b",
        });
        expect(send).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "holds the email to 07:00 in Jakarta when quiet hours fall six hours before the end",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        // An end at 11:00 the next morning in Jakarta, so 23:00 falls in quiet hours with time left after them.
        const job = {
          ...(yield* started(world)),
          expiresAt: Date.UTC(2026, 6, 10, 4, 0),
        };
        yield* Effect.promise(() =>
          world.t.run((ctx) =>
            ctx.db.patch("tryoutAttempts", job.attemptId, {
              expiresAt: job.expiresAt,
            })
          )
        );
        vi.setSystemTime(Date.UTC(2026, 6, 9, 16, 0));
        const send = vi.spyOn(resend, "sendEmail");
        yield* world.internal.action(email, job);
        expect(send).not.toHaveBeenCalled();
        const { jobs } = yield* stored(world);
        expect(
          Arr.filter(
            jobs,
            ({ name, state }) =>
              name === "tryouts/reminders/jobs:email" && state === "pending"
          ).length
        ).toBeGreaterThan(1);
        // An end at 07:30 leaves no hour after quiet hours, so the email is not sent at all.
        const early = { ...job, expiresAt: Date.UTC(2026, 6, 10, 0, 30) };
        yield* Effect.promise(() =>
          world.t.run((ctx) =>
            ctx.db.patch("tryoutAttempts", job.attemptId, {
              expiresAt: early.expiresAt,
            })
          )
        );
        const before = (yield* stored(world)).jobs.length;
        yield* world.internal.action(email, early);
        expect((yield* stored(world)).jobs.length).toBe(before);
        expect(send).not.toHaveBeenCalled();
      })
  );
});
