import { Table } from "@confect/core";
import { vendorEscrowValidator } from "@repo/backend/confect/spend/schema";

/** One escrow per metered call, held before the call and settled after it. */
export default Table.make(() => vendorEscrowValidator);
