import { Kind } from "@repo/backend/confect/access/kind";
import type { RuleRole } from "@repo/backend/confect/access/schema";
import { tenant, unit } from "@repo/backend/confect/tenancy/kinds";

/** The school roles that view and edit the exams of their school, within each exam's scope. */
const examEditors: (typeof RuleRole.Type)[] = ["admin", "teacher"];

/**
 * One school exam draft. Its scope is the tenant or one unit, and an Owner, an Admin,
 * or a Teacher whose grant covers the scope may view and edit it. An archived unit
 * locks the edits of its exams. A student and an integration client reach neither
 * action.
 */
export const examKind = Kind.make("exam", "exams", {
  actions: {
    "exam.edit": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: examEditors,
    },
    "exam.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: examEditors,
    },
  },
  changes: [],
  published: [],
  relations: [],
});

/**
 * Creating an exam is decided on the scope it covers, as a document is: the tenant
 * for a tenant-wide exam, the unit for a unit exam. The tenant and the unit each take
 * the `exam.edit` action of their own.
 */
const tenantExams = Kind.extend(tenant, {
  actions: {
    "exam.edit": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: examEditors,
    },
  },
  changes: [],
  published: [],
});

const unitExams = Kind.extend(unit, {
  actions: {
    "exam.edit": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: examEditors,
    },
  },
  changes: [],
  published: [],
});

/**
 * The exams module's kinds for the access catalog: the exam, and its extensions on the
 * tenant and the unit.
 */
export const exam = {
  extensions: [tenantExams, unitExams],
  kinds: [examKind],
};
