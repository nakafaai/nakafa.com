import {
  ImportRow,
  Nisn,
  SourcedRow,
} from "@repo/backend/confect/roster/schema";
import { CohortName } from "@repo/backend/confect/tenancy/cohort";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
import { Array as Arr, Option, Predicate, Schema, String as Str } from "effect";

/**
 * One cell as the sheet reader gives it: text, a number, a boolean, a date, or empty. The
 * reader's own type names the `Date` constructor instead of a date, so a cell is read here
 * by its runtime value.
 */
export type Cell = unknown;

/** The header texts that name each read column, in lowercase with single spaces. */
const HEADERS = {
  cohort: ["rombel saat ini", "rombel", "rombongan belajar"],
  name: ["nama", "nama peserta didik"],
  nisn: ["nisn"],
};

/** The column positions of a sheet's header row. */
type Columns = Record<keyof typeof HEADERS, Option.Option<number>>;

/** The digits of a NISN, which a number cell loses at the start. */
const NISN_DIGITS = 10;
/** A run of white space inside a header text. */
const SPACES = /\s+/gu;

/** A text cell, trimmed, lowercase, with runs of space as one space. */
const keyOf = (cell: Cell) =>
  Predicate.isString(cell)
    ? Str.toLowerCase(Str.replaceAll(SPACES, " ")(Str.trim(cell)))
    : "";

/** The positions of the read columns, when the row names both the name and the NISN. */
const columnsOf = (row: readonly Cell[]): Option.Option<Columns> => {
  const keys = Arr.map(row, keyOf);
  const position = (names: readonly string[]) =>
    Arr.findFirstIndex(keys, (key) => Arr.contains(names, key));
  const columns: Columns = {
    cohort: position(HEADERS.cohort),
    name: position(HEADERS.name),
    nisn: position(HEADERS.nisn),
  };
  return Option.isSome(columns.name) && Option.isSome(columns.nisn)
    ? Option.some(columns)
    : Option.none();
};

/** Why one row of the sheet is not imported. */
export const RowProblem = Schema.Literals(["name", "nisn", "cohort"]);

/**
 * One read row: the student it holds, by a NISN from Dapodik or by the source's identity from
 * OneRoster, or the problem that keeps it out, with its line in the file.
 */
export const ReadRow = Schema.Union([
  Schema.Struct({
    line: Schema.Finite,
    outcome: Schema.Literal("row"),
    row: ImportRow,
  }),
  Schema.Struct({
    line: Schema.Finite,
    outcome: Schema.Literal("sourced"),
    row: SourcedRow,
  }),
  Schema.Struct({
    line: Schema.Finite,
    outcome: Schema.Literal("problem"),
    problem: RowProblem,
  }),
]);

/** The text of a text or number cell, trimmed, or none for an empty cell or any other value. */
const textOf = (cell: Cell) => {
  if (Predicate.isString(cell)) {
    return Option.filter(Option.some(Str.trim(cell)), Str.isNonEmpty);
  }
  return Predicate.isNumber(cell) ? Option.some(String(cell)) : Option.none();
};

/**
 * The NISN text of a cell. A NISN kept in a number cell has lost its leading zeros, so a whole
 * number gets them back.
 */
const nisnTextOf = (cell: Cell) =>
  Predicate.isNumber(cell) && Number.isInteger(cell)
    ? Option.some(Str.padStart(NISN_DIGITS, "0")(String(cell)))
    : textOf(cell);

