import { Id } from "@repo/backend/confect/_generated/id";
import { Kind } from "@repo/backend/confect/access/kind";
import { classKind } from "@repo/backend/confect/classroom/kinds";
import { tenant } from "@repo/backend/confect/tenancy/kinds";
import { Schema } from "effect";

/**
 * One student's final grade in one class and period. The class's subject teachers
 * release it, and the release is journaled as `grade.released`. They read every
 * grade of the class, drafts included. A student reads only their own released
 * grade: the class member relation holds for that row and no other (ADR 0033).
 */
export const gradeKind = Kind.make("grade", "classGrades", {
  actions: {
    "grade.release": {
      access: "write",
      grantedBy: "relations",
      relations: ["subjectTeacher"],
    },
    "grade.view": {
      access: "read",
      grantedBy: "relations",
      relations: ["classMember", "subjectTeacher"],
    },
  },
  changes: [
    Schema.Struct({
      classId: Id("classes"),
      periodId: Id("tenantPeriods"),
      personId: Id("tenantPeople"),
      state: Schema.Literal("released"),
      type: Schema.Literal("grade.released"),
    }),
  ],
  published: ["grade.released"],
  relations: ["classMember", "subjectTeacher"],
});

/**
 * A subject teacher enters a draft for a student of the class and lists the class's
 * grades. The actions are ruled on the class, the subject that exists before its
 * first grade does, so the entry is refused with the class's own refusals.
 */
const classGrades = Kind.extend(classKind, {
  actions: {
    "grade.enter": {
      access: "write",
      grantedBy: "relations",
      relations: ["subjectTeacher"],
    },
    "grade.list": {
      access: "read",
      grantedBy: "relations",
      relations: ["subjectTeacher"],
    },
  },
  changes: [],
  published: [],
});

/**
 * An Admin stores a dated version of the school's grading scheme. The store is
 * journaled on the school with the version's ID alone, because the values of a
 * scheme never reach the journal (ADR 0016).
 */
const tenantSchemes = Kind.extend(tenant, {
  actions: {
    "scheme.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
  },
  changes: [
    Schema.Struct({
      scheme: Id("gradingSchemes"),
      type: Schema.Literal("scheme.stored"),
    }),
  ],
  published: [],
});

/** The records module's kinds for the access catalog: the grade, and its extensions on the class and the school. */
export const records = {
  extensions: [classGrades, tenantSchemes],
  kinds: [gradeKind],
};
