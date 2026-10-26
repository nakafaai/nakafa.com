import type { Ref } from "@confect/core";
import type { OptimisticLocalStore, OptimisticUpdate } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import records from "@repo/backend/confect/_generated/refs/records";
import { gradeView } from "@repo/backend/confect/records/grade";
import type { GradingScheme } from "@repo/backend/confect/records/scheme";
import { Array as Arr, Option, Schema } from "effect";
import { draftText } from "@/components/tenant/settings/state";

/** One line of a class's gradebook: a student and the grade they hold, or none yet. */
export type SheetLine = Ref.Returns<
  typeof records.grades.sheet
>["page"][number];

/** The class a gradebook belongs to. */
type ClassId = Ref.Args<typeof records.grades.sheet>["classId"];

/** The ID an entered grade holds until the server answers with its own. */
const draftGradeId = () =>
  Schema.decodeUnknownSync(Id("classGrades"))(draftText());

/** Changes the grade of one student on every loaded page of one class's gradebook. */
function changeLine(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  classId: ClassId,
  personId: SheetLine["student"]["id"],
  change: (grade: SheetLine["grade"]) => SheetLine["grade"]
) {
  for (const query of localStore.getAllQueries(records.grades.sheet)) {
    if (Option.isSome(query.value) && query.args.classId === classId) {
      localStore.setQuery(
        records.grades.sheet,
        query.args,
        Option.some({
          ...query.value.value,
          page: Arr.map(query.value.value.page, (line) =>
            line.student.id === personId
              ? { ...line, grade: change(line.grade) }
              : line
          ),
        })
      );
    }
  }
}

/**
 * Shows an entered value at once as the student's draft, judged by the scheme the next
 * entry is judged by, as the server judges it. A released grade stays as it is, because
 * the server refuses to change it.
 */
export function enterChange(
  scheme: GradingScheme
): OptimisticUpdate<typeof records.grades.enter> {
  return (localStore, { classId, personId, value }) =>
    changeLine(localStore, classId, personId, (grade) =>
      grade?.state === "released"
        ? grade
        : gradeView(
            {
              _id: grade?.id ?? draftGradeId(),
              classId,
              personId,
              state: "draft",
              value,
            },
            scheme
          )
    );
}

/** Shows a draft as released at once, on every loaded page of its class. */
export function releaseChange(
  classId: ClassId,
  personId: SheetLine["student"]["id"]
): OptimisticUpdate<typeof records.grades.release> {
  return (localStore) =>
    changeLine(localStore, classId, personId, (grade) =>
      grade === null ? grade : { ...grade, state: "released" }
    );
}
