import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { RETIRED_PROGRAM_INVENTORY } from "@repo/backend/convex/contentRelease/cutover/inventory";
import type { retiredProgramZeroReceiptValidator } from "@repo/backend/convex/contentRelease/cutover/schema";
import { RETIRED_PROGRAM_ZERO_RECEIPT_VERSION } from "@repo/backend/convex/contentRelease/cutover/schema";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import type { Infer } from "convex/values";
import { Effect } from "effect";

export type RetiredProgramZeroReceipt = Infer<
  typeof retiredProgramZeroReceiptValidator
>;

export const RETIRED_PROGRAM_ZERO_RECEIPT = {
  learningPlanItems: 0,
  learningPlans: 0,
  learningProfiles: 0,
  learningProgramCoverage: 0,
  learningProgramSources: 0,
  learningPrograms: 0,
  version: RETIRED_PROGRAM_ZERO_RECEIPT_VERSION,
} satisfies RetiredProgramZeroReceipt;

/** Proves every retired learning-program table is empty in one transaction. */
export const proveRetiredProgramTablesEmpty = Effect.fn(
  "contentRelease.cutover.proveRetiredProgramTablesEmpty"
)(function* (ctx: MutationCtx) {
  for (const { table } of RETIRED_PROGRAM_INVENTORY) {
    const row = yield* Effect.promise(() => ctx.db.query(table).first());
    if (row) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Cutover writer quiescence: ${table} is not empty.`
      );
    }
  }
  return RETIRED_PROGRAM_ZERO_RECEIPT;
});

/** Requires the schema-authenticated zero receipt before later cutover phases. */
export const requireRetiredProgramZeroReceipt = Effect.fn(
  "contentRelease.cutover.requireRetiredProgramZeroReceipt"
)(function* (receipt: RetiredProgramZeroReceipt | undefined) {
  if (!receipt) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "The retired learning-program zero receipt is missing."
    );
  }
  return receipt;
});
