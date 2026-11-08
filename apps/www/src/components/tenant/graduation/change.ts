import type { OptimisticUpdate } from "@confect/react";
import records from "@repo/backend/confect/_generated/refs/records";
import { Option, Struct } from "effect";
import { changeLoaded } from "@/lib/data/loaded";

/**
 * Shows a recorded decision on graduation at once, on every loaded page of a graduating class
 * group of its period, with the letters it has issued so far, which stay none for a first
 * decision. A class group that does not graduate has no decision to show.
 */
export const decideChange: OptimisticUpdate<
  typeof records.graduations.decide
> = (localStore, args) => {
  const decision = Struct.omit(args, ["periodId", "slug"]);
  changeLoaded(localStore, records.graduations.get, (value) =>
    value._tag === "Graduating" && value.cohort.periodId === args.periodId
      ? Option.some({
          ...value,
          decision: { ...decision, issued: value.decision?.issued ?? 0 },
        })
      : Option.none()
  );
};
