import { SourcedRow } from "@repo/backend/confect/roster/schema";
import { CohortName } from "@repo/backend/confect/tenancy/cohort";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
import {
  Array as Arr,
  HashMap,
  HashSet,
  Option,
  pipe,
  Record as Rec,
  Schema,
  String as Str,
  Tuple,
} from "effect";
import type { ReadRow, SheetRead } from "@/components/tenant/roster/dapodik";

/** The files of a OneRoster bundle that the import reads: never the demographics or the orgs. */
const BUNDLE_FILES = ["classes.csv", "enrollments.csv", "users.csv"];

/** Whether a file of a zip is one the import reads, at the top of the bundle. */
export const isBundleFile = (name: string) => Arr.contains(BUNDLE_FILES, name);

/** One line of a CSV file, by its header's names in lower case. */
type Line = Rec.ReadonlyRecord<string, string>;

/**
 * Splits CSV text into its fields (RFC 4180): a quoted field holds commas, line breaks, and
 * doubled quotes. Effect has no CSV codec, and the import reads three files of known shape.
 */
export function parseCsv(text: string) {
  const lines: string[][] = [];
  let line: string[] = [];
  let field = "";
  let quoted = false;
  const closeField = () => {
    line.push(field);
    field = "";
  };
  const closeLine = () => {
    closeField();
    lines.push(line);
    line = [];
  };
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      closeField();
    } else if (character === "\n") {
      closeLine();
    } else if (character !== "\r") {
      field += character;
    }
  }
  if (field !== "" || !Arr.isArrayEmpty(line)) {
    closeLine();
  }
  return lines;
}

/** The byte order mark a spreadsheet writes at the start of a CSV file. */
const BOM = /^﻿/u;

/** The lines of one CSV file, each by its header's names in lower case. */
const linesOf = (text: string): readonly Line[] => {
  const [header = [], ...rows] = parseCsv(Str.replace(BOM, "")(text));
  const names = Arr.map(header, (name) => Str.toLowerCase(Str.trim(name)));
  return Arr.map(rows, (row) =>
    Rec.fromEntries(
      Arr.map(Arr.zip(names, row), ([name, value]) => [name, Str.trim(value)])
    )
  );
};

/** One field of a line, or nothing when the line leaves it empty. */
const fieldOf = (line: Line, name: string) =>
  Option.filter(Rec.get(line, name), Str.isNonEmpty);

/** Whether a line is in force: OneRoster marks a line it withdrew as `tobedeleted`. */
const isInForce = (line: Line) =>
  !Option.contains(
    Option.map(fieldOf(line, "status"), Str.toLowerCase),
    "tobedeleted"
  );

/** Whether a line gives this role: an enrollment's role, or a user's in OneRoster 1.1. */
const hasRole = (line: Line, role: string) =>
  Option.contains(Option.map(fieldOf(line, "role"), Str.toLowerCase), role);

/** The student enrollments of a bundle, one user to each of their classes. */
const studentEnrollments = (lines: readonly Line[]) =>
  Arr.getSomes(
    Arr.map(lines, (line) =>
      isInForce(line) && hasRole(line, "student")
        ? Option.all({
            classId: fieldOf(line, "classsourcedid"),
            userId: fieldOf(line, "usersourcedid"),
          })
        : Option.none()
    )
  );

/** The homeroom classes of a bundle by their identity, each with its title. */
const homeroomsOf = (lines: readonly Line[]) =>
  HashMap.fromIterable(
    Arr.getSomes(
      Arr.map(lines, (line) =>
        isInForce(line) &&
        Option.contains(
          Option.map(fieldOf(line, "classtype"), Str.toLowerCase),
          "homeroom"
        )
          ? Option.all([fieldOf(line, "sourcedid"), fieldOf(line, "title")])
          : Option.none()
      )
    )
  );

/** A user's full name, from the given and the family name that a user line holds. */
const nameOf = (line: Line) =>
  pipe(
    Arr.getSomes([fieldOf(line, "givenname"), fieldOf(line, "familyname")]),
    Arr.join(" ")
  );

/**
 * Reads the students of a OneRoster CSV bundle (ADR 0029). The row's identity is the source's
 * `sourcedId`, never the email. A user is a student by an enrollment with the role, or by the
 * `role` of their own line, and the class group is the title of their homeroom class. Withdrawn
 * lines, and teachers and other roles, stay out. A file without the columns, or without a
 * student, is refused.
 */
export function readOneRoster(
  bundle: Rec.ReadonlyRecord<string, string>
): typeof SheetRead.Type {
  const file = (name: string) =>
    linesOf(Option.getOrElse(Rec.get(bundle, name), () => ""));
  const users = file("users.csv");
  const header = Arr.flatMap(Arr.take(users, 1), Rec.keys);
  if (
    !(
      Arr.contains(header, "sourcedid") &&
      Arr.contains(header, "givenname") &&
      Arr.contains(header, "familyname")
    )
  ) {
    return { outcome: "refused", problem: "header" };
  }
  const homerooms = homeroomsOf(file("classes.csv"));
  const enrollments = studentEnrollments(file("enrollments.csv"));
  const students = HashSet.fromIterable(
    Arr.map(enrollments, (enrollment) => enrollment.userId)
  );
  const cohorts = HashMap.fromIterable(
    Arr.getSomes(
      Arr.map(enrollments, ({ classId, userId }) =>
        Option.map(HashMap.get(homerooms, classId), (title) =>
          Tuple.make(userId, title)
        )
      )
    )
  );
  const rows = Arr.getSomes(
    Arr.map(users, (user, index) =>
      Option.flatMap(fieldOf(user, "sourcedid"), (sourcedId) =>
        isInForce(user) &&
        (HashSet.has(students, sourcedId) || hasRole(user, "student"))
          ? Option.some(rowOf(user, sourcedId, cohorts, index + 2))
          : Option.none()
      )
    )
  );
  if (Arr.isReadonlyArrayEmpty(rows)) {
    return { outcome: "refused", problem: "empty" };
  }
  return { outcome: "read", rows };
}

/** One student's row of the preview, or the problem that keeps it out. */
const rowOf = (
  user: Line,
  sourcedId: string,
  cohorts: HashMap.HashMap<string, string>,
  line: number
): typeof ReadRow.Type => {
  const name = Schema.decodeOption(PersonName)(nameOf(user));
  if (Option.isNone(name)) {
    return { line, outcome: "problem", problem: "name" };
  }
  const title = HashMap.get(cohorts, sourcedId);
  const cohort = Option.flatMap(title, Schema.decodeOption(CohortName));
  if (Option.isSome(title) && Option.isNone(cohort)) {
    return { line, outcome: "problem", problem: "cohort" };
  }
  const row = Schema.decodeOption(SourcedRow)({
    ...Option.match(cohort, {
      onNone: () => ({}),
      onSome: (cohortName) => ({ cohortName }),
    }),
    name: name.value,
    sourcedId,
  });
  return Option.match(row, {
    onNone: () => ({ line, outcome: "problem", problem: "name" }),
    onSome: (student) => ({ line, outcome: "sourced", row: student }),
  });
};
