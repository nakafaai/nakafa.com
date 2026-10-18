import { MiddlewareSpec } from "@confect/core";
import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import { entries } from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Context } from "effect";

/** The sitting that the function's `SittingAccess` check loaded and allowed. */
export class Sitting extends Context.Service<Sitting, ExamSittingsDoc>()(
  "@repo/backend/confect/exams/sittings/access/Sitting"
) {}

/** Checks a sitting action on the sitting whose ID the `arg` argument holds. */
export class SittingAccess extends MiddlewareSpec.MiddlewareSpec<
  SittingAccess,
  { provides: Sitting; requires: Member }
>()("SittingAccess", Kind.middleware(entries, "sitting")) {}
