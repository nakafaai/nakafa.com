import { Table } from "@confect/core";
import { bucketUseValidator } from "@repo/backend/confect/bucket/use";

/** How many bytes the whole R2 bucket holds and has reserved, in one row. */
export default Table.make(() => bucketUseValidator);
