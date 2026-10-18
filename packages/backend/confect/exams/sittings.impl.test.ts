import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/editor";
import {
  admittedOf,
  attemptRow,
  CLOSES_AT as CLOSES,
  deviceOf,
  keyedExam,
  keyedSchool,
  mentions,
  OPENS_AT as OPENS,
  openedSitting,
  type SittingFixture,
  scheduleSitting,
  seedAttempt,
  seedPlacement,
  seedSignal,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { enter, signal, mine, dashboard } = refs.public.exams.sittings;
const open = refs.internal.exams.sittings.timers.open;

const WRONG_TOKEN = "ZZZZZZ";

/** One entry of a person into a sitting, with the device and token that the test gives. */
const entryOf = (
  fixture: SittingFixture,
  args: {
    deviceId: string;
    sittingId: GenericId.GenericId<"examSittings">;
    token: string;
  },
  actor: "student" | "teacher" | "deputy" = "student"
) => fixture.as(actor).mutation(enter, { ...args, slug: nf });

/** An entry that the test expects to admit, with the admitted reply narrowed. */
const enterOk = (
  fixture: SittingFixture,
  args: Parameters<typeof entryOf>[1],
  actor: "student" | "teacher" | "deputy" = "student"
) => entryOf(fixture, args, actor).pipe(Effect.flatMap(admittedOf));

/** One page of a sitting's dashboard, read by the teacher. */
const dashboardOf = (
  fixture: SittingFixture,
  sittingId: GenericId.GenericId<"examSittings">
) =>
  fixture.as("teacher").query(dashboard, {
    paginationOpts: { cursor: null, numItems: 10 },
    sittingId,
    slug: nf,
  });

describe("exams/sittings entry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "refuses an entry before the sitting opens, and admits the student after it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const made = yield* scheduleSitting(fixture, {
          closesAt: CLOSES,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS,
        });
        const early = yield* entryOf(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        }).pipe(Effect.flip);
        expect(early).toMatchObject({ _tag: "SittingNotOpen" });
        vi.setSystemTime(OPENS);
        yield* fixture.internal.mutation(open, { sittingId: made.id });
        const admitted = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        expect(admitted).toMatchObject({
          deadline: CLOSES,
          outcome: "admitted",
          state: "inProgress",
        });
        expect(yield* attemptRow(fixture, admitted.attempt)).toMatchObject({
          deadline: CLOSES,
          deviceId: deviceOf(1),
          retiredDeviceIds: [],
          startedAt: OPENS,
          state: "inProgress",
        });
      })
  );

  it.effect("accepts the token in lower case, with spaces at either end", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      const admitted = yield* enterOk(fixture, {
        deviceId: deviceOf(1),
        sittingId: made.id,
        token: `  ${made.token.toLowerCase()} `,
      });
      expect(admitted).toMatchObject({ outcome: "admitted" });
    })
  );

  it.effect(
    "refuses a wrong token as a value, and still admits the right one",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const refused = yield* entryOf(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: WRONG_TOKEN,
        });
        expect(refused).toEqual({ outcome: "refused", reason: "TokenRefused" });
        const admitted = yield* enterOk(fixture, {
          deviceId: deviceOf(2),
          sittingId: made.id,
          token: made.token,
        });
        expect(admitted).toMatchObject({ outcome: "admitted" });
      })
  );

  it.effect(
    "refuses an entry into a sitting that no longer exists, as not in the sitting",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("examSittings").delete(made.id)
          )
        );
        const failure = yield* entryOf(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        }).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "NotInSitting" });
      })
  );

  it.effect(
    "refuses a member who holds no student grant over the unit, as not in the sitting",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const failure = yield* entryOf(
          fixture,
          { deviceId: deviceOf(1), sittingId: made.id, token: made.token },
          "deputy"
        ).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "NotInSitting" });
      })
  );

  it.effect(
    "admits a placed student of a cohort sitting, and refuses a teacher who is not placed",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const cohortId = yield* seedPlacement(
          fixture,
          fixture.people.student.personId
        );
        const made = yield* scheduleSitting(fixture, {
          closesAt: CLOSES,
          examId,
          group: { cohortId, kind: "cohort" },
          opensAt: OPENS,
        });
        vi.setSystemTime(OPENS);
        yield* fixture.internal.mutation(open, { sittingId: made.id });
        const admitted = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        expect(admitted).toMatchObject({ outcome: "admitted" });
        const outside = yield* entryOf(
          fixture,
          { deviceId: deviceOf(2), sittingId: made.id, token: made.token },
          "teacher"
        ).pipe(Effect.flip);
        expect(outside).toMatchObject({ _tag: "NotInSitting" });
      })
  );

  it.effect(
    "binds a device on first entry, lets it enter again, and refuses another device",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const first = yield* entryOf(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        const again = yield* entryOf(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        expect(again).toEqual(first);
        const second = yield* entryOf(fixture, {
          deviceId: deviceOf(2),
          sittingId: made.id,
          token: made.token,
        }).pipe(Effect.flip);
        expect(second).toMatchObject({ _tag: "SecondDevice" });
      })
  );

  it.effect("refuses a sixth try from one device in a minute, as a value", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      for (let index = 0; index < 5; index += 1) {
        yield* entryOf(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: WRONG_TOKEN,
        });
      }
      const limited = yield* entryOf(fixture, {
        deviceId: deviceOf(1),
        sittingId: made.id,
        token: made.token,
      });
      expect(limited).toEqual({ outcome: "refused", reason: "TooManyTries" });
    })
  );

  it.effect(
    "refuses every try of a sitting after sixty failed tries in a minute",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        for (let index = 0; index < 60; index += 1) {
          yield* entryOf(fixture, {
            deviceId: deviceOf(100 + index),
            sittingId: made.id,
            token: WRONG_TOKEN,
          });
        }
        const limited = yield* entryOf(fixture, {
          deviceId: deviceOf(999),
          sittingId: made.id,
          token: made.token,
        });
        expect(limited).toEqual({ outcome: "refused", reason: "TooManyTries" });
      })
  );

  it.effect(
    "refuses a new entry once the sitting has reached its closing time",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        vi.setSystemTime(CLOSES);
        const failure = yield* entryOf(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        }).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "SittingClosed" });
      })
  );

  it.effect(
    "refuses a student's own attempt once its deadline has passed, as closed",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        yield* entryOf(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        vi.setSystemTime(CLOSES);
        const failure = yield* entryOf(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        }).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "AttemptClosed" });
      })
  );
});

