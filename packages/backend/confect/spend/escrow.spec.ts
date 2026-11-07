import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Work } from "@repo/backend/confect/spend/rates";
import {
  Claim,
  Escrow,
  SpendRefused,
} from "@repo/backend/confect/spend/schema";
import { Schema } from "effect";

/** A whole number of micro-dollars, zero or more. */
const MicroUsd = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/**
 * The escrow of every metered call: `hold` before the call, in the
 * transaction that checks the payer's budget, and `settle` after it, to what
 * the call cost.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "hold",
      args: () => ({ claim: Claim, work: Work, held: MicroUsd }),
      returns: () => Escrow,
      error: () => SpendRefused,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "settle",
      args: () => ({ escrowId: Id("vendorEscrows"), spent: MicroUsd }),
      returns: () => Schema.Null,
    })
  );
