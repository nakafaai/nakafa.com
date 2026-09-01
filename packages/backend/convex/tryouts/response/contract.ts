import { type Infer, v } from "convex/values";
import { Effect } from "effect";

/** Temporary capability marker used to observe the structured response switch. */
export const tryoutResponseContractValidator = v.optional(
  v.literal("structured")
);

type TryoutResponseContract = Infer<typeof tryoutResponseContractValidator>;

/** Records one real response consumer without learner or attempt identifiers. */
export const observeTryoutResponseContract = Effect.fn(
  "tryouts.response.observeContract"
)((responseContract: TryoutResponseContract) =>
  Effect.logInfo("Observed try-out runtime response contract", {
    contract: responseContract ?? "predecessor",
  })
);