/** Reads one data row of the sheet into a student, or the problem with it. */
const readRow = (
  row: readonly Cell[],
  line: number,
  columns: Columns
): typeof ReadRow.Type => {
  const at = (column: Option.Option<number>) =>
    Option.flatMap(column, (index) => textOf(row[index]));
  const name = Option.flatMap(
    at(columns.name),
    Schema.decodeOption(PersonName)
  );
  if (Option.isNone(name)) {
    return { line, outcome: "problem", problem: "name" };
  }
  const nisn = Option.flatMap(
    Option.flatMap(columns.nisn, (index) => nisnTextOf(row[index])),
    Schema.decodeOption(Nisn)
  );
  if (Option.isNone(nisn)) {
    return { line, outcome: "problem", problem: "nisn" };
  }
  const cohortText = at(columns.cohort);
  const cohort = Option.flatMap(cohortText, Schema.decodeOption(CohortName));
  if (Option.isSome(cohortText) && Option.isNone(cohort)) {
    return { line, outcome: "problem", problem: "cohort" };
  }
  return {
    line,
    outcome: "row",
    row: {
      ...(Option.isSome(cohort) ? { cohortName: cohort.value } : {}),
      name: name.value,
      nisn: nisn.value,
    },
  };
};

/**
 * Whether a row holds a student at all: a name or a NISN. A blank line below the table holds
 * neither, and so does the row of sub-headers under the parents' column groups.
 */
const holdsStudent = (row: readonly Cell[], columns: Columns) =>
  Arr.some([columns.name, columns.nisn], (column) =>
    Option.exists(column, (index) => Option.isSome(textOf(row[index])))
  );

/** Why a sheet is not read as a Dapodik student list. */
export const SheetProblem = Schema.Literals(["header", "empty", "size"]);

/** The answer of reading one sheet: its rows, or the problem that refuses it. */
export const SheetRead = Schema.Union([
  Schema.Struct({
    outcome: Schema.Literal("read"),
    rows: Schema.Array(ReadRow),
  }),
  Schema.Struct({ outcome: Schema.Literal("refused"), problem: SheetProblem }),
]);

/**
 * Reads the rows of a Dapodik student list (ADR 0015). The header row is the first row that
 * names both the student's name and NISN, so the title rows above it are skipped, and only
 * the name, the NISN, and the class group are read. No other column, the birth date, the NIK,
 * and the parents' data included, is read. A row that holds neither a name nor a NISN is
 * skipped. A sheet without that header, or without a student row below it, is refused.
 */
export function readDapodikSheet(
  rows: readonly (readonly Cell[])[]
): typeof SheetRead.Type {
  const header = Option.flatMap(
    Arr.findFirstIndex(rows, (row) => Option.isSome(columnsOf(row))),
    (index) =>
      Option.map(
        Option.flatMap(Arr.get(rows, index), columnsOf),
        (columns) => ({
          columns,
          index,
        })
      )
  );
  if (Option.isNone(header)) {
    return { outcome: "refused", problem: "header" };
  }
  const { columns, index } = header.value;
  const read = Arr.getSomes(
    Arr.map(Arr.drop(rows, index + 1), (row, offset) =>
      holdsStudent(row, columns)
        ? Option.some(readRow(row, index + offset + 2, columns))
        : Option.none()
    )
  );
  if (Arr.isReadonlyArrayEmpty(read)) {
    return { outcome: "refused", problem: "empty" };
  }
  return { outcome: "read", rows: read };
}

/** The students of a read sheet, without the rows that have a problem. */
export const studentsOf = (
  rows: readonly (typeof ReadRow.Type)[]
): readonly (typeof ImportRow.Type)[] =>
  Arr.getSomes(
    Arr.map(rows, (row) =>
      row.outcome === "row" ? Option.some(row.row) : Option.none()
    )
  );

/** The students of a read OneRoster file, without the rows that have a problem. */
export const sourcedOf = (
  rows: readonly (typeof ReadRow.Type)[]
): readonly (typeof SourcedRow.Type)[] =>
  Arr.getSomes(
    Arr.map(rows, (row) =>
      row.outcome === "sourced" ? Option.some(row.row) : Option.none()
    )
  );

/** The header and the rows of the export, which holds the columns the import reads, for a school to compare with Dapodik. */
export const EXPORT_HEADER = ["Nama", "NISN", "Rombel Saat Ini"];
