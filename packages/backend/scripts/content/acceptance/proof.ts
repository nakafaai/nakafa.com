import {
  prepareAcceptance,
  runAcceptance,
} from "@repo/backend/scripts/content/acceptance/build";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { cleanLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import type { AcceptanceMode } from "@repo/backend/scripts/content/acceptance/mode";
import { acceptanceOrigin } from "@repo/backend/scripts/content/acceptance/origin";
import {
  combineShards,
  ENGINES,
  Engine,
  HeadSha,
  ProofResult,
  reportFailures,
  ShardResultJson,
  SpecPath,
} from "@repo/backend/scripts/content/acceptance/result";
import {
  Array as Arr,
  Console,
  Effect,
  Fiber,
  FileSystem,
  Order,
  Schedule,
  Schema,
  Stream,
} from "effect";
import { HttpClient } from "effect/http";
import { ChildProcess } from "effect/process";

/**
 * The suites of `apps/www/playwright.config.ts`, which owns what each one runs,
 * in the order a proof runs them: the parallel suites, then the timing suites,
 * which run one test at a time.
 */
export const PROOF_SUITES = [
  "runtime",
  "learner",
  "chat",
  "visual",
  "browsers",
  "timing",
  "browser-timing",
] as const;

/** What one machine proves: one engine, one shard of every suite, the specs it may narrow to, and where it reports. */
const Shard = Schema.Struct({
  engine: Engine,
  shard: Schema.Int,
  total: Schema.Int,
  specs: Schema.Array(Schema.String),
  output: Schema.String,
});
type Shard = typeof Shard.Type;

/**
 * Runs one suite's shard against the started app and returns its failing spec
 * files. A suite with nothing selected passes, and a suite that wrote no report
 * or failed without a failing spec fails as a whole.
 */
const runSuite = Effect.fn("acceptance.runSuite")(function* (
  root: string,
  input: Shard,
  suite: string
) {
  const fs = yield* FileSystem.FileSystem;
  const report = `${input.output}/${suite}.json`;
  const child = yield* ChildProcess.make(
    "bunx",
    [
      "--no-install",
      "playwright",
      "test",
      `--shard=${input.shard}/${input.total}`,
      "--pass-with-no-tests",
      // A test that fails once runs once more, as a rerun on the Mac always did
      // before a failure was blamed on a change. Playwright reports it flaky,
      // and only a test that fails both times fails its spec.
      "--retries=1",
      "--reporter=line,json",
      ...input.specs,
    ],
    {
      cwd: `${root}/apps/www`,
      env: {
        PLAYWRIGHT_ENGINE: input.engine,
        PLAYWRIGHT_JSON_OUTPUT_FILE: report,
        PLAYWRIGHT_SUITE: suite,
      },
      extendEnv: true,
      stdin: "ignore",
      stdout: "inherit",
      stderr: "inherit",
    }
  );
  const code = yield* child.exitCode;
  if (!(yield* fs.exists(report))) {
    return [`suite:${suite}`];
  }
  const failures = yield* reportFailures(
    suite,
    yield* fs.readFileString(report)
  );
  return code !== 0 && failures.length === 0 ? [`suite:${suite}`] : failures;
}, Effect.scoped);

/** Runs every suite of one engine's shard, one after another, and writes its result. */
export const runShard = Effect.fn("acceptance.runShard")(function* (
  root: string,
  input: Shard
) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(input.output, { recursive: true });
  const failures = yield* Effect.forEach(PROOF_SUITES, (suite) =>
    runSuite(root, input, suite)
  );
  const failed = Arr.sort(Arr.dedupe(Arr.flatten(failures)), Order.String);
  const result = {
    engine: input.engine,
    shard: input.shard,
    passed: failed.length === 0,
    failures: failed,
  };
  yield* fs.writeFileString(
    `${input.output}/result.json`,
    yield* Schema.encodeEffect(ShardResultJson)(result)
  );
  return result;
});

const ShardArguments = Schema.Tuple([
  Engine,
  Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThan(0)),
  Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThan(0)),
  Schema.NonEmptyString,
]);

/**
 * The shard mode: runs one engine's shard of every suite against the app that
 * start serves, and writes `<output>/result.json`. Each machine of a CI proof
 * runs it once; it fails only when it cannot report.
 */
