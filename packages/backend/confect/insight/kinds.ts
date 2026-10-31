import { Kind } from "@repo/backend/confect/access/kind";
import { classKind } from "@repo/backend/confect/classroom/kinds";
import { tenant } from "@repo/backend/confect/tenancy/kinds";
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

/** The school's impact assessment, which switches Insight on: its Owner and Admin record it, and the change is journaled. */
const schoolInsight = Kind.extend(tenant, {
  actions: {
    "insight.dpia": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
  },
  changes: [
    Schema.Struct({
      type: Schema.Literal("insight.dpia.recorded"),
      version: Schema.String,
    }),
  ],
  published: [],
});

export const insight = {
  extensions: [classInsight, schoolInsight],
  kinds: [],
};
