import { Kind } from "@repo/backend/confect/access/kind";
import { classKind } from "@repo/backend/confect/classroom/kinds";
import { Schema } from "effect";

/**
 * Insight of a class (ADR 0035): its subject teachers and the school's Counselor and leaders read it, and only a
 * subject teacher names the competency of a question or writes a student's narrative.
 */
const classInsight = Kind.extend(classKind, {
  actions: {
    "insight.teach": {
      access: "write",
      grantedBy: "relations",
      relations: ["subjectTeacher"],
    },
    "insight.view": {
      access: "read",
      grantedBy: "roles",
      relations: ["subjectTeacher"],
      roles: ["admin", "principal", "deputy", "counselor"],
    },
  },
  changes: [
    Schema.Struct({ type: Schema.Literal("insight.narrative.shared") }),
    Schema.Struct({ type: Schema.Literal("insight.narrative.withdrawn") }),
  ],
  published: [],
});

export const insight = {
  extensions: [classInsight],
  kinds: [],
};
