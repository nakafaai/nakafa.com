import { Id } from "@repo/backend/confect/_generated/id";
import { Kind } from "@repo/backend/confect/access/kind";
import type { RuleRole } from "@repo/backend/confect/access/schema";
import { cohort, period } from "@repo/backend/confect/tenancy/kinds";
import { Schema } from "effect";

/** The school roles that read the classes of their school. */
const classReaders: (typeof RuleRole.Type)[] = ["admin", "principal", "deputy"];

/**
 * One class: one subject taught to one cohort in one period. The Admin creates,
 * renames, archives, and assigns its subject teachers. The leaders of the school
 * read it, a subject teacher reads it through `subjectTeacher`, and a student
 * placed in its cohort, who holds a student grant over its unit, reads it through
 * `classMember`. An archived cohort, period, or unit locks the class.
 *
 * Its forum reads follow the class's readers. A topic channel is added by an
 * Admin or by a subject teacher of the class, and a locked class refuses it, so an
 * archived class keeps its channels readable and takes no new one. A member of the
 * class, a subject teacher, or an Admin writes messages; the school's other leaders
 * read them. Whoever manages the forum hides a message, which the journal records
 * without its text.
 */
export const classKind = Kind.make("class", "classes", {
  actions: {
    "class.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
    "class.view": {
      access: "read",
      grantedBy: "roles",
      relations: ["classMember", "subjectTeacher"],
      roles: classReaders,
    },
    "forum.manage": {
      access: "write",
      grantedBy: "roles",
      relations: ["subjectTeacher"],
      roles: ["admin"],
    },
    "forum.post": {
      access: "write",
      grantedBy: "roles",
      relations: ["classMember", "subjectTeacher"],
      roles: ["admin"],
    },
    "forum.read": {
      access: "read",
      grantedBy: "roles",
      relations: ["classMember", "subjectTeacher"],
      roles: classReaders,
    },
  },
  changes: [
    Schema.Struct({ type: Schema.Literal("class.created") }),
    Schema.Struct({ type: Schema.Literal("class.renamed") }),
    Schema.Struct({ type: Schema.Literal("class.archived") }),
    Schema.Struct({
      teacher: Id("tenantPeople"),
      type: Schema.Literal("class.teacherAssigned"),
    }),
    Schema.Struct({
      teacher: Id("tenantPeople"),
      type: Schema.Literal("class.teacherRemoved"),
    }),
    Schema.Struct({
      message: Id("classroomMessages"),
      type: Schema.Literal("message.hidden"),
    }),
  ],
  published: [],
  relations: ["classMember", "subjectTeacher"],
});

/** A class is created in its cohort, so an archived cohort, period, or unit refuses it. */
const cohortClasses = Kind.extend(cohort, {
  actions: {
    "class.create": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
  },
  changes: [],
  published: [],
});

/** A period's classes are listed on the period, so only the school's leaders list them. */
const periodClasses = Kind.extend(period, {
  actions: {
    "class.list": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: classReaders,
    },
  },
  changes: [],
  published: [],
});

/** The classroom module's kinds for the access catalog: the class, and its extensions on the cohort and the period. */
export const classroom = {
  extensions: [cohortClasses, periodClasses],
  kinds: [classKind],
};
