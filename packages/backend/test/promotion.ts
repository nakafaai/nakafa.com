import type { GenericId } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type {
  PromotionDestination,
  PromotionSource,
  PromotionTarget,
} from "@repo/backend/confect/tenancy/promotion/schema";
import {
  grantRole,
  scheduledJobs,
  slugOf,
  type tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option } from "effect";

/** The Confect program fixture of the tenancy tests, one seeded school per test. */
type Fixture = Effect.Success<typeof tenancyFixture>;
type PromotionId = GenericId.GenericId<"tenantPromotions">;
type PersonId = GenericId.GenericId<"tenantPeople">;

export const nf = slugOf("nf");
export const periods = refs.public.tenancy.periods;
export const cohorts = refs.public.tenancy.cohorts;
export const placements = refs.public.tenancy.placements;
export const people = refs.public.tenancy.people;
export const assignments = refs.public.tenancy.assignments;
export const promotion = refs.public.tenancy.promotion;
export const runPromotion = refs.internal.tenancy.promotion.run.run;

/** The destinations the shared plan uses. */
export const toEightA: typeof PromotionDestination.Type = {
  kind: "cohort",
  name: "8A",
};
export const toEightB: typeof PromotionDestination.Type = {
  kind: "cohort",
  name: "8B",
};
export const toGraduate: typeof PromotionDestination.Type = {
  kind: "graduate",
};
export const toStay: typeof PromotionDestination.Type = { kind: "stay" };

/** The AccessDenied that a refused action reads as, with the reason its check gave. */
export const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});

/** Every journal entry, oldest first, with room for one whole promotion. */
export const allJournal = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("journalEntries").index("by_creation_time").take(1000)
);

/** The arguments of each scheduled run of a promotion, oldest first. */
export const runJobs = Effect.map(scheduledJobs, (jobs) =>
  Arr.map(
    Arr.filter(jobs, (job) => job.name === "tenancy/promotion/run:run"),
    (job) => job.args
  )
);

/** The journal entries of one change type, oldest first. */
export const entriesOf = (fixture: Fixture, type: string) =>
  Effect.map(fixture.run(allJournal), (entries) =>
    Arr.filter(entries, (entry) => entry.change.type === type)
  );

/** A planned period of the fixture's SMP unit, created as its Admin does. */
const smpPeriod = (
  fixture: Fixture,
  name: string,
  start: string,
  end: string
) =>
  fixture.as("admin").mutation(periods.create, {
    end,
    name,
    slug: nf,
    start,
    unitId: fixture.units.smp,
  });

/** A cohort of one period, created as the school's Admin does. */
export const cohort = (
  fixture: Fixture,
  periodId: GenericId.GenericId<"tenantPeriods">,
  name: string,
  grade: number
) =>
  fixture
    .as("admin")
    .mutation(cohorts.create, { grade, name, periodId, slug: nf });

/**
 * The source and target of a promotion in the SMP unit: the source period is
 * active, and the target is planned after it.
 */
export const periodPair = Effect.fn("test.promotion.periodPair")(function* (
  fixture: Fixture
) {
  const source = yield* smpPeriod(
    fixture,
    "Ganjil 2026/2027",
    "2026-07-13",
    "2026-12-19"
  );
  yield* fixture
    .as("admin")
    .mutation(periods.open, { periodId: source.id, slug: nf });
  const target = yield* smpPeriod(
    fixture,
    "Genap 2027",
    "2027-01-11",
    "2027-06-20"
  );
  return { source, target };
});

/**
 * Adds a student of the SMP unit, places them in a cohort as the Admin does, and
 * returns the Person's ID.
 */
export const placedStudent = Effect.fn("test.promotion.placedStudent")(
  function* (
    fixture: Fixture,
    cohortId: GenericId.GenericId<"tenantCohorts">,
    name: string
  ) {
    const made = yield* fixture
      .as("admin")
      .mutation(people.create, { name, slug: nf });
    yield* fixture.run(
      grantRole(fixture.tenants.nf, made.id, "student", {
        kind: "unit",
        unitId: fixture.units.smp,
      })
    );
    yield* fixture.as("admin").mutation(placements.place, {
      cohortId,
      personId: made.id,
      slug: nf,
    });
    return made.id;
  }
);