describe("exams/sittings signals and reads", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "records the student's own signal, and the dashboard shows the student as away",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        yield* fixture.as("student").mutation(signal, {
          attemptId: entered.attempt,
          deviceId: deviceOf(1),
          kind: "exit",
          slug: nf,
        });
        const page = yield* dashboardOf(fixture, made.id);
        expect(page.attempts.page).toMatchObject([
          {
            away: true,
            latestSignal: { kind: "exit" },
            mascot: expect.anything(),
            name: "Student",
            state: "inProgress",
          },
        ]);
        expect(mentions(page, made.token)).toBe(false);
      })
  );

  it.effect(
    "refuses a signal from a device that does not own the attempt, and from another member",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        const otherDevice = yield* fixture
          .as("student")
          .mutation(signal, {
            attemptId: entered.attempt,
            deviceId: deviceOf(2),
            kind: "blur",
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(otherDevice).toMatchObject({ _tag: "SecondDevice" });
        const otherMember = yield* fixture
          .as("teacher")
          .mutation(signal, {
            attemptId: entered.attempt,
            deviceId: deviceOf(1),
            kind: "blur",
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(otherMember).toMatchObject({ _tag: "NotInSitting" });
      })
  );

  it.effect("lists a student's open unit sittings, and no token", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      const listed = yield* fixture.as("student").query(mine, { slug: nf });
      expect(listed).toMatchObject([
        { id: made.id, room: "Lab 2", state: "open" },
      ]);
      expect(mentions(listed, made.token)).toBe(false);
      expect(yield* fixture.as("teacher").query(mine, { slug: nf })).toEqual(
        []
      );
    })
  );

  it.effect(
    "lists the cohort sitting of a placed student while it is scheduled",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const cohortId = yield* seedPlacement(
          fixture,
          fixture.people.student.personId
        );
        const made = yield* scheduleSitting(fixture, {
          closesAt: CLOSES,
          examId,
          group: { cohortId, kind: "cohort" },
          opensAt: OPENS,
        });
        const listed = yield* fixture.as("student").query(mine, { slug: nf });
        expect(listed).toMatchObject([
          { id: made.id, cohortId, state: "scheduled" },
        ]);
      })
  );

  it.effect(
    "shows an unclaimed person's attempt with no animal and no signal",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        yield* seedAttempt(fixture, {
          deadline: CLOSES,
          deviceId: null,
          person: fixture.invited,
          sittingId: made.id,
          state: "locked",
        });
        const page = yield* dashboardOf(fixture, made.id);
        expect(page.attempts.isDone).toBe(true);
        expect(page.attempts.page).toMatchObject([
          {
            away: false,
            latestSignal: null,
            mascot: null,
            name: "Invited",
            state: "locked",
          },
        ]);
      })
  );

  it.effect(
    "keeps the latest signal of an attempt and shows the student back",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        yield* seedSignal(fixture, {
          at: OPENS + 1000,
          attemptId: entered.attempt,
          kind: "disconnect",
        });
        yield* seedSignal(fixture, {
          at: OPENS + 2000,
          attemptId: entered.attempt,
          kind: "return",
        });
        const page = yield* dashboardOf(fixture, made.id);
        expect(page.attempts.page).toMatchObject([
          { away: false, latestSignal: { kind: "return" } },
        ]);
      })
  );

  it.effect(
    "refuses the dashboard to a student, who holds no sitting view",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const failure = yield* fixture
          .as("student")
          .query(dashboard, {
            paginationOpts: { cursor: null, numItems: 10 },
            sittingId: made.id,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "AccessDenied", reason: "role" });
      })
  );
});
