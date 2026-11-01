import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { reportOf } from "@repo/backend/confect/records/card";
import spec from "@repo/backend/confect/records/exports.spec";
import type { LedgerRow } from "@repo/backend/confect/records/report";
import {
  openNisn,
  rosterEntryOf,
  schoolKeys,
} from "@repo/backend/confect/roster/entry";
import { Cohort } from "@repo/backend/confect/tenancy/access";
import { cohortAccess } from "@repo/backend/confect/tenancy/authority";
import { Effect, Layer, Option, Struct } from "effect";

/**
 * One page of a class group's report data for Dapodik: each student placed in it, in the order
 * of their placement, with the NISN on file opened under the school key and the copy of grades
 * their locked report card holds. A report card that is not locked yet gives none.
 */
const ledger = FunctionImpl.make(
  databaseSchema,
  spec,
  "ledger",
  Effect.fn("records.exports.ledger")(function* ({ paginationOpts }) {
    const row = yield* Cohort;
    const reader = yield* DatabaseReader;
    const keys = yield* schoolKeys(row.tenantId);
    const page = yield* reader
      .table("tenantCohortMembers")
      .index("by_cohortId_and_personId", (query) =>
        query.eq("cohortId", row._id)
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    const rows = yield* Effect.forEach(
      page.page,
      (placement) =>
        Effect.gen(function* () {
          const [person, entry, report] = yield* Effect.all([
            reader
              .table("tenantPeople")
              .get(placement.personId)
              .pipe(Effect.orDie),
            rosterEntryOf(placement.personId),
            reportOf(row._id, placement.personId),
          ]);
          const nisn = Option.isSome(entry)
            ? yield* openNisn(keys, entry.value)
            : Option.none();
          const ledgerRow: typeof LedgerRow.Type = {
            name: person.name,
            nisn: Option.getOrNull(nisn),
            subjects: Option.getOrNull(
              Option.flatMap(
                Option.filter(report, (found) => found.state === "locked"),
                (found) => Option.fromUndefinedOr(found.subjects)
              )
            ),
          };
          return ledgerRow;
        }),
      { concurrency: "unbounded" }
    );
    return Struct.assign(page, { page: rows });
  })
);

/** The Dapodik export of a class group's report data. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(ledger),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(cohortAccess),
  GroupImpl.finalize
);
