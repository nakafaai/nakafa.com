import { Table } from "@confect/core";
import { ConnectorKey } from "@repo/backend/confect/vault/schema";

/**
 * The connectors' one key, always stored as `primary` and read through `by_key`.
 * `by_root` lets the rotation find it while a retired root key still wraps it (ADR
 * 0030).
 */
export default Table.make(() => ConnectorKey)
  .index("by_key", ["key"])
  .index("by_root", ["root"]);
