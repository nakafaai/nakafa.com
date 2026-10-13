import type {
  CapabilityArtifactSchema,
  CapabilityOutcomeSchema,
  CapabilityOutputSchema,
} from "@repo/backend/client/nina/capability";
import { TextOnlyCapabilitySchema } from "@repo/backend/confect/nina/capability/spec";
import { Array as Arr, Schema } from "effect";

type CapabilityArtifact = typeof CapabilityArtifactSchema.Type;

type CapabilityOutcome = typeof CapabilityOutcomeSchema.Type;

type CapabilityOutput = typeof CapabilityOutputSchema.Type;

const isTextOnly = Schema.is(TextOnlyCapabilitySchema);

/**
 * Keeps the outcome from contradicting the cards beside it. This is the one
 * rule for the outcome of a capability run: the runner settles a run with it
 * before the result is stored, and the page reads a stored result with it
 * (`readOutcome`), so a stored result and a fresh run agree. A card is loaded
 * once it settled without an error, whatever its own vocabulary calls that
 * (`done` for sources, `verified` for a calculation). A run that loaded a card
 * never ends as `failed`, and a run that lost a card never ends as plainly
 * done or empty: it is `partial` beside a loaded card and `failed` without
 * one. `limit` and `denied` are decisions, not results, and stay as stated. A
 * run with no card at all and no stated outcome is `empty`, whatever prose it
 * returned, because nothing it ran loaded evidence. A text-only capability
 * (`TextOnlyCapabilitySchema`) is the one exception: its answer is the text and
 * it has no card to show, so its run keeps the outcome it states, or none,
 * which reads as done.
 */
export function settleOutcome(
  outcome: CapabilityOutcome | undefined,
  artifacts: readonly CapabilityArtifact[],
  capability: string
): CapabilityOutcome | undefined {
  const loaded = Arr.some(
    artifacts,
    ({ data }) => data.status !== "loading" && data.status !== "error"
  );
  const lost = Arr.some(artifacts, ({ data }) => data.status === "error");
  const unstated = !outcome || outcome === "empty";
  if (loaded && (outcome === "failed" || (lost && unstated))) {
    return "partial";
  }
  if (!(outcome || loaded) && lost) {
    return "failed";
  }
  if (
    !(outcome || isTextOnly(capability)) &&
    Arr.isReadonlyArrayEmpty(artifacts)
  ) {
    return "empty";
  }
  return outcome;
}

/**
 * How a finished run reads: the outcome the rule settles, or `done` when it
 * settles none, because the run ran to its end with its evidence. A result
 * stored before the runner settled every outcome has none stored, and it reads
 * as a fresh run of its capability would be stored, so a run that gathered no
 * card is not shown as done.
 */
export function readOutcome(
  output: Pick<CapabilityOutput, "artifacts" | "outcome">,
  capability: string
): CapabilityOutcome | "done" {
  return settleOutcome(output.outcome, output.artifacts, capability) ?? "done";
}
