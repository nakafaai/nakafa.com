import { MiddlewareSpec } from "@confect/core";
import { TenantAction } from "@repo/backend/confect/access/catalog";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Schema } from "effect";

/**
 * Checks a tenant-level action on the member's own tenant. No argument names
 * it: the member middleware already resolved the tenant from the route slug.
 */
export class TenantAccess extends MiddlewareSpec.MiddlewareSpec<
  TenantAccess,
  { requires: Member }
>()("TenantAccess", {
  error: () => AccessDenied,
  functionTypes: { action: false, mutation: true, query: true },
  options: () => Schema.Struct({ action: TenantAction }),
}) {}
