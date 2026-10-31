import { Table } from "@confect/core";
import { classroomPassageValidator } from "@repo/backend/confect/classroom/passages";
import { embeddingDimensions } from "@repo/backend/confect/gateway/model";

/**
 * The passages of each class library's published files. It is a read model derived from the files: it can be deleted
 * and built again at any time (ADR 0023). The class is a filter the server sets, never one a client names.
 */
export default Table.make(() => classroomPassageValidator)
  .index("by_itemId", ["itemId"])
  .index("by_tenantId", ["tenantId"])
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: embeddingDimensions,
    filterFields: ["classId"],
  });
