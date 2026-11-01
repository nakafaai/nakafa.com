import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  forumClass,
  keyedFixture,
  nf,
  openPeriod,
  period,
} from "@repo/backend/test/classroom";
import { TENANCY_NOW, type tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

type Fixture = Effect.Success<typeof tenancyFixture>;

const { run } = refs.internal.insight.retention;
const periods = refs.public.tenancy.periods;
const narratives = refs.public.insight.narratives;

/** Stores `count` standings of the student in a period. */
const standings = (
  fixture: Fixture,
  periodId: GenericId.GenericId<"tenantPeriods">,
  count: number
) =>
  fixture.run(
    Effect.flatMap(DatabaseWriter, (writer) =>
      Effect.forEach(
        Arr.range(1, count),
        (index) =>
          writer.table("insightMastery").insert({
            competency: `Kompetensi ${index}`,
            earned: 1,
            observations: 1,
            periodId,
            personId: fixture.people.student.personId,
            possible: 1,
            rating: 1,
            tenantId: fixture.tenants.nf,
            updatedAt: TENANCY_NOW,
          }),
        { discard: true }
      )
    ).pipe(Effect.orDie)
  );

/** How many rows of Insight the period still holds. */
const kept = (
  fixture: Fixture,
  periodId: GenericId.GenericId<"tenantPeriods">
) =>
  fixture.run(
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const mastery = yield* reader
        .table("insightMastery")
        .index("by_periodId", (query) => query.eq("periodId", periodId))
        .take(300);
      const written = yield* reader
        .table("insightNarratives")
        .index("by_periodId", (query) => query.eq("periodId", periodId))
        .take(10);
      const drafts = yield* reader
        .table("insightDrafts")
        .index("by_periodId", (query) => query.eq("periodId", periodId))
        .take(10);
      return mastery.length + written.length + drafts.length;
    }).pipe(Effect.orDie)
  );

describe("insight/retention", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect("keeps a period the school restored", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      const term = yield* period(fixture, fixture.units.smp);
      yield* openPeriod(fixture, term.id);
      yield* standings(fixture, term.id, 1);

      yield* fixture.internal.mutation(run, { periodId: term.id });

      expect(yield* kept(fixture, term.id)).toBe(1);
    })
  );

  it.effect("deletes an archived period's standings and narratives", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      const term = yield* period(fixture, fixture.units.smp);
      yield* openPeriod(fixture, term.id);
      const forum = yield* forumClass(fixture, term.id, "X-1");
      yield* fixture.as("teacher").mutation(narratives.write, {
        classId: forum.classId,
        personId: fixture.people.student.personId,
        slug: nf,
        text: "Rajin.",
      });
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("insightDrafts").insert({
            askedBy: fixture.people.teacher.personId,
            classId: forum.classId,
            periodId: term.id,
            personId: fixture.people.student.personId,
            tenantId: fixture.tenants.nf,
            updatedAt: TENANCY_NOW,
          })
        ).pipe(Effect.orDie)
      );
      yield* standings(fixture, term.id, 201);
      yield* fixture
        .as("admin")
        .mutation(periods.archive, { periodId: term.id, slug: nf });

      yield* fixture.finishScheduled();

      expect(yield* kept(fixture, term.id)).toBe(0);
    })
  );
});