export const shardMode = {
  mode: "shard",
  usage: "shard <engine> <shard> <total> <output> [spec...]",
  run: Effect.fn("contentAcceptance.runShardMode")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [engine, shard, total, output] = yield* Schema.decodeUnknownEffect(
      ShardArguments
    )(Arr.take(args, 4)).pipe(
      Effect.mapError(() =>
        acceptanceRuntimeError(
          "Usage: acceptance shard <chromium|firefox|webkit> <shard> <total> <output> [spec...]"
        )
      )
    );
    if (shard > total) {
      return yield* acceptanceRuntimeError(
        `Shard ${shard} does not exist in ${total} shards.`
      );
    }
    const specs = yield* Schema.decodeEffect(Schema.Array(SpecPath))(
      Arr.drop(args, 4)
    );
    yield* runShard(root, { engine, shard, total, specs, output });
  }),
} satisfies AcceptanceMode;

/** Waits until the started app answers, or fails as soon as its server stops. */
const waitForApp = Effect.fn("acceptance.waitForApp")(function* <E>(
  origin: string,
  server: Fiber.Fiber<void, E>
) {
  const client = yield* HttpClient.HttpClient;
  const answers = client.get(`${origin}/llms.txt`).pipe(
    Effect.map((response) => response.status === 200),
    Effect.orElseSucceed(() => false)
  );
  yield* Effect.raceFirst(
    answers.pipe(
      Effect.repeat({
        while: (ready) => !ready,
        schedule: Schedule.spaced("2 seconds"),
      }),
      Effect.timeoutOrElse({
        duration: "5 minutes",
        orElse: () =>
          acceptanceRuntimeError("The started app did not answer in time."),
      })
    ),
    Fiber.join(server).pipe(
      Effect.andThen(
        acceptanceRuntimeError("The app stopped before it answered.")
      )
    )
  );
});

/** The exact head this checkout holds, which a local proof refuses to move. */
const checkoutHead = Effect.fn("acceptance.checkoutHead")(function* (
  root: string
) {
  const read = Effect.fn(function* (args: readonly string[]) {
    const child = yield* ChildProcess.make("git", args, {
      cwd: root,
      stderr: "ignore",
      stdin: "ignore",
    });
    const [text, code] = yield* Effect.all(
      [child.stdout.pipe(Stream.decodeText(), Stream.mkString), child.exitCode],
      { concurrency: "unbounded" }
    );
    if (code !== 0) {
      return yield* acceptanceRuntimeError(
        `git ${Arr.join(args, " ")} exited with code ${code}.`
      );
    }
    return text.trim();
  }, Effect.scoped);
  const status = yield* read(["status", "--porcelain"]);
  if (status !== "") {
    return yield* acceptanceRuntimeError(
      "A local proof proves a committed head: commit or set aside the changes first."
    );
  }
  return yield* read(["rev-parse", "HEAD"]);
});

/**
 * Proves this checkout's head on this machine, the local adapter of the proof
 * runner: prepare (restoring a saved runtime when its key matches), build,
 * start, every suite in the three engines one after another, stop and clean.
 * It runs where the Mac's queue gives it the one runtime slot, for debugging a
 * proof that the parallel runner reported.
 */
export const proveHere = Effect.fn("acceptance.proveHere")(function* (
  root: string,
  sha: string,
  specs: readonly string[]
) {
  const head = yield* checkoutHead(root);
  if (head !== sha) {
    return yield* acceptanceRuntimeError(
      `This checkout holds ${head}; check out ${sha} to prove it.`
    );
  }
  yield* prepareAcceptance(root);
  const origin = yield* acceptanceOrigin;
  const result = yield* Effect.gen(function* () {
    yield* runAcceptance(root, "build", []);
    const server = yield* Effect.forkScoped(runAcceptance(root, "start", []));
    yield* waitForApp(origin, server);
    const shards = yield* Effect.forEach(ENGINES, (engine) =>
      runShard(root, {
        engine,
        shard: 1,
        total: 1,
        specs,
        output: `${root}/.cache/proof/${engine}`,
      })
    );
    yield* Fiber.interrupt(server);
    return combineShards(sha, "local", 1, shards);
  }).pipe(
    Effect.scoped,
    Effect.ensuring(
      cleanLocalRuntime(root).pipe(
        Effect.catchCause((cause) =>
          Effect.logError("The local runtime was not cleaned.", cause)
        )
      )
    )
  );
  return result;
});

/**
 * The proof mode: proves this checkout's head here and prints its result as
 * JSON, which the proof command line reads.
 */
export const proofMode = {
  mode: "proof",
  usage: "proof <sha> [spec...]",
  run: Effect.fn("contentAcceptance.runProofMode")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [sha, ...rest] = args;
    const head = yield* Schema.decodeEffect(HeadSha)(sha ?? "");
    const specs = yield* Schema.decodeEffect(Schema.Array(SpecPath))(rest);
    const result = yield* proveHere(root, head, specs);
    yield* Console.log(
      yield* Schema.encodeEffect(Schema.fromJsonString(ProofResult))(result)
    );
  }),
} satisfies AcceptanceMode;