/**
 * One school's promotion scenario: the source period (active) with cohorts 7A
 * (grade 7) and 9A (grade 9), two students in 7A and one in 9A, 7A led by the
 * fixture's teacher, and the planned target period after the source.
 */
export const scenario = Effect.fn("test.promotion.scenario")(function* (
  fixture: Fixture
) {
  const { source, target } = yield* periodPair(fixture);
  const seventh = yield* cohort(fixture, source.id, "7A", 7);
  const ninth = yield* cohort(fixture, source.id, "9A", 9);
  const first = yield* placedStudent(fixture, seventh.id, "Siswa Satu");
  const second = yield* placedStudent(fixture, seventh.id, "Siswa Dua");
  const third = yield* placedStudent(fixture, ninth.id, "Siswa Tiga");
  yield* fixture.as("admin").mutation(assignments.assign, {
    cohortId: seventh.id,
    personId: fixture.people.teacher.personId,
    slug: nf,
  });
  yield* fixture.run(
    grantRole(
      fixture.tenants.nf,
      fixture.people.principal.personId,
      "principal",
      {
        kind: "unit",
        unitId: fixture.units.smp,
      }
    )
  );
  return { first, ninth, second, seventh, source, target, third };
});

/**
 * The plan of the scenario: 7A moves on to 8A with its homeroom teacher, and 9A
 * graduates. Each argument is a cohort of the scenario's source period.
 */
export const scenarioPlan = (
  seventh: { readonly id: GenericId.GenericId<"tenantCohorts"> },
  ninth: { readonly id: GenericId.GenericId<"tenantCohorts"> }
) => {
  const sources: (typeof PromotionSource.Type)[] = [
    { cohortId: seventh.id, homeroom: true, to: toEightA },
    { cohortId: ninth.id, homeroom: false, to: toGraduate },
  ];
  const targets: (typeof PromotionTarget.Type)[] = [{ grade: 8, name: "8A" }];
  return { sources, targets };
};

/**
 * Creates a promotion of the scenario, gives it the scenario's plan, submits it,
 * and has the principal approve it. Returns the promotion's ID.
 */
export const approvedPromotion = Effect.fn("test.promotion.approved")(
  function* (
    fixture: Fixture,
    s: Effect.Success<ReturnType<typeof scenario>>,
    custom?: Pick<ReturnType<typeof scenarioPlan>, "sources" | "targets">
  ) {
    const made = yield* fixture.as("admin").mutation(promotion.draft.create, {
      periodId: s.source.id,
      slug: nf,
      targetPeriodId: s.target.id,
    });
    yield* fixture.as("admin").mutation(promotion.draft.plan, {
      promotionId: made.id,
      slug: nf,
      ...(custom ?? scenarioPlan(s.seventh, s.ninth)),
    });
    yield* fixture
      .as("admin")
      .mutation(promotion.review.submit, { promotionId: made.id, slug: nf });
    yield* fixture
      .as("principal")
      .mutation(promotion.review.approve, { promotionId: made.id, slug: nf });
    return made.id;
  }
);

/** The stored promotion row, read as the system reads it. */
export const readPromotion = (fixture: Fixture, promotionId: PromotionId) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("tenantPromotions").get(promotionId)
    )
  );

/** The cohort that a promotion created for one name key of its plan. */
export const createdFor = (
  fixture: Fixture,
  promotionId: PromotionId,
  nameKey: string
) =>
  Effect.map(readPromotion(fixture, promotionId), (row) =>
    Option.getOrThrow(
      Arr.findFirst(row.created, (entry) => entry.nameKey === nameKey)
    )
  );

/**
 * Runs the chain one page or one step at a time until no run is in flight, the
 * way the scheduler would, and returns the promotion as it stands.
 */
