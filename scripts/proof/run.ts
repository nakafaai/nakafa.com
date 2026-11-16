import {
  Array as Arr,
  DateTime,
  Duration,
  Option,
  Predicate,
  Schema,
} from "effect";

const Step = Schema.Struct({
  name: Schema.String,
  conclusion: Schema.String,
  startedAt: Schema.NullOr(Schema.String),
  completedAt: Schema.NullOr(Schema.String),
});
const Job = Schema.Struct({
  name: Schema.String,
  conclusion: Schema.String,
  startedAt: Schema.NullOr(Schema.String),
  completedAt: Schema.NullOr(Schema.String),
  steps: Schema.Array(Step),
});
/** What `gh run view --json` reports of a proof run. */
const RunView = Schema.Struct({
  status: Schema.String,
  conclusion: Schema.String,
  url: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  jobs: Schema.Array(Job),
});
type RunView = typeof RunView.Type;
export const RunViewJson = Schema.fromJsonString(RunView);
export const RUN_FIELDS = "status,conclusion,url,createdAt,updatedAt,jobs";
export const RunStatusJson = Schema.fromJsonString(
  Schema.Struct({ status: Schema.String })
);

/** Moments that GitHub reports, or none when one is missing or there are none. */
const momentsOf = (stamps: readonly (string | null)[]) =>
  Option.flatMap(
    Option.all(Arr.map(stamps, (stamp) => DateTime.make(stamp ?? ""))),
    Arr.match({
      onEmpty: () => Option.none(),
      onNonEmpty: (moments) => Option.some(moments),
    })
  );

/** Whole seconds from one moment to another. */
const secondsOf = (from: DateTime.DateTime, to: DateTime.DateTime) =>
  Math.round(Duration.toSeconds(DateTime.distance(from, to)));

/** The steps of the gate, which pass only when every one of them does. */
const GATE_STEPS = ["Gate static", "Gate www", "Gate backend"];

/** The jobs of a run that ran: the gate job and the proof's machines, less the part a dispatch turned off. */
const jobsOf = (run: RunView) =>
  Arr.filter(run.jobs, (job) => job.conclusion !== "skipped");

/** The steps of every job of a run that ran. */
const stepsOf = (run: RunView) => Arr.flatMap(jobsOf(run), (job) => job.steps);

/** Whether the run's gate passed, or none when it did not gate. */
export function gateOf(run: RunView) {
  const steps = Arr.filter(stepsOf(run), (step) =>
    Arr.contains(GATE_STEPS, step.name)
  );
  return Arr.match(steps, {
    onEmpty: () => Option.none<boolean>(),
    onNonEmpty: (all) =>
      Option.some(Arr.every(all, (step) => step.conclusion === "success")),
  });
}

/** Whether a job prepared a runtime: an engine job that a small selection left to the Chromium job skipped it. */
const prepared = (job: RunView["jobs"][number]) =>
  Arr.some(
    job.steps,
    (step) => step.name === "Prepare" && step.conclusion !== "skipped"
  );

/**
 * The phases of a run in seconds, read from the steps of all its jobs. The
 * machines run side by side, so a phase runs from the first of its steps to
 * start to the last to end, and a phase that any job left unfinished has none.
 * A step a job skipped, as an engine job does when one machine runs all three
 * engines, counts for no phase. The queue runs from the dispatch to the first
 * job that started.
 */
export function runTimings(run: RunView) {
  const steps = stepsOf(run);
  const duration = (names: readonly string[]) => {
    const spans = Arr.filter(
      steps,
      (step) => step.conclusion !== "skipped" && Arr.contains(names, step.name)
    );
    return Option.gen(function* () {
      const starts = yield* momentsOf(Arr.map(spans, (span) => span.startedAt));
      const ends = yield* momentsOf(Arr.map(spans, (span) => span.completedAt));
      return secondsOf(
        Arr.min(starts, DateTime.Order),
        Arr.max(ends, DateTime.Order)
      );
    });
  };
  const created = DateTime.make(run.createdAt);
  const started = Arr.filter(
    Arr.map(jobsOf(run), (job) => job.startedAt),
    Predicate.isNotNull
  );
  return {
    queue: Option.gen(function* () {
      const first = Arr.min(yield* momentsOf(started), DateTime.Order);
      return secondsOf(yield* created, first);
    }),
    gate: duration(GATE_STEPS),
    prepare: duration(["Prepare"]),
    restored: Option.flatMap(Arr.findFirst(jobsOf(run), prepared), (job) =>
      Option.map(
        Arr.findFirst(
          job.steps,
          (one) => one.name === "Save the prepared runtime"
        ),
        (one) => one.conclusion === "skipped"
      )
    ),
    build: duration(["Build"]),
    specs: duration(["Run specs"]),
    total: Option.gen(function* () {
      return secondsOf(yield* created, yield* DateTime.make(run.updatedAt));
    }),
  };
}
export type RunTimings = ReturnType<typeof runTimings>;
