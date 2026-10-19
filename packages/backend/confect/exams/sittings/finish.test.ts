import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/editor";
import {
  attemptRow,
  CLOSES_AT as CLOSES,
  deviceOf,
  enterOk,
  jobStateOf,
  OPENS_AT as OPENS,
  openedSitting,
  type SittingFixture,
} from "@repo/backend/test/sittings";
import {
  suspend,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { addMinutes, allowDevice, finish, lock } = refs.public.exams.sittings;

/** The journal's most recent entries, read in creation order. */
const journal = (fixture: SittingFixture) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("journalEntries")
        .index("by_creation_time")
        .take(100)
        .pipe(Effect.orDie)
    )
  );

/** The journal's entries of one change type. */
const entriesOf = (fixture: SittingFixture, type: string) =>
  Effect.map(journal(fixture), (entries) =>
    Arr.filter(entries, (entry) => entry.change.type === type)
  );

/** The student's Finish of its sitting, from one device. */
const finishAs = (
  fixture: SittingFixture,
  sittingId: GenericId.GenericId<"examSittings">,
  deviceId: string
) => fixture.as("student").mutation(finish, { deviceId, sittingId, slug: nf });

describe("exams/sittings finish", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "submits the attempt at the student's Finish, and journals it under the student's Person",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        yield* finishAs(fixture, made.id, deviceOf(1));
        const row = yield* attemptRow(fixture, entered.attempt);
        expect(row).toMatchObject({ state: "submitted", submittedAt: OPENS });
        expect(yield* entriesOf(fixture, "sitting.finish")).toMatchObject([
          { actor: { kind: "person" }, change: { attempt: entered.attempt } },
        ]);
      })
  );

  it.effect("answers a second Finish the same, and changes nothing", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      const entered = yield* enterOk(fixture, {
        deviceId: deviceOf(1),
        sittingId: made.id,
        token: made.token,
      });
      yield* finishAs(fixture, made.id, deviceOf(1));
      const first = yield* attemptRow(fixture, entered.attempt);
      vi.setSystemTime(CLOSES);
      yield* finishAs(fixture, made.id, deviceOf(1));
      expect(yield* attemptRow(fixture, entered.attempt)).toEqual(first);
      expect(yield* entriesOf(fixture, "sitting.finish")).toHaveLength(1);
    })
  );

  it.effect(
    "cancels the pending close of an attempt whose time was added, when the student finishes",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        yield* fixture.as("teacher").mutation(addMinutes, {
          attemptId: entered.attempt,
          minutes: 5,
          reason: "power-outage",
          sittingId: made.id,
          slug: nf,
        });
        const { closeJob } = yield* attemptRow(fixture, entered.attempt);
        if (closeJob === undefined) {
          return yield* Effect.die("the added minutes schedule a close");
        }
        yield* finishAs(fixture, made.id, deviceOf(1));
        expect(yield* jobStateOf(fixture, closeJob)).toBe("canceled");
      })
  );

  it.effect(
    "refuses a Finish from a device that does not own the attempt",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        yield* enterOk(fixture, {
          deviceId: deviceOf(1),
          sittingId: made.id,
          token: made.token,
        });
        const failure = yield* finishAs(fixture, made.id, deviceOf(2)).pipe(
          Effect.flip
        );
        expect(failure).toMatchObject({ _tag: "SecondDevice" });
      })
  );

  it.effect("refuses a Finish from a device that a proctor retired", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      const entered = yield* enterOk(fixture, {
        deviceId: deviceOf(1),
        sittingId: made.id,
        token: made.token,
      });
      yield* fixture.as("teacher").mutation(allowDevice, {
        attemptId: entered.attempt,
        sittingId: made.id,
        slug: nf,
      });
      const failure = yield* finishAs(fixture, made.id, deviceOf(1)).pipe(
        Effect.flip
      );
      expect(failure).toMatchObject({ _tag: "DeviceRetired" });
    })
  );

  it.effect("refuses a Finish of a locked attempt with the lock", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      const entered = yield* enterOk(fixture, {
        deviceId: deviceOf(1),
        sittingId: made.id,
        token: made.token,
      });
      yield* fixture.as("teacher").mutation(lock, {
        attemptId: entered.attempt,
        reason: "other",
        sittingId: made.id,
        slug: nf,
      });
      const failure = yield* finishAs(fixture, made.id, deviceOf(1)).pipe(
        Effect.flip
      );
      expect(failure).toMatchObject({ _tag: "AttemptLocked" });
    })
  );

  it.effect("refuses a Finish once the deadline has passed", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      yield* enterOk(fixture, {
        deviceId: deviceOf(1),
        sittingId: made.id,
        token: made.token,
      });
      vi.setSystemTime(CLOSES);
      const failure = yield* finishAs(fixture, made.id, deviceOf(1)).pipe(
        Effect.flip
      );
      expect(failure).toMatchObject({ _tag: "AttemptClosed" });
    })
  );

  it.effect("refuses a Finish in a school that is suspended", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* openedSitting(fixture, "PTS");
      yield* enterOk(fixture, {
        deviceId: deviceOf(1),
        sittingId: made.id,
        token: made.token,
      });
      yield* fixture.run(suspend(fixture.tenants.nf));
      const failure = yield* finishAs(fixture, made.id, deviceOf(1)).pipe(
        Effect.flip
      );
      expect(failure).toMatchObject({ _tag: "SittingLocked" });
    })
  );
});
