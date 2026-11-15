import {
  combineShards,
  type ProofResult,
  ShardResultJson,
} from "@repo/backend/scripts/content/acceptance/result";
import { sha256Hex } from "@repo/utilities/digest";
import { randomUuid } from "@repo/utilities/uuid";
import {
  Array as Arr,
  Context,
  DateTime,
  Duration,
  Effect,
  FileSystem,
  Layer,
  Option,
  Order,
  Predicate,
  Ref,
  Schedule,
  Schema,
} from "effect";
import { ChildProcessSpawner } from "effect/process";
import { runText } from "#scripts/process";
import { gh, ProofError, REPOSITORY, RunListJson } from "#scripts/proof/client";
import { sweepSuperseded } from "#scripts/proof/sweep";

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
const RunViewJson = Schema.fromJsonString(RunView);
const RUN_FIELDS = "status,conclusion,url,createdAt,updatedAt,jobs";
const RunStatusJson = Schema.fromJsonString(
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

/** The jobs of a run that ran: the gate job and one job per engine, less the part a dispatch turned off. */
const jobsOf = (run: RunView) =>
  Arr.filter(run.jobs, (job) => job.conclusion !== "skipped");

/** The steps of every job of a run that ran. */
const stepsOf = (run: RunView) => Arr.flatMap(jobsOf(run), (job) => job.steps);

/** Whether the run's gate passed, or none when it did not gate. */
function gateOf(run: RunView) {
  const steps = Arr.filter(stepsOf(run), (step) =>
    Arr.contains(GATE_STEPS, step.name)
  );
  return Arr.match(steps, {
    onEmpty: () => Option.none<boolean>(),
    onNonEmpty: (all) =>
      Option.some(Arr.every(all, (step) => step.conclusion === "success")),
  });
}

/**
 * The phases of a run in seconds, read from the steps of all its jobs. The
 * engines run side by side, so a phase runs from the first of its steps to
 * start to the last to end, and a phase that any job left unfinished has none.
 * The queue runs from the dispatch to the first job that started.
 */
export function runTimings(run: RunView) {
  const steps = stepsOf(run);
  const duration = (names: readonly string[]) => {
    const spans = Arr.filter(steps, (step) => Arr.contains(names, step.name));
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
    restored: Option.map(
      Arr.findFirst(steps, (one) => one.name === "Save the prepared runtime"),
      (one) => one.conclusion === "skipped"
    ),
    build: duration(["Build"]),
    specs: duration(["Run specs"]),
    total: Option.gen(function* () {
      return secondsOf(yield* created, yield* DateTime.make(run.updatedAt));
    }),
  };
}
export type RunTimings = ReturnType<typeof runTimings>;

/** Finds the run that one dispatch started, by the nonce in its name. */
const findRun = Effect.fn("proof.findRun")(function* (title: string) {
  const runs = yield* gh([
    "run",
    "list",
    "--repo",
    REPOSITORY,
    "--workflow",
    "proof.yml",
    "--event",
    "workflow_dispatch",
    "--limit",
    "50",
    "--json",
    "databaseId,displayTitle",
  ]).pipe(Effect.flatMap(Schema.decodeEffect(RunListJson)));
  return yield* Option.match(
    Arr.findFirst(runs, (run) => run.displayTitle === title),
    {
      onNone: () =>
        Effect.fail(new ProofError({ message: `No run is named ${title}.` })),
      onSome: (run) => Effect.succeed(run.databaseId),
    }
  );
});

/** The statuses GitHub keeps on one commit, read through GraphQL, whose budget is apart from REST's. */
const STATUS_QUERY =
  "query($owner:String!,$name:String!,$oid:GitObjectID!){repository(owner:$owner,name:$name){object(oid:$oid){... on Commit{status{contexts{context state targetUrl}}}}}}";

const StatusAnswerJson = Schema.fromJsonString(
  Schema.Struct({
    data: Schema.Struct({
      repository: Schema.Struct({
        object: Schema.NullOr(
          Schema.Struct({
            status: Schema.NullOr(
              Schema.Struct({
                contexts: Schema.Array(
                  Schema.Struct({
                    context: Schema.String,
                    state: Schema.String,
                    targetUrl: Schema.NullOr(Schema.String),
                  })
                ),
              })
            ),
          })
        ),
      }),
    }),
  })
);

/** Whether run `id` has posted its final `proof` status on the head it proves. */
const posted = Effect.fn("proof.posted")(function* (sha: string, id: number) {
  const answer = yield* gh([
    "api",
    "graphql",
    "-f",
    `query=${STATUS_QUERY}`,
    "-f",
    "owner=nakafaai",
    "-f",
    "name=nakafa.com",
    "-f",
    `oid=${sha}`,
  ]).pipe(Effect.flatMap(Schema.decodeEffect(StatusAnswerJson)));
  const contexts = answer.data.repository.object?.status?.contexts ?? [];
  return Arr.some(
    contexts,
    (status) =>
      status.context === "proof" &&
      status.state !== "PENDING" &&
      Option.exists(Option.fromNullishOr(status.targetUrl), (url) =>
        url.endsWith(`/runs/${id}`)
      )
  );
});

/** How many GraphQL looks pass between two REST reads of the run itself. */
const LOOKS_PER_RUN_READ = 5;

/**
 * Reads one run once it completes. While it runs, the waiter looks every two
 * minutes for its final `proof` status on the head through GraphQL, so waiting
 * proofs spend nothing of the REST limit that every session shares. It reads
 * the run itself once that status is posted, which is the job's last step, and
 * every fifth look, which ends the wait for a run cancelled before it posted.
 */
const awaitRun = Effect.fn("proof.awaitRun")(function* (
  id: number,
  sha: string
) {
  const view = (fields: string) =>
    gh(["run", "view", String(id), "--repo", REPOSITORY, "--json", fields]);
  const looks = yield* Ref.make(0);
  const done = Effect.gen(function* () {
    const look = yield* Ref.updateAndGet(looks, (count) => count + 1);
    if (!(yield* posted(sha, id)) && look % LOOKS_PER_RUN_READ !== 0) {
      return false;
    }
    const run = yield* view("status").pipe(
      Effect.flatMap(Schema.decodeEffect(RunStatusJson))
    );
    return run.status === "completed";
  });
  yield* done.pipe(
    Effect.repeat({
      until: (finished) => finished,
      schedule: Schedule.spaced("2 minutes"),
    })
  );
  return yield* view(RUN_FIELDS).pipe(
    Effect.flatMap(Schema.decodeEffect(RunViewJson))
  );
});

/**
 * The result of each engine that a completed run uploaded, one artifact per
 * engine job, which the CLI writes into a folder named after the artifact; an
 * engine whose build failed uploaded none.
 */
const readResults = Effect.fn("proof.readResults")(function* (id: number) {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "proof-" });
  const download = yield* runText("gh", [
    "run",
    "download",
    String(id),
    "--repo",
    REPOSITORY,
    "--pattern",
    "results-*",
    "--dir",
    directory,
  ]).pipe(
    Effect.mapError(
      () => new ProofError({ message: "The GitHub CLI could not start." })
    )
  );
  if (download.code !== 0) {
    return [];
  }
  const names = yield* fs.readDirectory(directory);
  return yield* Effect.forEach(names, (name) =>
    fs
      .readFileString(`${directory}/${name}/result.json`)
      .pipe(Effect.flatMap(Schema.decodeEffect(ShardResultJson)))
  );
}, Effect.scoped);

