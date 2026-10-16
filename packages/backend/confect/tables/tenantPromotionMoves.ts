import { Table } from "@confect/core";
import { tenantPromotionMoveValidator } from "@repo/backend/confect/tenancy/promotion/schema";

export default Table.make(() => tenantPromotionMoveValidator).index(
  "by_promotionId_and_personId",
  ["promotionId", "personId"]
);
