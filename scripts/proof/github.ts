import type { ProofResult } from "@repo/testing/proof";
import { combineShards, ShardResultJson } from "@repo/testing/proof";
import { sha256Hex } from "@repo/utilities/digest";
import { randomUuid } from "@repo/utilities/uuid";
import {
  Array as Arr,
  Context,
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
import {
  gateOf,
  RUN_FIELDS,
  RunStatusJson,
  RunViewJson,
  runTimings,
} from "#scripts/proof/run";
import { sweepSuperseded } from "#scripts/proof/sweep";

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
 * engine, which the CLI writes into a folder named after the artifact. An
 * engine whose build failed uploaded none, and a shard cancelled while it ran
 * can upload its folder without the result: neither reported.
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
  const reported = yield* Effect.filter(names, (name) =>
    fs.exists(`${directory}/${name}/result.json`)
  );
  return yield* Effect.forEach(reported, (name) =>
    fs
      .readFileString(`${directory}/${name}/result.json`)
      .pipe(Effect.flatMap(Schema.decodeEffect(ShardResultJson)))
  );
}, Effect.scoped);

/** What one run verifies: the gate, every workspace or only those the head changes, or neither. */
const Scope = Schema.Struct({ gate: Schema.Boolean, full: Schema.Boolean });
type Scope = typeof Scope.Type;

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

/** No dispatched run carries this name yet. */
class RunMissing extends Schema.TaggedError<
  RunMissing,
  { readonly brand: unique symbol }
>()("RunMissing", { title: Schema.String }) {}

/** How many looks, five seconds apart, a dispatch waits for its run to appear. */
const LOOKS_PER_DISPATCH = 24;

/**
 * How many times a dispatch whose run never appeared is sent again. GitHub can
 * accept a dispatch and start no run: on 16 November no run named after #2368's
 * base proof ever appeared, and the group failed on it.
 */
const LOST_DISPATCHES = 2;

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
      onNone: () => Effect.fail(new RunMissing({ title })),
      onSome: (run) => Effect.succeed(run.databaseId),
    }
  );
});

/**
 * Dispatches one proof run and finds it by the nonce it was given: a fresh one,
 * after the specs' prefix for a proof of the specs alone, so a later run never
 * takes a cancelled one's name.
 */
const dispatchOnce = Effect.fn("proof.dispatchOnce")(function* (
  sha: string,
  specs: readonly string[],
  scope: Scope,
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
    // A base proof (`proofPrefix`) retries nothing, so main keeps its flaky specs.
    "-f",
    `retries=${Option.isNone(prefix)}`,
    "-f",
    `nonce=${nonce}`,
  ]);
  return yield* findRun(title).pipe(
    Effect.retry({
      schedule: Schedule.spaced("5 seconds"),
      times: LOOKS_PER_DISPATCH,
    })
  );
});

/**
 * Dispatches a proof run and returns its id. A dispatch whose run never
 * appeared was lost, so it goes again under a fresh nonce, at most
 * `LOST_DISPATCHES` times, before the proof fails.
 */
const dispatchProof = (
  sha: string,
  specs: readonly string[],
  scope: Scope,
  prefix: Option.Option<string>
) =>
  dispatchOnce(sha, specs, scope, prefix).pipe(
    Effect.retry({
      while: (error) => error._tag === "RunMissing",
      times: LOST_DISPATCHES,
    }),
    Effect.catchTag("RunMissing", (missing) =>
      Effect.fail(
        new ProofError({
          message: `No run is named ${missing.title}: ${LOST_DISPATCHES + 1} dispatches started none.`,
        })
      )
    )
  );

/**
 * The run that proves one head: a proof of the specs alone (no gate) is named
 * by its head and its specs (`proofPrefix`) and reads such a run, finished or
 * running, when one exists, so main's failing specs are proven once per main
 * commit however many merge groups fail on them; every other proof dispatches
 * its own run.
 */
const startRun = Effect.fn("proof.startRun")(function* (
  sha: string,
  specs: readonly string[],
  scope: Scope
) {
  const prefix = scope.gate
    ? Option.none<string>()
    : Option.some(yield* proofPrefix(sha, specs));
  const reused = Option.isSome(prefix)
    ? yield* findReusableRun(prefix.value)
    : Option.none<number>();
  return Option.isSome(reused)
    ? reused.value
    : yield* dispatchProof(sha, specs, scope, prefix);
});

/**
 * Verifies one head on GitHub's runners in one run: starts or reuses its run
 * (`startRun`), waits for it and reads what it reported. The verdicts are the
 * ones the run posts as commit statuses on the head.
 */
export const proveOnGithub = Effect.fn("proof.proveOnGithub")(
  function* (sha: string, specs: readonly string[], scope: Scope) {
    const id = yield* startRun(sha, specs, scope);
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
      result: combineShards(sha, run.url, results),
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
