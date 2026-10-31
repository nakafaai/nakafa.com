import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  CLOSES_AT,
  jobStateOf,
  keyedExam,
  keyedSchool,
  OPENS_AT,
  scheduleSitting,
  sittingRow,
} from "@repo/backend/test/sittings";
import {
  journal,
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const reschedule = refs.public.exams.sittings.reschedule;
const nf = slugOf("nf");

/** Two days after the fixture's clock, far enough ahead that the room's notices are scheduled too. */
const LATER_OPENS_AT = TENANCY_NOW + 2 * 24 * 3_600_000;
const LATER_CLOSES_AT = LATER_OPENS_AT + 90 * 60_000;

describe("exams/sittings reschedule", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "moves a room that has not opened to new times and a new name, replaces every job, and records the move",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const made = yield* scheduleSitting(fixture, {
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        });
        const before = yield* sittingRow(fixture, made.id);
        expect(
          yield* fixture.as("teacher").mutation(reschedule, {
            closesAt: LATER_CLOSES_AT,
            opensAt: LATER_OPENS_AT,
            room: "Aula",
            sittingId: made.id,
            slug: nf,
          })
        ).toBeNull();
        const after = yield* sittingRow(fixture, made.id);
        expect(after).toMatchObject({
          closesAt: LATER_CLOSES_AT,
          opensAt: LATER_OPENS_AT,
          room: "Aula",
          state: "scheduled",
          tokenHash: before.tokenHash,
        });
        expect(
          yield* Effect.forEach(before.jobs, (job) => jobStateOf(fixture, job))
        ).toEqual(Arr.map(before.jobs, () => "canceled"));
        expect(after.jobs).toHaveLength(before.jobs.length);
        expect(Arr.intersection(after.jobs, before.jobs)).toEqual([]);
        expect(
          yield* Effect.forEach(after.jobs, (job) => jobStateOf(fixture, job))
        ).toEqual(Arr.map(after.jobs, () => "pending"));
        expect(
          Arr.map(yield* fixture.run(journal), (entry) => entry.change.type)
        ).toContain("sitting.reschedule");
      })
  );

  it.effect(
    "refuses a teacher who neither scheduled the room nor is an Admin, times out of order or past, and a room that has opened",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "Ulangan");
        const made = yield* scheduleSitting(fixture, {
          actor: "admin",
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        });
        const move = (
          actor: "admin" | "teacher",
          opensAt: number,
          closesAt: number
        ) =>
          fixture
            .as(actor)
            .mutation(reschedule, {
              closesAt,
              opensAt,
              room: "Lab 3",
              sittingId: made.id,
              slug: nf,
            })
            .pipe(Effect.flip);
        const teacher = yield* move("teacher", LATER_OPENS_AT, LATER_CLOSES_AT);
        const backwards = yield* move("admin", LATER_CLOSES_AT, LATER_OPENS_AT);
        const past = yield* move(
          "admin",
          TENANCY_NOW - 3_600_000,
          LATER_CLOSES_AT
        );
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("examSittings").patch(made.id, { state: "open" })
          )
        );
        const opened = yield* move("admin", LATER_OPENS_AT, LATER_CLOSES_AT);
        expect([teacher, backwards, past, opened]).toMatchObject([
          { _tag: "AccessDenied", reason: "role" },
          { _tag: "ScheduleInvalid", reason: "closesAt" },
          { _tag: "ScheduleInvalid", reason: "opensAt" },
          { _tag: "RoomOpened" },
        ]);
        expect(yield* sittingRow(fixture, made.id)).toMatchObject({
          closesAt: CLOSES_AT,
          opensAt: OPENS_AT,
        });
      })
  );
});
