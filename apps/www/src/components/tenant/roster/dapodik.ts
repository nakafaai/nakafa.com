import { ImportRow, Nisn } from "@repo/backend/confect/roster/schema";
import { CohortName } from "@repo/backend/confect/tenancy/cohort";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
import {
  Array as Arr,
  DateTime,
  Option,
  Predicate,
  Schema,
  String as Str,
} from "effect";

/**
 * The age limit of the consent gate for Indonesia, UU 35/2014 Pasal 1 angka 1, read here
 * until the signed country profile gives it (ADR 0032, ADR 0034).
 */
const AGE_LIMIT = 18;

/**
 * One cell as the sheet reader gives it: text, a number, a boolean, a date, or empty. The
 * reader's own type names the `Date` constructor instead of a date, so a cell is read here
 * by its runtime value.
 */
export type Cell = unknown;

/** The header texts that name each read column, in lowercase with single spaces. */
const HEADERS = {
  birth: ["tanggal lahir", "tgl lahir"],
  cohort: ["rombel saat ini", "rombel", "rombongan belajar"],
  name: ["nama", "nama peserta didik"],
  nisn: ["nisn"],
};

/** The column positions of a sheet's header row. */
type Columns = Record<keyof typeof HEADERS, Option.Option<number>>;

/** The digits of a NISN, which a number cell loses at the start. */
const NISN_DIGITS = 10;
/** Day zero of a spreadsheet date number, 30 December 1899. */
const SERIAL_EPOCH = DateTime.makeUnsafe({ day: 30, month: 12, year: 1899 });
/** The months as an Indonesian date text names them. */
const MONTHS = [
  "januari",
  "februari",
  "maret",
  "april",
  "mei",
  "juni",
  "juli",
  "agustus",
  "september",
  "oktober",
  "november",
  "desember",
];

/** A date written as `YYYY-MM-DD`. */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** A date written as `DD/MM/YYYY` or `DD-MM-YYYY`. */
const LOCAL_DATE = /^(\d{2})[/-](\d{2})[/-](\d{4})$/;
/** A date written as `D Month YYYY`, with the month's Indonesian name. */
const NAMED_DATE = /^(\d{1,2}) ([a-z]+) (\d{4})$/;
/** A run of white space inside a header text. */
const SPACES = /\s+/g;

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
    birth: position(HEADERS.birth),
    cohort: position(HEADERS.cohort),
    name: position(HEADERS.name),
    nisn: position(HEADERS.nisn),
  };
  return Option.isSome(columns.name) && Option.isSome(columns.nisn)
    ? Option.some(columns)
    : Option.none();
};

/** Why one row of the sheet is not imported. */
export const RowProblem = Schema.Literals(["name", "nisn", "birth", "cohort"]);

/** One read row: the student it holds, or the problem that keeps it out, with its line in the sheet. */
export const ReadRow = Schema.Union([
  Schema.Struct({
    line: Schema.Finite,
    outcome: Schema.Literal("row"),
    row: ImportRow,
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

/** The date of a `[year, month, day]` triple, when it names a real day. */
const dayOf = (year: number, month: number, day: number) =>
  Option.filter(
    DateTime.make({ day, month, year }),
    (date) => DateTime.getPartUtc(date, "day") === day
  );

/**
 * A birth date: a date cell, a spreadsheet date number, or text as `YYYY-MM-DD`,
 * `DD/MM/YYYY`, `DD-MM-YYYY`, or `D Month YYYY` with the month's Indonesian name.
 */
const birthOf = (cell: Cell): Option.Option<DateTime.Utc> => {
  if (Predicate.isDate(cell)) {
    return DateTime.make(cell);
  }
  if (Predicate.isNumber(cell)) {
    return cell > 0 && Number.isInteger(cell)
      ? Option.some(DateTime.add(SERIAL_EPOCH, { days: cell }))
      : Option.none();
  }
  const text = keyOf(cell);
  const iso = ISO_DATE.exec(text);
  if (iso) {
    return dayOf(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  const local = LOCAL_DATE.exec(text);
  if (local) {
    return dayOf(Number(local[3]), Number(local[2]), Number(local[1]));
  }
  const named = NAMED_DATE.exec(text);
  return Option.flatMap(Option.fromNullishOr(named), ([, day, month, year]) =>
    Option.flatMap(
      Arr.findFirstIndex(MONTHS, (name) => name === month),
      (index) => dayOf(Number(year), index + 1, Number(day))
    )
  );
};

/**
 * Whether a student born on `birth` is under the age limit on `today`: the student has not
 * had the birthday of `AGE_LIMIT` years yet. Only this answer leaves the browser.
 */
export const isUnderAgeLimit = (birth: DateTime.Utc, today: DateTime.Utc) =>
  DateTime.isLessThan(today, DateTime.add(birth, { years: AGE_LIMIT }));

/** Reads one data row of the sheet into a student, or the problem with it. */
const readRow = (
  row: readonly Cell[],
  line: number,
  columns: Columns,
  today: DateTime.Utc
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
  const birthCell = Option.filter(
    Option.map(columns.birth, (index) => row[index]),
    (cell) => Predicate.isDate(cell) || Option.isSome(textOf(cell))
  );
  const birth = Option.flatMap(birthCell, birthOf);
  if (Option.isSome(birthCell) && Option.isNone(birth)) {
    return { line, outcome: "problem", problem: "birth" };
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
      // A row without a birth date counts as under the limit, as a roster row without a flag does.
      underAgeLimit: Option.match(birth, {
        onNone: () => true,
        onSome: (date) => isUnderAgeLimit(date, today),
      }),
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
export const SheetProblem = Schema.Literals(["header", "empty"]);

/** The answer of reading one sheet: its rows, or the problem that refuses it. */
const SheetRead = Schema.Union([
  Schema.Struct({
    outcome: Schema.Literal("read"),
    rows: Schema.Array(ReadRow),
  }),
  Schema.Struct({ outcome: Schema.Literal("refused"), problem: SheetProblem }),
]);

/**
 * Reads the rows of a Dapodik student list (ADR 0015). The header row is the first row that
 * names both the student's name and NISN, so the title rows above it are skipped, and only
 * the name, the NISN, the class group, and the birth date are read. The birth date turns into
 * the under-age flag here and is dropped, and no other column, the NIK and the parents' data
 * included, is read. A row that holds neither a name nor a NISN is skipped. A sheet without
 * that header, or without a student row below it, is refused.
 */
export function readDapodikSheet(
  rows: readonly (readonly Cell[])[],
  today: DateTime.Utc
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
        ? Option.some(readRow(row, index + offset + 2, columns, today))
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

/** The header and the rows of the export, which holds the columns the import reads, for a school to compare with Dapodik. */
export const EXPORT_HEADER = ["Nama", "NISN", "Rombel Saat Ini"];
