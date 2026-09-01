import { logger } from "@repo/backend/convex/utils/logger";
import { type Infer, v } from "convex/values";

/** Temporary capability marker used to observe the structured response switch. */
export const tryoutResponseContractValidator = v.optional(
  v.literal("structured")
);

type TryoutResponseContract = Infer<typeof tryoutResponseContractValidator>;

/** Records one real response consumer without learner or attempt identifiers. */
export function observeTryoutResponseContract(
  responseContract: TryoutResponseContract
) {
  logger.info("Observed try-out runtime response contract", {
    contract: responseContract ?? "predecessor",
  });
}
