import type {
  PromotionProgress,
  PromotionStep,
} from "@repo/backend/confect/tenancy/promotion/schema";
import { Array as Arr, Option, Schema } from "effect";

/** What one run of a step left: whether it read its last page, and where the next page starts. */
export const StepOutcome = Schema.Struct({
  complete: Schema.Boolean,
  cursor: Schema.NullOr(Schema.String),
});

/** The outcome of a step that finished in one run. */
export const finished: typeof StepOutcome.Type = {
  complete: true,
  cursor: null,
};

/** The progress of a promotion no step runs for and none has stopped at. */
export const IDLE_PROGRESS: typeof PromotionProgress.Type = {
  cursor: null,
  direction: null,
  done: [],
  failure: null,
  running: false,
  step: null,
};

/** The step that follows each step; the last step has none. */
const NEXT_STEP: Record<
  typeof PromotionStep.Type,
  typeof PromotionStep.Type | undefined
> = {
  archive: "cohorts",
  cohorts: "place",
  homeroom: undefined,
  place: "homeroom",
};

/** The step that follows another in applying a promotion, if any. */
export const nextStepOf = (step: typeof PromotionStep.Type) =>
  Option.fromUndefinedOr(NEXT_STEP[step]);

/**
 * Where a run in one direction starts from a promotion's progress, if it can start,
 * and which steps are done when it does. A stopped run resumes at its own step and
 * page. Applying from idle starts the step after the last one done, and undoing from
 * idle undoes the last one done. A stopped apply can be undone, which undoes the
 * steps it finished. A stopped place step that had finished a page also undoes the
 * placements of those pages first, so the cohorts they fill do not block the undo.
 * Nothing starts while a run is in flight, or when a stopped undo must finish before
 * applying.
 */
export const resumePoint = (
  progress: typeof PromotionProgress.Type,
  direction: "apply" | "undo"
) => {
  if (progress.running) {
    return Option.none();
  }
  if (progress.step !== null && progress.failure !== null) {
    if (progress.direction === direction) {
      return Option.some({
        cursor: progress.cursor,
        done: progress.done,
        step: progress.step,
      });
    }
    if (direction === "apply") {
      return Option.none();
    }
    if (
      progress.direction === "apply" &&
      progress.step === "place" &&
      progress.cursor !== null
    ) {
      const partial: typeof PromotionStep.Type = "place";
      return Option.some({
        cursor: null,
        done: Arr.append(progress.done, partial),
        step: partial,
      });
    }
  }
  const last = Arr.last(progress.done);
  if (direction === "undo") {
    return Option.map(last, (step) => ({
      cursor: null,
      done: progress.done,
      step,
    }));
  }
  return Option.map(Option.flatMap(last, nextStepOf), (step) => ({
    cursor: null,
    done: progress.done,
    step,
  }));
};

/** Whether applying a promotion finished: its last step is done and no run is in flight. */
export const applyFinished = (progress: typeof PromotionProgress.Type) =>
  !progress.running &&
  progress.failure === null &&
  Option.exists(Arr.last(progress.done), (step) =>
    Option.isNone(nextStepOf(step))
  );

/**
 * The step where an apply stopped before any step finished, if it did. Undoing such
 * an apply undoes no step and only returns the plan to approved, because the stopped
 * step wrote nothing before it stopped.
 */
export const stoppedBeforeAnyStep = (
  progress: typeof PromotionProgress.Type
): Option.Option<typeof PromotionStep.Type> =>
  progress.direction === "apply" &&
  !progress.running &&
  progress.failure !== null &&
  progress.done.length === 0
    ? Option.fromNullishOr(progress.step)
    : Option.none();
