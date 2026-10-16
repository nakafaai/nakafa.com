import { MiddlewareImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { Authority } from "@repo/backend/confect/access/policy";
import { Exam, ExamAccess } from "@repo/backend/confect/exams/access";
import { examKind } from "@repo/backend/confect/exams/kinds";
import { scopePlace } from "@repo/backend/confect/tenancy/authority";

/**
 * An exam sits where its scope puts it: an exam in a unit is locked by that unit's
 * archive, and a school-wide exam is locked only by the school's suspension, which the
 * decision already reads.
 */
export const examAuthority = Authority.make(
  examKind,
  Authority.load(examKind),
  {
    place: (row) => scopePlace(row.scope),
    relations: {},
    tenantOf: (row) => row.tenantId,
  }
);

/** Checks an exam action on the exam its access spec names, and provides the loaded exam to the function. */
export const examAccess = MiddlewareImpl.make(
  databaseSchema,
  ExamAccess,
  examAuthority.middleware(Exam)
);