/** What one run verifies: the gate, every workspace or only those the head changes, or neither. */
const Scope = Schema.Struct({ gate: Schema.Boolean, full: Schema.Boolean });

/** What `gh run list --json databaseId,displayTitle,conclusion` prints: a run in progress has no conclusion yet. */
const ConcludedRunListJson = Schema.fromJsonString(
  Schema.Array(
    Schema.Struct({
      conclusion: Schema.String,
      databaseId: Schema.Int,
      displayTitle: Schema.String,
    })
  )
);

/**
 * The name a proof of a head on its specs alone carries: the head, then `base-`
 * and the first 16 hexadecimal digits of the SHA-256 of its spec files in path
 * order, so every caller that proves the same head on the same specs, such as
 * the merge groups that fail on main's reds, finds the one run.
 */
const proofPrefix = Effect.fn("proof.proofPrefix")(function* (
  sha: string,
  specs: readonly string[]
) {
  const digest = yield* sha256Hex(Arr.join(Arr.sort(specs, Order.String), " "));
  return `Proof ${sha} base-${digest.slice(0, 16)}`;
});

/**
 * A run that proves the same head on the same specs, finished or still running,
 * to read instead of dispatching another: a cancelled run proves nothing, so it
 * is passed over.
 */
const findReusableRun = Effect.fn("proof.findReusableRun")(function* (
  prefix: string
) {
  const runs = yield* gh([
    "run",
    "list",
    "--repo",
    REPOSITORY,
    "--workflow",
    "proof.yml",
    "--event",
    "workflow_dispatch",
    "--limit",
    "50",
    "--json",
    "databaseId,displayTitle,conclusion",
  ]).pipe(Effect.flatMap(Schema.decodeEffect(ConcludedRunListJson)));
  return Option.map(
    Arr.findFirst(
      runs,
      (run) =>
        run.displayTitle.startsWith(prefix) && run.conclusion !== "cancelled"
    ),
    (run) => run.databaseId
  );
});

