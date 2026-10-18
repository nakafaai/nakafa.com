import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import type { ReasonCode } from "@repo/backend/confect/exams/sittings/schema";
import { nf } from "@repo/backend/test/editor";
import {
  admittedOf,
  attemptRow,
  CLOSES_AT,
  deviceOf,
  jobStateOf,
  openedSitting,
  type SittingFixture,
  sittingRow,
} from "@repo/backend/test/sittings";
import {
  journal,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { enter, signal, lock, unlock, addMinutes, allowDevice, changeToken } =
  refs.public.exams.sittings;

/** The reason of a lock in these tests: one of the six codes. */
const RULE_BREAK: typeof ReasonCode.Type = "rule-break";
const timers = refs.internal.exams.sittings.timers;

/** A minute, in milliseconds, as the proctor's added minutes count it. */
const MINUTE = 60_000;

/** The student's entry with a device and the sitting's token, which may refuse. */
const enterWith = (
  fixture: SittingFixture,
  args: {
    device: number;
    sittingId: GenericId.GenericId<"examSittings">;
    token: string;
  }
) =>
  fixture.as("student").mutation(enter, {
    deviceId: deviceOf(args.device),
    sittingId: args.sittingId,
    slug: nf,
    token: args.token,
  });

/** An entry that the test expects to admit, with the admitted reply narrowed. */
const enterAdmitted = (
  fixture: SittingFixture,
  args: Parameters<typeof enterWith>[1]
) => enterWith(fixture, args).pipe(Effect.flatMap(admittedOf));

/** The change types of the journal, in the order they were written. */
const changesOf = (fixture: SittingFixture) =>
  Effect.map(fixture.run(journal), (entries) =>
    Arr.map(entries, (entry) => entry.change)
  );

describe("exams/sittings proctor actions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "locks an attempt with its reason, lets it enter while locked, and unlocks it before its deadline",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterAdmitted(fixture, {
          device: 1,
          sittingId: made.id,
          token: made.token,
        });
        yield* fixture.as("teacher").mutation(lock, {
          attemptId: entered.attempt,
          reason: "rule-break",
          sittingId: made.id,
          slug: nf,
        });
        expect(yield* attemptRow(fixture, entered.attempt)).toMatchObject({
          state: "locked",
        });
        expect(
          yield* enterWith(fixture, {
            device: 1,
            sittingId: made.id,
            token: made.token,
          })
        ).toMatchObject({ outcome: "admitted", state: "locked" });
        yield* fixture.as("teacher").mutation(unlock, {
          attemptId: entered.attempt,
          reason: "device-problem",
          sittingId: made.id,
          slug: nf,
        });
        expect(yield* attemptRow(fixture, entered.attempt)).toMatchObject({
          deadline: CLOSES_AT,
          state: "inProgress",
        });
        expect(yield* changesOf(fixture)).toContainEqual({
          attempt: entered.attempt,
          reason: "rule-break",
          type: "sitting.lock",
        });
        expect(yield* changesOf(fixture)).toContainEqual({
          attempt: entered.attempt,
          reason: "device-problem",
          type: "sitting.unlock",
        });
      })
  );

  it.effect(
    "accepts a lock on a locked attempt with no change, and records it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterAdmitted(fixture, {
          device: 1,
          sittingId: made.id,
          token: made.token,
        });
        const teacher = fixture.as("teacher");
        const lockArgs = {
          attemptId: entered.attempt,
          reason: RULE_BREAK,
          sittingId: made.id,
          slug: nf,
        };
        yield* teacher.mutation(lock, lockArgs);
        yield* teacher.mutation(lock, lockArgs);
        expect(yield* attemptRow(fixture, entered.attempt)).toMatchObject({
          state: "locked",
        });
        const locks = Arr.filter(
          yield* changesOf(fixture),
          (change) => change.type === "sitting.lock"
        );
        expect(locks).toHaveLength(2);
      })
  );

  it.effect("refuses an unlock on an attempt in progress by its state", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      const entered = yield* enterAdmitted(fixture, {
        device: 1,
        sittingId: made.id,
        token: made.token,
      });
      const refused = yield* fixture
        .as("teacher")
        .mutation(unlock, {
          attemptId: entered.attempt,
          reason: "device-problem",
          sittingId: made.id,
          slug: nf,
        })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({
        _tag: "ProctorActionRefused",
        action: "unlock",
        reason: "state",
        state: "inProgress",
      });
    })
  );

  it.effect(
    "adds minutes to one attempt's deadline, and never to the sitting's closing time",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterAdmitted(fixture, {
          device: 1,
          sittingId: made.id,
          token: made.token,
        });
        const teacher = fixture.as("teacher");
        yield* teacher.mutation(addMinutes, {
          attemptId: entered.attempt,
          minutes: 15,
          reason: "power-outage",
          sittingId: made.id,
          slug: nf,
        });
        const firstJob = (yield* attemptRow(fixture, entered.attempt)).closeJob;
        yield* teacher.mutation(addMinutes, {
          attemptId: entered.attempt,
          minutes: 5,
          reason: "power-outage",
          sittingId: made.id,
          slug: nf,
        });
        const secondJob = (yield* attemptRow(fixture, entered.attempt))
          .closeJob;
        if (firstJob === undefined || secondJob === undefined) {
          return yield* Effect.die("each added minutes must schedule a close");
        }
        expect(yield* jobStateOf(fixture, firstJob)).toBe("canceled");
        expect(yield* jobStateOf(fixture, secondJob)).toBe("pending");
        expect(yield* attemptRow(fixture, entered.attempt)).toMatchObject({
          deadline: CLOSES_AT + 20 * MINUTE,
          state: "inProgress",
        });
        expect(yield* sittingRow(fixture, made.id)).toMatchObject({
          closesAt: CLOSES_AT,
        });
        expect(yield* changesOf(fixture)).toContainEqual({
          attempt: entered.attempt,
          minutes: 5,
          reason: "power-outage",
          type: "sitting.addMinutes",
        });
      })
  );

  it.effect(
    "refuses added minutes once the attempt's deadline has passed, by the deadline",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterAdmitted(fixture, {
          device: 1,
          sittingId: made.id,
          token: made.token,
        });
        vi.setSystemTime(CLOSES_AT);
        const refused = yield* fixture
          .as("teacher")
          .mutation(addMinutes, {
            attemptId: entered.attempt,
            minutes: 5,
            reason: "power-outage",
            sittingId: made.id,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "ProctorActionRefused",
          reason: "deadline",
        });
      })
  );

  it.effect(
    "refuses added minutes above 120, and leaves the deadline and the close job as they were",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterAdmitted(fixture, {
          device: 1,
          sittingId: made.id,
          token: made.token,
        });
        const teacher = fixture.as("teacher");
        yield* teacher.mutation(addMinutes, {
          attemptId: entered.attempt,
          minutes: 1,
          reason: "power-outage",
          sittingId: made.id,
          slug: nf,
        });
        const before = yield* attemptRow(fixture, entered.attempt);
        expect(before.closeJob).toBeDefined();
        const refused = yield* teacher
          .mutation(addMinutes, {
            attemptId: entered.attempt,
            minutes: 121,
            reason: "power-outage",
            sittingId: made.id,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "SchemaError" });
        expect(yield* attemptRow(fixture, entered.attempt)).toMatchObject({
          closeJob: before.closeJob,
          deadline: before.deadline,
        });
      })
  );

  it.effect(
    "moves a locked attempt to closing once its deadline has passed, and schedules its submission",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterAdmitted(fixture, {
          device: 1,
          sittingId: made.id,
          token: made.token,
        });
        const teacher = fixture.as("teacher");
        yield* teacher.mutation(lock, {
          attemptId: entered.attempt,
          reason: "rule-break",
          sittingId: made.id,
          slug: nf,
        });
        vi.setSystemTime(CLOSES_AT + 1);
        yield* teacher.mutation(unlock, {
          attemptId: entered.attempt,
          reason: "device-problem",
          sittingId: made.id,
          slug: nf,
        });
        expect(yield* attemptRow(fixture, entered.attempt)).toMatchObject({
          state: "closing",
        });
        vi.setSystemTime(CLOSES_AT + 75_000);
        yield* fixture.internal.mutation(timers.submit, {
          attemptId: entered.attempt,
        });
        expect(yield* attemptRow(fixture, entered.attempt)).toMatchObject({
          state: "submitted",
          submittedAt: CLOSES_AT + 75_000,
        });
      })
  );

  it.effect(
    "changes the token, which stops the old one at once and admits the new one",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const changed = yield* fixture.as("teacher").mutation(changeToken, {
          sittingId: made.id,
          slug: nf,
        });
        expect(changed.token).not.toBe(made.token);
        expect(
          yield* enterWith(fixture, {
            device: 1,
            sittingId: made.id,
            token: made.token,
          })
        ).toEqual({ outcome: "refused", reason: "TokenRefused" });
        expect(
          yield* enterWith(fixture, {
            device: 1,
            sittingId: made.id,
            token: changed.token,
          })
        ).toMatchObject({ outcome: "admitted" });
        expect(yield* changesOf(fixture)).toContainEqual({
          type: "sitting.changeToken",
        });
      })
  );

  it.effect(
    "retires the earlier device, which then writes nothing, and binds the next device that enters",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterAdmitted(fixture, {
          device: 1,
          sittingId: made.id,
          token: made.token,
        });
        yield* fixture.as("teacher").mutation(allowDevice, {
          attemptId: entered.attempt,
          sittingId: made.id,
          slug: nf,
        });
        expect(yield* attemptRow(fixture, entered.attempt)).toMatchObject({
          deviceId: null,
          retiredDeviceIds: [deviceOf(1)],
        });
        // The retired device resumes without the token, as a reload does, and is refused as
        // retired rather than as a wrong token.
        const retired = yield* enterWith(fixture, {
          device: 1,
          sittingId: made.id,
          token: "",
        }).pipe(Effect.flip);
        expect(retired).toMatchObject({ _tag: "DeviceRetired" });
        const signalFromRetired = yield* fixture
          .as("student")
          .mutation(signal, {
            attemptId: entered.attempt,
            deviceId: deviceOf(1),
            kind: "exit",
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(signalFromRetired).toMatchObject({ _tag: "DeviceRetired" });
        expect(
          yield* enterWith(fixture, {
            device: 2,
            sittingId: made.id,
            token: made.token,
          })
        ).toMatchObject({ outcome: "admitted" });
        expect(yield* attemptRow(fixture, entered.attempt)).toMatchObject({
          deviceId: deviceOf(2),
        });
        expect(yield* changesOf(fixture)).toContainEqual({
          attempt: entered.attempt,
          type: "sitting.allowDevice",
        });
      })
  );

  it.effect(
    "refuses a proctor's allowance after the attempt has retired ten devices",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterAdmitted(fixture, {
          device: 1,
          sittingId: made.id,
          token: made.token,
        });
        const teacher = fixture.as("teacher");
        for (let round = 1; round <= 10; round += 1) {
          yield* teacher.mutation(allowDevice, {
            attemptId: entered.attempt,
            sittingId: made.id,
            slug: nf,
          });
          yield* enterWith(fixture, {
            device: round + 1,
            sittingId: made.id,
            token: made.token,
          });
        }
        const full = yield* teacher
          .mutation(allowDevice, {
            attemptId: entered.attempt,
            sittingId: made.id,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(full).toMatchObject({ _tag: "RetiredDevicesFull" });
      })
  );

  it.effect(
    "allows a second device on an attempt that no device holds, and keeps the retired devices",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterAdmitted(fixture, {
          device: 1,
          sittingId: made.id,
          token: made.token,
        });
        const teacher = fixture.as("teacher");
        yield* teacher.mutation(allowDevice, {
          attemptId: entered.attempt,
          sittingId: made.id,
          slug: nf,
        });
        yield* teacher.mutation(allowDevice, {
          attemptId: entered.attempt,
          sittingId: made.id,
          slug: nf,
        });
        expect(yield* attemptRow(fixture, entered.attempt)).toMatchObject({
          deviceId: null,
          retiredDeviceIds: [deviceOf(1)],
        });
        const allowances = Arr.filter(
          yield* changesOf(fixture),
          (change) => change.type === "sitting.allowDevice"
        );
        expect(allowances).toHaveLength(2);
      })
  );
});
