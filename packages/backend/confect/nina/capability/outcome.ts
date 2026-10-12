import type { CapabilityOutcomeSchema } from "@repo/backend/client/nina/capability";
import type { CapabilityArtifact } from "@repo/backend/confect/nina/capability/progress";
import { Array as Arr } from "effect";

type CapabilityOutcome = typeof CapabilityOutcomeSchema.Type;

/**
 * Keeps the outcome from contradicting the cards beside it, in the one place
 * where the stored outcome of a capability run is settled. A card is loaded
 * once it settled without an error, whatever its own vocabulary calls that
 * (`done` for sources, `verified` for a calculation). A run that loaded a card
 * never ends as `failed`, and a run that lost a card never ends as plainly
 * done or empty: it is `partial` beside a loaded card and `failed` without
 * one. `limit` and `denied` are decisions, not results, and stay as stated. A
 * run with no card at all and no stated outcome is `empty`, whatever prose it
 * returned, because nothing it ran loaded evidence; a text-only capability has
 * no card to show and keeps no outcome.
 */
export function settleOutcome(
  outcome: CapabilityOutcome | undefined,
  artifacts: readonly CapabilityArtifact[],
  textOnly: boolean
) {
  const loaded = Arr.some(
    artifacts,
    ({ data }) => data.status !== "loading" && data.status !== "error"
  );
  const lost = Arr.some(artifacts, ({ data }) => data.status === "error");
  const unstated = !outcome || outcome === "empty";
  if (loaded && (outcome === "failed" || (lost && unstated))) {
    return "partial" as const;
  }
  if (!(outcome || loaded) && lost) {
    return "failed" as const;
  }
  if (!(outcome || textOnly) && Arr.isReadonlyArrayEmpty(artifacts)) {
    return "empty" as const;
  }
  return outcome;
}
