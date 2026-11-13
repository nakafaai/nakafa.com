import {
  combineShards,
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
  Layer,
  Option,
  Order,
  Ref,
  Schedule,
  Schema,
} from "effect";
import { ChildProcessSpawner } from "effect/process";
import { runText } from "#scripts/process";
import { gh, ProofError, REPOSITORY, RunListJson } from "#scripts/proof/client";
import { sweepSuperseded } from "#scripts/proof/sweep";

/** How many machines prove each engine, unless the caller names another count. */
export const DEFAULT_SHARDS = 3;

/** How many machines prove each engine of a proof narrowed to some specs, such as a rerun on main. */
const NARROW_SHARDS = 1;

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
 * proofs spend nothing of the REST limit that every session shares; every fifth
 * look it reads the run itself, which ends the wait for a run cancelled before
 * it posted anything.
 */
const awaitRun = Effect.fn("proof.awaitRun")(function* (
  id: number,
  sha: string
) {
  const view = (fields: string) =>
    gh(["run", "view", String(id), "--repo", REPOSITORY, "--json", fields]);
  const looks = yield* Ref.make(0);
  const done = Effect.gen(function* () {
    if (yield* posted(sha, id)) {
      return true;
    }
    const look = yield* Ref.updateAndGet(looks, (count) => count + 1);
    if (look % LOOKS_PER_RUN_READ !== 0) {
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
    const run = yield* awaitRun(id, sha);
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
