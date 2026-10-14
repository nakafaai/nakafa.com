import { Table } from "@confect/core";
import { tenantVisitValidator } from "@repo/backend/confect/operators/schema";

/**
 * The visits of operators to schools. The school's requests, its open visits, and
 * the approved visits whose term ends are each read on their own index.
 */
export default Table.make(() => tenantVisitValidator)
  .index("by_tenantId_and_operatorId_and_state_status", [
    "tenantId",
    "operatorId",
    "state.status",
  ])
  .index("by_tenantId_and_state_status", ["tenantId", "state.status"])
  .index("by_state_status_and_state_expiresAt", [
    "state.status",
    "state.expiresAt",
  ]);