export const drain = Effect.fn("test.promotion.drain")(function* (
  fixture: Fixture,
  promotionId: PromotionId
) {
  let row = yield* readPromotion(fixture, promotionId);
  while (row.progress.running) {
    yield* fixture.internal.mutation(runPromotion, {
      actorId: fixture.people.admin.personId,
      promotionId,
    });
    row = yield* readPromotion(fixture, promotionId);
  }
  return row;
});

/** Undoes one step as the Admin does, and runs it to its end. */
export const undoOnce = (fixture: Fixture, promotionId: PromotionId) =>
  fixture
    .as("admin")
    .mutation(promotion.undo.undo, { promotionId, slug: nf })
    .pipe(Effect.andThen(drain(fixture, promotionId)));

/**
 * Every row that applying a promotion writes or removes, read whole, oldest first:
 * the periods, the cohorts, the placements, the homeroom assignments, and the
 * graduations. Undo must leave these exactly as they were before apply.
 */
export const snapshot = (fixture: Fixture) =>
  fixture.run(
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const all = <
        T extends
          | "tenantCohorts"
          | "tenantCohortMembers"
          | "tenantAssignments"
          | "tenantGraduates"
          | "tenantPeriods",
      >(
        table: T
      ) => reader.table(table).index("by_creation_time").take(1000);
      return {
        assignments: yield* all("tenantAssignments"),
        cohorts: yield* all("tenantCohorts"),
        graduates: yield* all("tenantGraduates"),
        periods: yield* all("tenantPeriods"),
        placements: yield* all("tenantCohortMembers"),
      };
    })
  );

/**
 * Moves the first grant of some Persons from one status to another, as a school's
 * roster does when access ends or returns. A Person with no such grant is skipped.
 */
export const flipGrants = Effect.fn("test.promotion.flipGrants")(function* (
  fixture: Fixture,
  personIds: readonly PersonId[],
  from: "active" | "revoked",
  to: "active" | "revoked"
) {
  yield* fixture.run(
    Effect.forEach(
      personIds,
      (personId) =>
        Effect.gen(function* () {
          const reader = yield* DatabaseReader;
          const grant = yield* reader
            .table("tenantGrants")
            .index("by_personId_and_status", (query) =>
              query.eq("personId", personId).eq("status", from)
            )
            .first()
            .pipe(Effect.orDie);
          if (Option.isNone(grant)) {
            return;
          }
          yield* (yield* DatabaseWriter)
            .table("tenantGrants")
            .patch(grant.value._id, { status: to })
            .pipe(Effect.orDie);
        }),
      { discard: true }
    )
  );
});

/**
 * Adds `count` students of the SMP unit placed in one cohort, written in one go,
 * so a promotion has more students than one page holds.
 */
export const crowd = Effect.fn("test.promotion.crowd")(function* (
  fixture: Fixture,
  cohortId: GenericId.GenericId<"tenantCohorts">,
  periodId: GenericId.GenericId<"tenantPeriods">,
  count: number
) {
  return yield* fixture.run(
    Effect.flatMap(DatabaseWriter, (writer) =>
      Effect.forEach(Arr.range(1, count), (index) =>
        Effect.gen(function* () {
          const personId = yield* writer.table("tenantPeople").insert({
            account: { state: "unclaimed" },
            kind: "member",
            name: `Siswa Massal ${index}`,
            status: "active",
            tenantId: fixture.tenants.nf,
          });
          yield* writer.table("tenantGrants").insert({
            grantedBy: { kind: "system" },
            personId,
            role: { key: "student", kind: "builtin" },
            scope: { kind: "unit", unitId: fixture.units.smp },
            status: "active",
            tenantId: fixture.tenants.nf,
            term: { kind: "standing" },
          });
          yield* writer.table("tenantCohortMembers").insert({
            cohortId,
            periodId,
            personId,
            tenantId: fixture.tenants.nf,
          });
          return personId;
        })
      )
    )
  );
});
