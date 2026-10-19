import { beforeEach, describe, expect, it } from "@effect/vitest";
import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/editor";
import {
  CLOSES_AT as CLOSES,
  keyedExam,
  keyedSchool,
  mentions,
  OPENS_AT as OPENS,
  openedSitting,
  type SittingFixture,
  scheduleSitting,
  seedPlacement,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { mine } = refs.public.exams.sittings;

/** The opening time of the rooms that open a day after the room that opens soon. */
const NEXT_DAY = OPENS + 86_400_000;

/**
 * Writes scheduled rooms of the SMP unit with the scheduler's jobs left out, so one test can seed
 * more rooms than a list holds. The rooms are written in the order given.
 */
const insertRooms = (
  fixture: SittingFixture,
  rooms: readonly Pick<
    ExamSittingsDoc,
    "cohortId" | "examId" | "opensAt" | "room"
  >[]
) =>
  fixture.run(
    Effect.asVoid(
      Effect.forEach(rooms, (room) =>
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("examSittings").insert({
            closesAt: CLOSES,
            cohortId: room.cohortId,
            examId: room.examId,
            jobs: [],
            opensAt: room.opensAt,
            room: room.room,
            state: "scheduled",
            tenantId: fixture.tenants.nf,
            tokenHash: "",
            tokenIssuedAt: TENANCY_NOW,
            tokenSealed: new ArrayBuffer(0),
            unitId: fixture.units.smp,
          })
        ).pipe(Effect.orDie)
      )
    )
  );

describe("exams/sittings mine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

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
    "lists at most fifty sittings of one state for a unit, and keeps the ones that open first",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        // The fifty later rooms are written before the room that opens soon, so only the
        // opening order keeps that room in the list.
        yield* insertRooms(fixture, [
          ...Arr.makeBy(50, (index) => ({
            cohortId: null,
            examId,
            opensAt: NEXT_DAY + index,
            room: `Lab ${index}`,
          })),
          { cohortId: null, examId, opensAt: OPENS, room: "Lab soon" },
        ]);
        const listed = yield* fixture.as("student").query(mine, { slug: nf });
        expect(Arr.map(listed, (row) => row.room)).toEqual([
          "Lab soon",
          ...Arr.makeBy(49, (index) => `Lab ${index}`),
        ]);
      })
  );

  it.effect(
    "lists at most fifty sittings of one state for a cohort, and keeps the ones that open first",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        const cohortId = yield* seedPlacement(
          fixture,
          fixture.people.student.personId
        );
        yield* insertRooms(fixture, [
          ...Arr.makeBy(50, (index) => ({
            cohortId,
            examId,
            opensAt: NEXT_DAY + index,
            room: `Lab ${index}`,
          })),
          { cohortId, examId, opensAt: OPENS, room: "Lab soon" },
        ]);
        const listed = yield* fixture.as("student").query(mine, { slug: nf });
        expect(Arr.map(listed, (row) => row.room)).toEqual([
          "Lab soon",
          ...Arr.makeBy(49, (index) => `Lab ${index}`),
        ]);
      })
  );

  it.effect(
    "shows each sitting with its exam's title and its unit's time zone, in one list",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const listed = yield* fixture.as("student").query(mine, { slug: nf });
        expect(listed).toEqual([
          expect.objectContaining({
            examTitle: "PTS",
            id: made.id,
            timeZone: "Asia/Jakarta",
          }),
        ]);
      })
  );
});
