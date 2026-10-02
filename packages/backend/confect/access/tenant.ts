import { MiddlewareSpec } from "@confect/core";
import { TenantAction } from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Schema } from "effect";

/**
 * Checks a tenant-level action on the member's own tenant. No argument names
 * it: the member middleware already resolved the tenant from the route slug.
 */
export class TenantAccess extends MiddlewareSpec.MiddlewareSpec<
  TenantAccess,
  { requires: Member }
>()(
  "TenantAccess",
  Kind.spec(() => Schema.Struct({ action: TenantAction }))
) {}
