import type { Id } from "@repo/backend/confect/_generated/id";
import records from "@repo/backend/confect/_generated/refs/records";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Effect, Option, Stream, Tuple } from "effect";
import {
  fileStem,
  type GraduationOverview,
  ledgerWorkbook,
  readinessWorkbook,
  type Sheet,
} from "@/components/tenant/graduation/workbook";
import { readOnce } from "@/lib/convex/read";

/** How many students each read of an export takes. */
const EXPORT_PAGE = 100;

/** One page of a paginated read, as every export reads it. */
interface Page<A> {
  readonly continueCursor: string;
  readonly isDone: boolean;
  readonly page: readonly A[];
}

/** Every page of a paginated read, one read after another until it is done. */
const allPages = <A, E, R>(
  read: (cursor: string | null) => Effect.Effect<Page<A>, E, R>
) =>
  Stream.paginate(Option.none<string>(), (cursor) =>
    read(Option.getOrNull(cursor)).pipe(
      Effect.map((result) =>
        Tuple.make(
          result.page,
          result.isDone
            ? Option.none()
            : Option.some(Option.some(result.continueCursor))
        )
      )
    )
  ).pipe(Stream.runCollect);

/**
 * Writes a workbook in the browser and saves it under its file name. The writer loads only
 * when the viewer asks for a file, so it stays out of the page's first JavaScript.
 */
const saveWorkbook = (
  sheets: readonly (typeof Sheet.Type)[],
  fileName: string
) =>
  Effect.tryPromise(async () => {
    const { default: writeXlsxFile } = await import("write-excel-file/browser");
    await writeXlsxFile(
      Arr.map(sheets, (sheet) => ({
        data: Arr.map(sheet.data, (row) => [...row]),
        sheet: sheet.sheet,
      }))
    ).toFile(fileName);
  });

/**
 * Saves the e-Ijazah readiness workbook of a graduating class group (ADR 0033, S6), from every
 * page of its readiness rows, as `e-ijazah-ix-a.xlsx`.
 */
export const downloadReadiness = Effect.fn("tenant.graduation.readiness")(
  function* (slug: TenantSlug, overview: GraduationOverview) {
    const rows = yield* allPages((cursor) =>
      readOnce(records.graduations.readiness, {
        cohortId: overview.cohort.id,
        paginationOpts: { cursor, numItems: EXPORT_PAGE },
        slug,
      })
    );
    yield* saveWorkbook(
      readinessWorkbook(overview, rows),
      `e-ijazah-${fileStem(overview.cohort.name)}.xlsx`
    );
  }
);

/**
 * Saves the Dapodik workbook of a class group's report data (ADR 0033, S6), from every page of
 * its rows, as `dapodik-nilai-ix-a.xlsx`.
 */
export const downloadLedger = Effect.fn("tenant.graduation.ledger")(function* (
  slug: TenantSlug,
  cohort: { readonly id: Id<"tenantCohorts">; readonly name: string }
) {
  const rows = yield* allPages((cursor) =>
    readOnce(records.exports.ledger, {
      cohortId: cohort.id,
      paginationOpts: { cursor, numItems: EXPORT_PAGE },
      slug,
    })
  );
  yield* saveWorkbook(
    ledgerWorkbook(rows),
    `dapodik-nilai-${fileStem(cohort.name)}.xlsx`
  );
});
