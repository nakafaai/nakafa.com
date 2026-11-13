import {
  combineShards,
  HeadSha,
  type ProofResult,
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
  HashSet,
  Layer,
  Option,
  Order,
  Schedule,
  Schema,
  String as Str,
} from "effect";
import { ChildProcessSpawner } from "effect/process";
import { runText } from "#scripts/process";

/** The repository whose proof workflow proves every head. */
export const REPOSITORY = "nakafaai/nakafa.com";

/** A proof that could not run, or whose run could not be read. */
export class ProofError extends Schema.TaggedError<
  ProofError,
  { readonly brand: unique symbol }
>()("ProofError", {
  message: Schema.String,
  /** Whether GitHub refused the call for the account's rate limit, which passes. */
  limited: Schema.optionalKey(Schema.Boolean),
}) {}

/** How many machines prove each engine, unless the caller names another count. */
export const DEFAULT_SHARDS = 3;

/** How many machines prove each engine of a proof narrowed to some specs, such as a rerun on main. */
const NARROW_SHARDS = 1;

/** The commit status that says whether a head fails anything main does not. */
export const VERDICT_CONTEXT = "proof/new";

/**
 * Whether GitHub refused a call for the account's API rate limit, which every
 * session on this account shares: 5,000 requests an hour.
 */
const RATE_LIMITED = /rate limit/iu;

/** One attempt of a GitHub CLI call: what it printed, or what it said. */
const ghOnce = Effect.fn("proof.ghOnce")(function* (args: readonly string[]) {
  const output = yield* runText("gh", args).pipe(
    Effect.mapError(
      () => new ProofError({ message: "The GitHub CLI could not start." })
    )
  );
  if (output.code !== 0) {
    return yield* new ProofError({
      message: `gh ${Arr.join(Arr.take(args, 2), " ")} failed: ${output.stderr.trim()}`,
      limited: RATE_LIMITED.test(output.stderr),
    });
  }
  return output.stdout;
});

/**
 * Runs the GitHub CLI and returns what it printed, or fails with what it said.
 * A call refused for the rate limit waits a minute and tries again, for as long
 * as the hourly limit takes to reset, so a long proof outlives a busy hour.
 */
export const gh = (args: readonly string[]) =>
  ghOnce(args).pipe(
    Effect.retry({
      while: (error) => error.limited === true,
      schedule: Schedule.spaced("1 minute"),
      times: 65,
    })
  );

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

const RunListJson = Schema.fromJsonString(
  Schema.Array(
    Schema.Struct({ databaseId: Schema.Int, displayTitle: Schema.String })
  )
);

/** Seconds between two moments that GitHub reports, or none when one is missing. */
const secondsBetween = (start: string | null, end: string | null) =>
  Option.gen(function* () {
    const from = yield* DateTime.make(start ?? "");
    const to = yield* DateTime.make(end ?? "");
    return Math.round(Duration.toSeconds(DateTime.distance(from, to)));
  });

