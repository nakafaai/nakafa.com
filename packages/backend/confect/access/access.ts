import { MiddlewareSpec } from "@confect/core";
import type { TenantGrantsDoc } from "@repo/backend/confect/_generated/docs";
import { entries } from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Context } from "effect";

/** The grant that the function's `GrantAccess` check loaded and allowed. */
export class Grant extends Context.Service<Grant, TenantGrantsDoc>()(
  "@repo/backend/access/Grant"
) {}

/** Checks a grant action on the grant whose ID the `arg` argument holds. */
export class GrantAccess extends MiddlewareSpec.MiddlewareSpec<
  GrantAccess,
  { provides: Grant; requires: Member }
>()("GrantAccess", Kind.middleware(entries, "grant")) {}
