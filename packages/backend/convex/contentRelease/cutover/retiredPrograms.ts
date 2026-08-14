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
