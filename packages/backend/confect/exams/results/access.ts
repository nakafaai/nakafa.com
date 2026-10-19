import { MiddlewareSpec } from "@confect/core";
import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import { entries } from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Context } from "effect";

/** The sitting whose results the function's `ResultAccess` check loaded and allowed. */
export class ResultSitting extends Context.Service<
  ResultSitting,
  ExamSittingsDoc
>()("@repo/backend/confect/exams/results/access/ResultSitting") {}

/** Checks a result action on the sitting whose ID the `sittingId` argument holds. */
export class ResultAccess extends MiddlewareSpec.MiddlewareSpec<
  ResultAccess,
  { provides: ResultSitting; requires: Member }
>()("ResultAccess", Kind.middleware(entries, "result")) {}
