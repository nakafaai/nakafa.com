import { MiddlewareSpec } from "@confect/core";
import type { TenantVisitsDoc } from "@repo/backend/confect/_generated/docs";
import { entries } from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Context } from "effect";

/** The visit that the function's `VisitAccess` check loaded and allowed. */
export class Visit extends Context.Service<Visit, TenantVisitsDoc>()(
  "@repo/backend/confect/operators/access/Visit"
) {}

/** Checks a visit action on the visit whose ID the `arg` argument holds. */
export class VisitAccess extends MiddlewareSpec.MiddlewareSpec<
  VisitAccess,
  { provides: Visit; requires: Member }
>()("VisitAccess", Kind.middleware(entries, "visit")) {}