/** The phases of a proof run in seconds, read from its jobs and steps. */
export function runTimings(run: RunView) {
  const build = Arr.findFirst(run.jobs, (job) => job.name === "Build");
  const step = (name: string) =>
    Option.flatMap(build, (job) =>
      Arr.findFirst(job.steps, (one) => one.name === name)
    );
  const duration = (name: string) =>
    Option.flatMap(step(name), (one) =>
      secondsBetween(one.startedAt, one.completedAt)
    );
  const starts = Arr.sort(
    Arr.filter(
      Arr.map(run.jobs, (job) => job.startedAt),
      (start): start is string => start !== null
    ),
    Order.String
  );
  const specs = Arr.getSomes(
    Arr.map(
      Arr.filter(run.jobs, (job) => job.name.startsWith("Specs ")),
      (job) =>
        Option.flatMap(
          Arr.findFirst(job.steps, (one) => one.name === "Run specs"),
          (one) => secondsBetween(one.startedAt, one.completedAt)
        )
    )
  );
  return {
    queue: secondsBetween(run.createdAt, starts[0] ?? null),
    prepare: duration("Prepare"),
    restored: Option.map(
      step("Save the prepared runtime"),
      (one) => one.conclusion === "skipped"
    ),
    build: duration("Build"),
    specs: Arr.match(specs, {
      onEmpty: () => Option.none<number>(),
      onNonEmpty: (all) => Option.some(Math.max(...all)),
    }),
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

/**
 * Reads one run once it completes. While it runs, only its status is read, once
 * every two minutes: one request, so many waiting proofs stay well inside the
 * rate limit that every session shares.
 */
const awaitRun = Effect.fn("proof.awaitRun")(function* (id: number) {
  const view = (fields: string) =>
    gh(["run", "view", String(id), "--repo", REPOSITORY, "--json", fields]);
  yield* view("status").pipe(
    Effect.flatMap(Schema.decodeEffect(RunStatusJson)),
    Effect.repeat({
      until: (run) => run.status === "completed",
      schedule: Schedule.spaced("2 minutes"),
    })
  );
  return yield* view(RUN_FIELDS).pipe(
    Effect.flatMap(Schema.decodeEffect(RunViewJson))
  );
});

/** The shard results that a completed run uploaded; a run whose build failed has none. */
const readShards = Effect.fn("proof.readShards")(function* (id: number) {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "proof-" });
  const download = yield* runText("gh", [
    "run",
    "download",
    String(id),
    "--repo",
    REPOSITORY,
    "--pattern",
    "result-*",
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

/** The head that a proof run's name carries: `Proof <sha> <nonce>`. */
const PROOF_TITLE = /^Proof (?<sha>[0-9a-f]{40}) /u;

/**
 * Cancels every queued proof run whose head is no longer worth proving: not the
 * head of an open pull request, not main's head, and not the tip of a train
 * branch. A head that a newer push replaced, or that merged, would otherwise
 * hold one of the 20 jobs that every proof and gate of the account shares.
 * Runs that already started keep going. Returns how many it cancelled.
 */
export const sweepSuperseded = Effect.fn("proof.sweepSuperseded")(
  function* () {
    const lines = (text: string) =>
      Arr.filter(Str.split(text, "\n"), (line) => line !== "");
    const heads = yield* gh([
      "pr",
      "list",
      "--repo",
      REPOSITORY,
      "--state",
      "open",
      "--limit",
      "300",
      "--json",
      "headRefOid",
      "--jq",
      ".[].headRefOid",
    ]);
    const trains = yield* gh([
      "api",
      `repos/${REPOSITORY}/git/matching-refs/heads/nabil/train-`,
      "--jq",
      ".[].object.sha",
    ]);
    const keep = HashSet.fromIterable([
      ...lines(heads),
      ...lines(trains),
      yield* mainHead,
    ]);
    const queued = yield* gh([
      "run",
      "list",
      "--repo",
      REPOSITORY,
      "--workflow",
      "proof.yml",
      "--status",
      "queued",
      "--limit",
      "200",
      "--json",
      "databaseId,displayTitle",
    ]).pipe(Effect.flatMap(Schema.decodeEffect(RunListJson)));
    const stale = Arr.filter(queued, (run) =>
      Option.match(
        Option.fromNullishOr(PROOF_TITLE.exec(run.displayTitle)?.groups?.sha),
        {
          onNone: () => false,
          onSome: (sha) => !HashSet.has(keep, sha),
        }
      )
    );
    yield* Effect.forEach(stale, (run) =>
      gh(["run", "cancel", String(run.databaseId), "--repo", REPOSITORY]).pipe(
        Effect.catchTag("ProofError", (error) =>
          Effect.logWarning(`Run ${run.databaseId} stays: ${error.message}`)
        )
      )
    );
    return stale.length;
  }
);

/**
 * Proves one head on GitHub's runners: dispatches the proof workflow, waits for
 * its run and combines what each machine reported. The verdict is the same one
 * the run posts as commit statuses on the head.
 */
export const proveOnGithub = Effect.fn("proof.proveOnGithub")(
  function* (sha: string, specs: readonly string[], shards: number) {
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
      `shards=${shards}`,
      "-f",
      `nonce=${nonce}`,
    ]);
    const id = yield* findRun(`Proof ${sha} ${nonce}`).pipe(
      Effect.retry({ schedule: Schedule.spaced("5 seconds"), times: 24 })
    );
    const run = yield* awaitRun(id);
    const results = yield* readShards(id).pipe(
      Effect.mapError(
        (cause) =>
          new ProofError({
            message: `The results of run ${id}: ${cause.message}`,
          })
      )
    );
    return {
      result: combineShards(sha, run.url, shards, results),
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

/**
 * The seam every caller of a proof uses: prove one exact head, narrowed to some
 * spec files or not, and answer one verdict per engine.
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

/** The prover that runs every proof on GitHub's runners. */
export const githubProver = Layer.effect(
  Prover,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    return {
      prove: (sha, specs) =>
        proveOnGithub(
          sha,
          specs,
          specs.length === 0 ? DEFAULT_SHARDS : NARROW_SHARDS
        ).pipe(
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

/** The exact head of main now. */
export const mainHead = gh([
  "api",
  `repos/${REPOSITORY}/commits/main`,
  "--jq",
  ".sha",
]).pipe(
  Effect.map((text) => text.trim()),
  Effect.flatMap(Schema.decodeEffect(HeadSha)),
  Effect.catchTag("SchemaError", () =>
    Effect.fail(new ProofError({ message: "GitHub named no main head." }))
  )
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
