import {
  combineShards,
  ProofResult,
  ShardResultJson,
} from "@repo/backend/scripts/content/acceptance/result";
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
  Ref,
  Schedule,
  Schema,
} from "effect";
import { ChildProcessSpawner } from "effect/process";
import { runText } from "#scripts/process";
import { gh, ProofError, REPOSITORY, RunListJson } from "#scripts/proof/client";
import { sweepSuperseded } from "#scripts/proof/sweep";

/** The commit status that says whether a head fails anything main does not. */
export const VERDICT_CONTEXT = "proof/new";

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

/** Seconds between two moments that GitHub reports, or none when one is missing. */
const secondsBetween = (start: string | null, end: string | null) =>
  Option.gen(function* () {
    const from = yield* DateTime.make(start ?? "");
    const to = yield* DateTime.make(end ?? "");
    return Math.round(Duration.toSeconds(DateTime.distance(from, to)));
  });

/** The steps of the gate, which pass only when every one of them does. */
const GATE_STEPS = ["Gate static", "Gate www", "Gate backend"];

/** The steps of a run's one job, or none when it never started one. */
const stepsOf = (run: RunView) =>
  Option.match(Arr.head(run.jobs), {
    onNone: () => Arr.empty<typeof Step.Type>(),
    onSome: (job) => job.steps,
  });

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

/** The phases of a run in seconds, read from its one job's steps. */
export function runTimings(run: RunView) {
  const steps = stepsOf(run);
  const duration = (names: readonly string[]) => {
    const spans = Arr.filter(steps, (step) => Arr.contains(names, step.name));
    return Option.flatMap(Arr.head(spans), (first) =>
      Option.flatMap(Arr.last(spans), (last) =>
        secondsBetween(first.startedAt, last.completedAt)
      )
    );
  };
  return {
    queue: secondsBetween(
      run.createdAt,
      Option.getOrNull(
        Option.flatMap(Arr.head(run.jobs), (job) =>
          Option.fromNullishOr(job.startedAt)
        )
      )
    ),
    gate: duration(GATE_STEPS),
    prepare: duration(["Prepare"]),
    restored: Option.map(
      Arr.findFirst(steps, (one) => one.name === "Save the prepared runtime"),
      (one) => one.conclusion === "skipped"
    ),
    build: duration(["Build"]),
    specs: duration(["Run specs"]),
    total: secondsBetween(run.createdAt, run.updatedAt),
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

/** The result of each engine that a completed run uploaded; a run whose build failed has none. */
const readResults = Effect.fn("proof.readResults")(function* (id: number) {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "proof-" });
  const download = yield* runText("gh", [
    "run",
    "download",
    String(id),
    "--repo",
    REPOSITORY,
    "--name",
    "results",
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

/**
 * Verifies one head on GitHub's runners in one job: dispatches the proof
 * workflow, waits for its run and reads what it reported. The verdicts are the
 * ones the run posts as commit statuses on the head.
 */
export const proveOnGithub = Effect.fn("proof.proveOnGithub")(
  function* (sha: string, specs: readonly string[], scope: typeof Scope.Type) {
    yield* sweepSuperseded();
    const nonce = yield* randomUuid;
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
    const id = yield* findRun(`Proof ${sha} ${nonce}`).pipe(
      Effect.retry({ schedule: Schedule.spaced("5 seconds"), times: 24 })
    );
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

/** A combination's gate and proof, read from the one run that verified it. */
const Verification = Schema.Struct({
  gated: Schema.Boolean,
  result: ProofResult,
});

/**
 * The seam every caller of a proof uses: prove one exact head in the browsers,
 * narrowed to some spec files or not, or verify it whole, gate and proof in one
 * job, and answer one verdict per engine.
 */
export class Prover extends Context.Service<
  Prover,
  {
    readonly prove: (
      sha: string,
      specs: readonly string[]
    ) => Effect.Effect<ProofResult, ProofError>;
    readonly verify: (
      sha: string,
      specs: readonly string[]
    ) => Effect.Effect<typeof Verification.Type, ProofError>;
  }
>()("nakafa/scripts/proof/github/Prover") {}

/**
 * The prover that runs every proof on GitHub's runners: a proof alone, such as
 * main's baseline, skips the gate, and a verification gates the workspaces the
 * combination changes against main, which holds every head it merges.
 */
export const githubProver = Layer.effect(
  Prover,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const run = (
      sha: string,
      specs: readonly string[],
      scope: typeof Scope.Type
    ) =>
      proveOnGithub(sha, specs, scope).pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
      );
    return {
      prove: (sha, specs) =>
        run(sha, specs, { gate: false, full: false }).pipe(
          Effect.map(({ result }) => result)
        ),
      verify: (sha, specs) =>
        run(sha, specs, { gate: true, full: false }).pipe(
          Effect.map(({ result, gated }) => ({
            result,
            gated: Option.getOrElse(gated, () => false),
          }))
        ),
    };
  })
);

/**
 * Posts the verdict of a head against main: success when it fails nothing that
 * main does not, which the landing train reads beside the run's own statuses.
 */
export const postVerdict = Effect.fn("proof.postVerdict")(function* (
  sha: string,
  url: string,
  fresh: readonly string[],
  shared: readonly string[],
  main: string
) {
  const description =
    fresh.length > 0
      ? `${fresh.length} failing specs that main ${main.slice(0, 10)} passes`
      : `No new failure; ${shared.length} fail on main ${main.slice(0, 10)} too`;
  yield* gh([
    "api",
    "--silent",
    `repos/${REPOSITORY}/statuses/${sha}`,
    "-f",
    `state=${fresh.length > 0 ? "failure" : "success"}`,
    "-f",
    `context=${VERDICT_CONTEXT}`,
    "-f",
    `target_url=${url}`,
    "-f",
    `description=${description}`,
  ]);
});