/**
 * Dispatches one proof run and finds it by the nonce it was given: a fresh one,
 * after the specs' prefix for a proof of the specs alone, so a later run never
 * takes a cancelled one's name.
 */
const dispatchProof = Effect.fn("proof.dispatchProof")(function* (
  sha: string,
  specs: readonly string[],
  scope: typeof Scope.Type,
  prefix: Option.Option<string>
) {
  yield* sweepSuperseded();
  const uuid = yield* randomUuid;
  const title = Option.match(prefix, {
    onNone: () => `Proof ${sha} ${uuid}`,
    onSome: (name) => `${name}-${uuid.slice(0, 8)}`,
  });
  const nonce = title.slice(`Proof ${sha} `.length);
  yield* gh([
    "workflow",
    "run",
    "proof.yml",
    "--repo",
    REPOSITORY,
    "--ref",
    "main",
    "-f",
    `sha=${sha}`,
    "-f",
    `specs=${Arr.join(specs, " ")}`,
    "-f",
    `gate=${scope.gate}`,
    "-f",
    `full=${scope.full}`,
    "-f",
    `nonce=${nonce}`,
  ]);
  return yield* findRun(title).pipe(
    Effect.retry({ schedule: Schedule.spaced("5 seconds"), times: 24 })
  );
});

/**
 * Verifies one head on GitHub's runners in one run: dispatches the proof
 * workflow, waits for its run and reads what it reported. The verdicts are the
 * ones the run posts as commit statuses on the head. A proof of the specs alone
 * (no gate) is named by its head and its specs (`proofPrefix`) and first looks
 * for such a run, finished or running, so main's failing specs are proven once
 * per main commit however many merge groups fail on them.
 */
export const proveOnGithub = Effect.fn("proof.proveOnGithub")(
  function* (sha: string, specs: readonly string[], scope: typeof Scope.Type) {
    const prefix = scope.gate
      ? Option.none<string>()
      : Option.some(yield* proofPrefix(sha, specs));
    const reused = Option.isSome(prefix)
      ? yield* findReusableRun(prefix.value)
      : Option.none<number>();
    const id = Option.isSome(reused)
      ? reused.value
      : yield* dispatchProof(sha, specs, scope, prefix);
    const run = yield* awaitRun(id, sha);
    const results = yield* readResults(id).pipe(
      Effect.mapError(
        (cause) =>
          new ProofError({
            message: `The results of run ${id}: ${cause.message}`,
          })
      )
    );
    return {
      result: combineShards(sha, run.url, 1, results),
      gated: gateOf(run),
      timings: runTimings(run),
      cancelled: run.conclusion === "cancelled",
    };
  },
  Effect.catchTag("SchemaError", (error) =>
    Effect.fail(
      new ProofError({
        message: `GitHub answered unexpectedly: ${error.message}`,
      })
    )
  )
);

/** How many times the prover dispatches a run again after it was cancelled from outside. */
const REDISPATCHES = 3;

/**
 * The seam a baseline proves main through: prove one exact head in the
 * browsers, narrowed to some spec files or not, and answer one verdict per
 * engine.
 */
export class Prover extends Context.Service<
  Prover,
  {
    readonly prove: (
      sha: string,
      specs: readonly string[]
    ) => Effect.Effect<ProofResult, ProofError>;
  }
>()("nakafa/scripts/proof/github/Prover") {}

/**
 * The prover that runs every proof on GitHub's runners without the gate. A run
 * cancelled from outside, such as one a session moved back in the runner
 * queue, is dispatched again instead of read as a failure.
 */
export const githubProver = Layer.effect(
  Prover,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    return {
      prove: (sha, specs) =>
        proveOnGithub(sha, specs, { gate: false, full: false }).pipe(
          Effect.repeat({
            until: (outcome) => !outcome.cancelled,
            times: REDISPATCHES,
          }),
          Effect.map(({ result }) => result),
          Effect.provideService(FileSystem.FileSystem, fs),
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            spawner
          )
        ),
    };
  })
);
