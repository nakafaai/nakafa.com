import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
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

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(periods),
  Layer.provide(cohorts),
  Layer.provide(people),
  Layer.provide(placements),
  GroupImpl.finalize
);
