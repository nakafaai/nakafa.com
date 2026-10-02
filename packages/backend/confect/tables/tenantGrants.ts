import { Table } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  GrantScope,
  GrantStatus,
  GrantTerm,
  RoleRef,
} from "@repo/backend/confect/access/schema";
import { Actor } from "@repo/backend/confect/journal/schema";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    grantedBy: Actor,
    personId: Id("tenantPeople"),
    role: RoleRef,
    scope: GrantScope,
    status: GrantStatus,
    tenantId: Id("tenants"),
    term: GrantTerm,
  })
)
  .index("by_personId_and_status", ["personId", "status"])
  .index("by_tenantId_and_role_key_and_status", [
    "tenantId",
    "role.key",
    "status",
  ])
  .index("by_status_and_term_kind_and_term_expiresAt", [
    "status",
    "term.kind",
    "term.expiresAt",
  ]);
