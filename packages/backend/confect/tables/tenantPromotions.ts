import { Table } from "@confect/core";
import { tenantPromotionValidator } from "@repo/backend/confect/tenancy/promotion";

export default Table.make(() => tenantPromotionValidator)
  .index("by_sourcePeriodId_and_state", ["sourcePeriodId", "state"])
  .index("by_targetPeriodId_and_state", ["targetPeriodId", "state"]);
