import type {
  PromotionProgress,
  PromotionStep,
} from "@repo/backend/confect/tenancy/promotion/schema";
import { Array as Arr, Duration, Option, Schema } from "effect";

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

/**
 * Each step reads and writes one page of students, so one transaction stays small.
 * The chain runs one page after another until the last student is placed. The submit
 * check reads the moves at the same size, and a promotion holds at most
 * PROMOTION_MOVE_LIMIT of them, so that check reads a bounded set too.
 */
export const PROMOTION_PAGE_SIZE = 100;

/**
 * How long a run may go without a write before it counts as stopped. Each page is one
 * mutation that writes `movedAt` and schedules the next page, so a live run's silence
 * between two writes is one page plus the scheduler's dispatch. Two minutes is a
 * judgment, not a measurement: it leaves room for a slow page or a late dispatch. A run
 * silent for longer has stopped without recording a failure, such as a database defect
 * that rolled its transaction back. Convex's one-second limit covers user code only, not
 * database time, so it does not bound a page.
 */
export const PROMOTION_RUN_LEASE = Duration.minutes(2);

/** The progress of a promotion no step runs for and none has stopped at. */
export const IDLE_PROGRESS: typeof PromotionProgress.Type = {
  cursor: null,
  direction: null,
  done: [],
  failure: null,
  movedAt: 0,
  running: false,
  step: null,
};

/**
 * Whether a run says it is running but has not moved for the lease by `now`. Such a
 * run counts as stopped, so the next apply or undo can take it over.
 */
export const isStalled = (
  progress: typeof PromotionProgress.Type,
  now: number
) =>
  progress.running &&
  now - progress.movedAt >= Duration.toMillis(PROMOTION_RUN_LEASE);

/** The step that follows each step; the last step has none. */
const FOLLOWING_STEP: Record<
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
  Option.fromUndefinedOr(FOLLOWING_STEP[step]);

/**
 * Whether a run has stopped: it stopped with a typed failure, or it stalled. A
 * stalled run is stopped as far as the next apply or undo is concerned.
 */
const stopped = (progress: typeof PromotionProgress.Type, stalled: boolean) =>
  stalled || (!progress.running && progress.failure !== null);

/**
 * Where a run in one direction starts from a promotion's progress, if it can start,
 * and which steps are done when it does. A stopped run resumes at its own step and
 * page. Applying from idle starts the step after the last one done, and undoing from
 * idle undoes the last one done. A stopped apply can be undone, which undoes the
 * steps it finished. A stopped place step that had finished a page also undoes the
 * placements of those pages first, so the cohorts they fill do not block the undo.
 * Nothing starts while a run is in flight and has not stalled, or when a stopped undo
 * must finish before applying.
 */
export const resumePoint = (
  progress: typeof PromotionProgress.Type,
  direction: "apply" | "undo",
  stalled: boolean
) => {
  if (progress.running && !stalled) {
    return Option.none();
  }
  if (progress.step !== null && stopped(progress, stalled)) {
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
  progress: typeof PromotionProgress.Type,
  stalled: boolean
): Option.Option<typeof PromotionStep.Type> =>
  progress.direction === "apply" &&
  stopped(progress, stalled) &&
  progress.done.length === 0
    ? Option.fromNullishOr(progress.step)
    : Option.none();
