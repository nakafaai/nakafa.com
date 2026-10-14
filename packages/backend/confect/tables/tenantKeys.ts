import { Table } from "@confect/core";
import { TenantKey } from "@repo/backend/confect/vault/schema";

/**
 * One school's key per generation. `by_root` lets the rotation find the school
 * keys that a retired root key still wraps, in bounded reads (ADR 0030).
 */
export default Table.make(() => TenantKey)
  .index("by_tenantId_and_generation", ["tenantId", "generation"])
  .index("by_root", ["root"]);
