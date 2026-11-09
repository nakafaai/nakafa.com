import { Array as Arr, Effect, Order, Schema } from "effect";

/** The browser engines that every proof covers, each on its own machines. */
export const Engine = Schema.Literals(["chromium", "firefox", "webkit"]);
export type Engine = typeof Engine.Type;
export const ENGINES = Engine.literals;

/** The exact commit a proof proves: a full lower-case SHA, never a branch name. */
export const HeadSha = Schema.String.check(
  Schema.isPattern(/^[0-9a-f]{40}$/u)
);

/** One spec file of the browser suites, as a path under `apps/www`. */
export const SpecPath = Schema.String.check(
  Schema.isPattern(/^e2e\/[\w./-]+\.browser\.ts$/u)
);

/**
 * What one machine of a proof reports: its engine and shard, whether every
 * suite passed, and the spec files that failed. A suite that wrote no report,
 * or failed outside every test, fails as `suite:<name>`, which names no file, so
 * a rerun on main never takes it for a known failure.
 */
export const ShardResult = Schema.Struct({
  engine: Engine,
  shard: Schema.Int,
  passed: Schema.Boolean,
  failures: Schema.Array(Schema.String),
});
export type ShardResult = typeof ShardResult.Type;
export const ShardResultJson = Schema.fromJsonString(ShardResult);

const EngineResult = Schema.Struct({
  passed: Schema.Boolean,
  failures: Schema.Array(Schema.String),
});

/** The result of one proof of one head: one verdict per engine and one overall. */
export const ProofResult = Schema.Struct({
  sha: HeadSha,
  url: Schema.String,
  passed: Schema.Boolean,
  engines: Schema.Struct({
    chromium: EngineResult,
    firefox: EngineResult,
    webkit: EngineResult,
  }),
});
export type ProofResult = typeof ProofResult.Type;

/** One suite of a Playwright JSON report, whose suites nest by file and describe block. */
interface ReportSuite {
  readonly specs?: readonly { readonly file: string; readonly ok: boolean }[];
  readonly suites?: readonly ReportSuite[];
}
const ReportSuite: Schema.Codec<ReportSuite> = Schema.Struct({
  specs: Schema.optionalKey(
    Schema.Array(Schema.Struct({ file: Schema.String, ok: Schema.Boolean }))
  ),
  suites: Schema.optionalKey(
    Schema.Array(Schema.suspend((): Schema.Codec<ReportSuite> => ReportSuite))
  ),
});

/**
 * The Playwright JSON report: its suites, and the errors outside any test, such
 * as a config that throws or a file that fails to load.
 * @see https://playwright.dev/docs/test-reporters#json-reporter
 */
const ReportJson = Schema.fromJsonString(
  Schema.Struct({
    suites: Schema.Array(ReportSuite),
    errors: Schema.Array(Schema.Unknown),
  })
);

/** The failing spec files of every suite below these, as Playwright names them. */
const failingFiles = (suites: readonly ReportSuite[]): readonly string[] =>
  Arr.flatMap(suites, (suite) => [
    ...Arr.map(
      Arr.filter(suite.specs ?? [], (spec) => !spec.ok),
      (spec) => spec.file
    ),
    ...failingFiles(suite.suites ?? []),
  ]);

/**
 * The spec files that failed in one suite's JSON report, as paths under
 * `apps/www`. An error outside every test fails the whole suite.
 */
export const reportFailures = Effect.fn("acceptance.reportFailures")(function* (
  suite: string,
  text: string
) {
  const report = yield* Schema.decodeEffect(ReportJson)(text);
  const files = Arr.map(failingFiles(report.suites), (file) => `e2e/${file}`);
  return Arr.sort(
    Arr.dedupe(report.errors.length > 0 ? [...files, `suite:${suite}`] : files),
    Order.String
  );
});

/**
 * Combines the shard results of a proof. An engine passes only when every one
 * of its `total` shards reported and passed, so a machine that never reported
 * fails its engine.
 */
export function combineShards(
  sha: string,
  url: string,
  total: number,
  shards: readonly ShardResult[]
): ProofResult {
  const engine = (name: Engine) => {
    const own = Arr.filter(shards, (shard) => shard.engine === name);
    const reported = Arr.dedupe(Arr.map(own, (shard) => shard.shard));
    return {
      passed:
        reported.length === total && Arr.every(own, (shard) => shard.passed),
      failures: Arr.sort(
        Arr.dedupe(Arr.flatMap(own, (shard) => shard.failures)),
        Order.String
      ),
    };
  };
  const engines = {
    chromium: engine("chromium"),
    firefox: engine("firefox"),
    webkit: engine("webkit"),
  };
  return {
    sha,
    url,
    passed: Arr.every(ENGINES, (name) => engines[name].passed),
    engines,
  };
}

/** Every spec file that failed in any engine of a proof. */
export function proofFailures(result: ProofResult): readonly string[] {
  return Arr.sort(
    Arr.dedupe(Arr.flatMap(ENGINES, (name) => result.engines[name].failures)),
    Order.String
  );
}
