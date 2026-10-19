import { beforeEach, describe, expect, it } from "@effect/vitest";
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
  scheduleSitting,
  seedPlacement,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { mine } = refs.public.exams.sittings;

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
    "lists at most fifty sittings of one state for a unit, so a student's list stays bounded",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "PTS");
        yield* fixture.run(
          Effect.asVoid(
            Effect.forEach(
              Arr.makeBy(51, (index) => index),
              (index) =>
                Effect.flatMap(DatabaseWriter, (writer) =>
                  writer.table("examSittings").insert({
                    closesAt: CLOSES,
                    cohortId: null,
                    examId,
                    jobs: [],
                    opensAt: OPENS + index,
                    room: `Lab ${index}`,
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
        const listed = yield* fixture.as("student").query(mine, { slug: nf });
        expect(listed).toHaveLength(50);
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
