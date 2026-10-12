import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import type { NinaTurnTiming } from "@repo/backend/confect/nina/contract/turn";
import type { TextStreamPart, ToolSet } from "ai";
import { Array as Arr, Clock, Effect, MutableRef } from "effect";

/** The waits a turn stores. */
type Timing = typeof NinaTurnTiming.Type;

/** A stage that a run reaches while it works, after its claim has been stored. */
type Stage = Exclude<keyof Timing, "claimedMs">;

/** The parts that the page shows as the first sign that the model works. */
const SIGNS_OF_WORK = ["reasoning-start", "tool-input-start", "tool-call"];

/**
 * Milliseconds from the admission of a turn to `now`. A turn counts from its
 * creation, as its run deadline and the open-turn limit do, so every wait of a
 * turn has one start.
 */
export function sinceAdmission(
  turn: Pick<NinaTurnsDoc, "_creationTime">,
  now: number
) {
  return Math.max(0, now - turn._creationTime);
}

/**
 * The stages that one part of the model's stream reaches. Answer text counts
 * once it holds a word, because the page hides an empty text part.
 */
function stagesOf(part: TextStreamPart<ToolSet>): readonly Stage[] {
  if (part.type === "text-delta") {
    return part.text.trim().length > 0 ? ["progressMs", "tokenMs"] : [];
  }
  return Arr.contains(SIGNS_OF_WORK, part.type) ? ["progressMs"] : [];
}

/**
 * Notes when one run first reaches each stage of its turn. A stage keeps the
 * time of the first part that reached it, whichever step of the turn that was.
 * The run's own clock counts it, so a stage can differ from the database's
 * clock by the difference between the two. `reach` and `observe` are plain
 * functions because the AI SDK calls them from its callbacks.
 */
export const makeTiming = Effect.fn("nina.timing.make")(function* (
  turn: Pick<NinaTurnsDoc, "_creationTime">
) {
  const marks = MutableRef.make<Timing>({});
  const runSync = Effect.runSyncWith(yield* Effect.context<never>());

  function reach(stage: Stage) {
    if (MutableRef.get(marks)[stage] !== undefined) {
      return;
    }
    const at = sinceAdmission(turn, runSync(Clock.currentTimeMillis));
    MutableRef.update(marks, (current) => ({ ...current, [stage]: at }));
  }

  return {
    observe: (part: TextStreamPart<ToolSet>) =>
      Arr.forEach(stagesOf(part), reach),
    reach,
    /** What the run reached, without the claim, which the claim stored itself. */
    read: Effect.sync(() => MutableRef.get(marks)),
  };
});

/** The stages of one run, as `makeTiming` makes them. */
export type RunTiming = Effect.Success<ReturnType<typeof makeTiming>>;
