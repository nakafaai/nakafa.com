import type { GenericId } from "@confect/core";
import integrationsInternal from "@repo/backend/confect/_generated/refs/integrations.server";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import {
  type ExportDataset,
  PAGE_LIMIT,
} from "@repo/backend/confect/integrations/api";
import { Array as Arr, Effect, Option, Schema, String as Str } from "effect";

/** The most rows one export reads: the target of a school's file, as an import is held to it. */
export const EXPORT_LIMIT = 5000;

/** The cells that make a spreadsheet read a value as a formula (OWASP, CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/u;

/** A character that makes a CSV field need quotes. */
const CSV_SPECIAL = /[",\r\n]/u;

/** One sheet of an export: its header, then its rows of text. */
export const ExportSheet = Schema.Struct({
  header: Schema.Array(Schema.String),
  rows: Schema.Array(Schema.Array(Schema.String)),
});

/** A cell that a spreadsheet opens as text, whatever it starts with. */
const plainCell = (cell: string) =>
  FORMULA_START.test(cell) ? `'${cell}` : cell;

/** One CSV field (RFC 4180). */
const csvField = (cell: string) => {
  const plain = plainCell(cell);
  return CSV_SPECIAL.test(plain)
    ? `"${Str.replaceAll('"', '""')(plain)}"`
    : plain;
};

/** A sheet as CSV text, with the line ends RFC 4180 names. */
export const encodeCsv = (sheet: typeof ExportSheet.Type) =>
  Arr.join(
    Arr.map(Arr.prepend(sheet.rows, sheet.header), (row) =>
      Arr.join(Arr.map(row, csvField), ",")
    ),
    "\r\n"
  );

/** A sheet as the bytes of an XLSX file, through the library the Dapodik export uses (ADR 0015). */
export const encodeXlsx = (sheet: typeof ExportSheet.Type) =>
  Effect.promise(async () => {
    const { default: writeXlsxFile } = await import(
      "write-excel-file/universal"
    );
    const cells = Arr.map(Arr.prepend(sheet.rows, sheet.header), (row) =>
      Arr.map(row, (value) => ({ value }))
    );
    const blob = await writeXlsxFile(cells).toBlob();
    return new Uint8Array(await blob.arrayBuffer());
  });

/** One read's page, the shape every read of the school API answers. */
type Page<A> =
  | { readonly outcome: "forbidden" }
  | {
      readonly data: readonly A[];
      readonly next: string | null;
      readonly outcome: "page";
    };

/**
 * Every row of a read up to `EXPORT_LIMIT`, page by page, each page decided for the client as
 * any read is. A read the client may not make is none.
 */
const allRows = <A, R>(
  read: (cursor: string | null) => Effect.Effect<Page<A>, never, R>,
  rows: readonly A[] = [],
  cursor: string | null = null
): Effect.Effect<Option.Option<readonly A[]>, never, R> =>
  Effect.flatMap(read(cursor), (page) => {
    if (page.outcome === "forbidden") {
      return Effect.succeedNone;
    }
    const held = Arr.appendAll(rows, page.data);
    return page.next === null || held.length >= EXPORT_LIMIT
      ? Effect.succeedSome(Arr.take(held, EXPORT_LIMIT))
      : allRows(read, held, page.next);
  });

/**
 * The sheet of one dataset for one client, made by the reads of the REST API, so a file holds
 * exactly what the client may read. A dataset the client may not read is none, and so is one
 * of a period that a request left out.
 */
export const readExport = Effect.fn("integrations.exports.read")(function* (
  clientId: GenericId.GenericId<"integrationClients">,
  dataset: typeof ExportDataset.Type,
  period: string | undefined
) {
  const { runQuery } = yield* QueryRunner;
  const reads = integrationsInternal.reads;
  const page = { numItems: PAGE_LIMIT };
  if (dataset === "people") {
    const rows = yield* allRows((cursor) =>
      runQuery(reads.people, {
        ...page,
        clientId,
        cursor,
        status: "active",
      }).pipe(Effect.orDie)
    );
    return Option.map(rows, (people) => ({
      header: ["id", "name", "status", "account"],
      rows: Arr.map(people, (row) => [
        row.id,
        row.name,
        row.status,
        row.account,
      ]),
    }));
  }
  if (period === undefined) {
    return Option.none();
  }
  if (dataset === "placements") {
    const rows = yield* allRows((cursor) =>
      runQuery(reads.placements, { ...page, clientId, cursor, period }).pipe(
        Effect.orDie
      )
    );
    return Option.map(rows, (placements) => ({
      header: ["periodId", "cohortId", "personId"],
      rows: Arr.map(placements, (row) => [
        row.periodId,
        row.cohortId,
        row.personId,
      ]),
    }));
  }
  const rows = yield* allRows((cursor) =>
    runQuery(reads.grades, { ...page, clientId, cursor, period }).pipe(
      Effect.orDie
    )
  );
  return Option.map(rows, (grades) => ({
    header: ["periodId", "classId", "personId", "value", "releasedAt"],
    rows: Arr.map(grades, (row) => [
      row.periodId,
      row.classId,
      row.personId,
      String(row.value),
      String(row.releasedAt),
    ]),
  }));
});
