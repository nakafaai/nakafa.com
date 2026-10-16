import { Table } from "@confect/core";
import { tenantGraduateValidator } from "@repo/backend/confect/tenancy/graduate";

export default Table.make(() => tenantGraduateValidator).index(
  "by_unitId_and_personId",
  ["unitId", "personId"]
);
