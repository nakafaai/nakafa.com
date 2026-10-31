import { FunctionImpl } from "@confect/server";
import type { ReportCardsDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  StorageReader,
} from "@repo/backend/confect/_generated/services";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import {
  type OwnReport,
  ReportHash,
} from "@repo/backend/confect/records/report";
import spec from "@repo/backend/confect/records/reports.spec";
import { Array as Arr, Effect, Schema } from "effect";

/** The most report cards of one student a read takes: two a year for twelve years, with room. */
const REPORT_LIMIT = 50;

/** The fields a report card holds from its lock on: its approval, the hash its QR carries, and its PDF. */
const LockedCard = Schema.Struct({
  approvedAt: Schema.Finite,
  hash: ReportHash,
  state: Schema.Literal("locked"),
  storageId: Id("_storage"),
});

/** Whether a report card is locked, so the student may read it with its PDF. */
const isLocked = (
  row: ReportCardsDoc
): row is ReportCardsDoc & typeof LockedCard.Type => Schema.is(LockedCard)(row);

/**
 * The caller's own locked report cards in the school, the newest card first, each with its class group, period, PDF
 * and hash. The read is the caller's own cards only, so it checks the owner by construction, and it takes locked cards
 * only: a card before its lock, whose note and grades may still change, stays with the school.
 */
export const own = FunctionImpl.make(
  databaseSchema,
  spec,
  "own",
  Effect.fn("records.reports.own")(function* () {
    const { person } = yield* Member;
    const reader = yield* DatabaseReader;
    const storage = yield* StorageReader;
    const rows = yield* reader
      .table("reportCards")
      .index(
        "by_personId_and_state",
        (query) => query.eq("personId", person._id).eq("state", "locked"),
        "desc"
      )
      .take(REPORT_LIMIT)
      .pipe(Effect.orDie);
    const cards = yield* Effect.forEach(Arr.filter(rows, isLocked), (row) =>
      Effect.gen(function* () {
        const [cohort, period, file] = yield* Effect.all([
          reader.table("tenantCohorts").get(row.cohortId).pipe(Effect.orDie),
          reader.table("tenantPeriods").get(row.periodId).pipe(Effect.orDie),
          storage.getUrl(row.storageId).pipe(
            Effect.map((url) => url.href),
            Effect.orDie
          ),
        ]);
        const card: typeof OwnReport.Type = {
          approvedAt: row.approvedAt,
          cohort: cohort.name,
          file,
          hash: row.hash,
          id: row._id,
          period: period.name,
        };
        return card;
      })
    );
    return cards;
  })
);
