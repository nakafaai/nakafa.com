import { MiddlewareSpec } from "@confect/core";
import type {
  ClassGradesDoc,
  ReportCardsDoc,
} from "@repo/backend/confect/_generated/docs";
import { entries } from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Context } from "effect";

/** The grade that the function's `GradeAccess` check loaded and allowed. */
export class Grade extends Context.Service<Grade, ClassGradesDoc>()(
  "@repo/backend/confect/records/access/Grade"
) {}

/** Checks a grade action on the grade whose ID the `arg` argument holds. */
export class GradeAccess extends MiddlewareSpec.MiddlewareSpec<
  GradeAccess,
  { provides: Grade; requires: Member }
>()("GradeAccess", Kind.middleware(entries, "grade")) {}

/** The report card that the function's `ReportAccess` check loaded and allowed. */
export class Report extends Context.Service<Report, ReportCardsDoc>()(
  "@repo/backend/confect/records/access/Report"
) {}

/** Checks a report action on the report card whose ID the `arg` argument holds. */
export class ReportAccess extends MiddlewareSpec.MiddlewareSpec<
  ReportAccess,
  { provides: Report; requires: Member }
>()("ReportAccess", Kind.middleware(entries, "report")) {}
