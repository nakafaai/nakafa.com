import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { eventOf, isPublished } from "@repo/backend/confect/integrations/hook";
import {
  clientRead,
  FORBIDDEN,
  lists,
  nextOf,
  pageOptions,
  periodFor,
  periodsFor,
  readsCohort,
  readsPeople,
} from "@repo/backend/confect/integrations/reads";
import spec from "@repo/backend/confect/integrations/reads.spec";
import { readsSubject } from "@repo/backend/confect/integrations/subject";
import { gradeAuthority } from "@repo/backend/confect/records/authority";
import { Array as Arr, Effect, Layer, Option } from "effect";

/** The outcome of a read that answers a page. */
const PAGE = "page";

/** The periods of the client's school that its scope covers, on one page. */
const periods = FunctionImpl.make(
  databaseSchema,
  spec,
  "periods",
  Effect.fn("integrations.reads.periods.function")(function* ({ clientId }) {
    const read = yield* clientRead(clientId);
    if (!lists(read, "period.view")) {
      return FORBIDDEN;
    }
    const rows = yield* periodsFor(read);
    return {
      data: Arr.map(rows, (period) => ({
        end: period.end,
        id: period._id,
        name: period.name,
        start: period.start,
        status: period.status,
        unitId: period.unitId,
      })),
      next: null,
      outcome: PAGE,
    };
  })
);

/** The cohorts of one period that the client may read, a page at a time, in name order. */
const cohorts = FunctionImpl.make(
  databaseSchema,
  spec,
  "cohorts",
  Effect.fn("integrations.reads.cohorts.function")(function* ({
    clientId,
    cursor,
    numItems,
    period,
  }) {
    const read = yield* clientRead(clientId);
    const found = yield* periodFor(read, period);
    if (!lists(read, "cohort.view") || Option.isNone(found)) {
      return FORBIDDEN;
    }
    const result = yield* (yield* DatabaseReader)
      .table("tenantCohorts")
      .index("by_periodId_and_nameKey", (query) =>
        query.eq("periodId", found.value._id)
      )
      .paginate(pageOptions(cursor, numItems))
      .pipe(Effect.orDie);
    const rows = yield* Effect.filter(result.page, (cohort) =>
      readsCohort(read, cohort)
    );
    return {
      data: Arr.map(rows, (cohort) => ({
        grade: cohort.grade,
        id: cohort._id,
        name: cohort.name,
        periodId: cohort.periodId,
        status: cohort.status,
      })),
      next: nextOf(result),
      outcome: PAGE,
    };
  })
);

/** The member Persons of the client's school with one status, a page at a time, with no email. */
const people = FunctionImpl.make(
  databaseSchema,
  spec,
  "people",
  Effect.fn("integrations.reads.people.function")(function* ({
    clientId,
    cursor,
    numItems,
    status,
  }) {
    const read = yield* clientRead(clientId);
    if (!(lists(read, "person.view") && (yield* readsPeople(read)))) {
      return FORBIDDEN;
    }
    const result = yield* (yield* DatabaseReader)
      .table("tenantPeople")
      .index("by_tenantId_and_status", (query) =>
        query.eq("tenantId", read.tenant._id).eq("status", status)
      )
      .paginate(pageOptions(cursor, numItems))
      .pipe(Effect.orDie);
    return {
      data: Arr.map(
        Arr.filter(result.page, (person) => person.kind === "member"),
        (person) => ({
          account: person.account.state,
          id: person._id,
          name: person.name,
          status: person.status,
        })
      ),
      next: nextOf(result),
      outcome: PAGE,
    };
  })
);

/** The placements of one period that the client may read, a page at a time. */
const placements = FunctionImpl.make(
  databaseSchema,
  spec,
  "placements",
  Effect.fn("integrations.reads.placements.function")(function* ({
    clientId,
    cursor,
    numItems,
    period,
  }) {
    const read = yield* clientRead(clientId);
    const found = yield* periodFor(read, period);
    if (!lists(read, "cohort.view") || Option.isNone(found)) {
      return FORBIDDEN;
    }
    const result = yield* (yield* DatabaseReader)
      .table("tenantCohortMembers")
      .index("by_periodId_and_personId", (query) =>
        query.eq("periodId", found.value._id)
      )
      .paginate(pageOptions(cursor, numItems))
      .pipe(Effect.orDie);
    return {
      data: Arr.map(result.page, (placement) => ({
        cohortId: placement.cohortId,
        periodId: placement.periodId,
        personId: placement.personId,
      })),
      next: nextOf(result),
      outcome: PAGE,
    };
  })
);

/**
 * The released grades of one period that the client may read, a page at a time. A page reads
 * only released grades, so a draft never reaches a client, and each row is decided for the
 * client, whose scope may cover some units of the period's classes.
 */
const grades = FunctionImpl.make(
  databaseSchema,
  spec,
  "grades",
  Effect.fn("integrations.reads.grades.function")(function* ({
    clientId,
    cursor,
    numItems,
    period,
  }) {
    const read = yield* clientRead(clientId);
    const found = yield* periodFor(read, period);
    if (!lists(read, "grade.export") || Option.isNone(found)) {
      return FORBIDDEN;
    }
    const result = yield* (yield* DatabaseReader)
      .table("classGrades")
      .index("by_periodId_and_state", (query) =>
        query.eq("periodId", found.value._id).eq("state", "released")
      )
      .paginate(pageOptions(cursor, numItems))
      .pipe(Effect.orDie);
    const rows = yield* Effect.filter(result.page, (grade) =>
      gradeAuthority.allowsClient("grade.export", grade, read)
    );
    return {
      data: Arr.map(rows, (grade) => ({
        classId: grade.classId,
        id: grade._id,
        periodId: grade.periodId,
        personId: grade.personId,
        releasedAt: grade.releasedAt ?? grade.updatedAt,
        value: grade.value,
      })),
      next: nextOf(result),
      outcome: PAGE,
    };
  })
);

/**
 * The published changes of the client's school, oldest first, a page at a time, each one
 * decided for the client as a webhook's attempt is. A page can hold fewer rows than its size,
 * because the journal holds changes that are not published and subjects the client may not
 * read, so a client follows `next` until it is null.
 */
const changes = FunctionImpl.make(
  databaseSchema,
  spec,
  "changes",
  Effect.fn("integrations.reads.changes.function")(function* ({
    clientId,
    cursor,
    numItems,
  }) {
    const read = yield* clientRead(clientId);
    const result = yield* (yield* DatabaseReader)
      .table("journalEntries")
      .index("by_owner_tenantId", (query) =>
        query.eq("owner.tenantId", read.tenant._id)
      )
      .paginate(pageOptions(cursor, numItems))
      .pipe(Effect.orDie);
    const rows = yield* Effect.filter(
      Arr.filter(result.page, (entry) => isPublished(entry.change.type)),
      (entry) => readsSubject(entry, read)
    );
    return {
      data: Arr.map(rows, eventOf),
      next: nextOf(result),
      outcome: PAGE,
    };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(periods),
  Layer.provide(cohorts),
  Layer.provide(people),
  Layer.provide(placements),
  Layer.provide(grades),
  Layer.provide(changes),
  GroupImpl.finalize
);
