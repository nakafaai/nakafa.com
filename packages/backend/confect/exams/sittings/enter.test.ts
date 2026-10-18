import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/editor";
import { archiveUnit } from "@repo/backend/test/exams";
import {
  attemptRow,
  CLOSES_AT as CLOSES,
  deviceOf,
  enterOk,
  entryOf,
  keyedExam,
  keyedSchool,
  OPENS_AT as OPENS,
  openedSitting,
  type SittingFixture,
  scheduleSitting,
  seedPlacement,
} from "@repo/backend/test/sittings";
import {
  suspend,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { changeToken, signal } = refs.public.exams.sittings;
const open = refs.internal.exams.sittings.timers.open;

const WRONG_TOKEN = "ZZZZZZ";

/**
 * The entry and the signal of an admitted student, once the sitting is locked. Both are
 * refused as a locked sitting.
 */
const refusedAsLocked = Effect.fn("test.sittings.refusedAsLocked")(function* (
  fixture: SittingFixture,
  made: { id: GenericId.GenericId<"examSittings">; token: string },
  attemptId: GenericId.GenericId<"examAttempts">
) {
  const entry = yield* entryOf(fixture, {
    deviceId: deviceOf(1),
    sittingId: made.id,
    token: made.token,
  }).pipe(Effect.flip);
  expect(entry).toMatchObject({ _tag: "SittingLocked" });
  const signalled = yield* fixture
    .as("student")
    .mutation(signal, {
      attemptId,
      deviceId: deviceOf(1),
      kind: "exit",
      slug: nf,
    })
    .pipe(Effect.flip);
  expect(signalled).toMatchObject({ _tag: "SittingLocked" });
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

  it.effect(
    "admits the device that owns an attempt without a token after the token changes, and refuses the old token on another device",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        yield* fixture
          .as("teacher")
          .mutation(changeToken, { sittingId: made.id, slug: nf });
        const again = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        expect(again).toEqual(entered);
        const other = yield* entryOf(fixture, {
          deviceId: deviceOf(2),
          sittingId: made.id,
          token: made.token,
        });
        expect(other).toEqual({ outcome: "refused", reason: "TokenRefused" });
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
    "refuses a sixth failed try of one student in a minute, even with the right token and a new device",
    () =>
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
          deviceId: deviceOf(9),
          sittingId: made.id,
          token: made.token,
        });
        expect(limited).toEqual({ outcome: "refused", reason: "TooManyTries" });
      })
  );

  it.effect(
    "refuses an entry and a signal in a suspended school, as a locked sitting",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        yield* fixture.run(suspend(fixture.tenants.nf));
        yield* refusedAsLocked(fixture, made, entered.attempt);
      })
  );

  it.effect(
    "refuses an entry and a signal in a sitting whose unit is archived, as a locked sitting",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        yield* fixture.run(archiveUnit(fixture.units.smp));
        yield* refusedAsLocked(fixture, made, entered.attempt);
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
