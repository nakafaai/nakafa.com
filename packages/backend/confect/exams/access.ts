import { MiddlewareSpec } from "@confect/core";
import type { ExamsDoc } from "@repo/backend/confect/_generated/docs";
import { entries } from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Context } from "effect";

/** The exam that the function's `ExamAccess` check loaded and allowed. */
export class Exam extends Context.Service<Exam, ExamsDoc>()(
  "@repo/backend/confect/exams/access/Exam"
) {}

/** Checks an exam action on the exam whose ID the `arg` argument holds. */
export class ExamAccess extends MiddlewareSpec.MiddlewareSpec<
  ExamAccess,
  { provides: Exam; requires: Member }
>()("ExamAccess", Kind.middleware(entries, "exam")) {}
