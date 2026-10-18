import { MiddlewareSpec } from "@confect/core";
import type {
  ExamSittingsDoc,
  ExamsDoc,
} from "@repo/backend/confect/_generated/docs";
import { entries } from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Context } from "effect";

/**
 * A sitting with its exam. The access check reads the exam once, and the decision and the
 * views of the sitting share that read (ADR 0013).
 */
export type SittingWithExam = ExamSittingsDoc & Record<"exam", ExamsDoc>;

/** The sitting that the function's `SittingAccess` check loaded and allowed, with its exam. */
export class Sitting extends Context.Service<Sitting, SittingWithExam>()(
  "@repo/backend/confect/exams/sittings/access/Sitting"
) {}

/** Checks a sitting action on the sitting whose ID the `arg` argument holds. */
export class SittingAccess extends MiddlewareSpec.MiddlewareSpec<
  SittingAccess,
  { provides: Sitting; requires: Member }
>()("SittingAccess", Kind.middleware(entries, "sitting")) {}
