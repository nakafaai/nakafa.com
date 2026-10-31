import type { OptimisticUpdate } from "@confect/react";
import records from "@repo/backend/confect/_generated/refs/records";
import { Option, Struct } from "effect";

/**
 * Shows a recorded decision on graduation at once, on every loaded page of a class group of its
 * period, with the letters it has issued so far, which stay none for a first decision.
 */
export const decideChange: OptimisticUpdate<
  typeof records.graduations.decide
> = (localStore, args) => {
  const decision = Struct.omit(args, ["periodId", "slug"]);
  for (const query of localStore.getAllQueries(records.graduations.get)) {
    if (
      Option.isSome(query.value) &&
      query.value.value.cohort.periodId === args.periodId
    ) {
      localStore.setQuery(
        records.graduations.get,
        query.args,
        Option.some({
          ...query.value.value,
          decision: {
            ...decision,
            issued: query.value.value.decision?.issued ?? 0,
          },
        })
      );
    }
  }
};
