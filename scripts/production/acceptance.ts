import {
  Array as Arr,
  Config,
  Effect,
  FileSystem,
  type PlatformError,
  Schema,
  Stream,
} from "effect";
import { ChildProcess } from "effect/process";
import { runEntry } from "#scripts/entry";
import { writeOutput } from "#scripts/output";

const GIT_REVISION_PATTERN = /^[0-9a-f]{40}$/u;

const RevisionEnvironment = Schema.Struct({
  base: Schema.String,
  head: Schema.String,
});
type RevisionEnvironment = typeof RevisionEnvironment.Type;

const ProductionChange = Schema.Struct({
  path: Schema.String,
  status: Schema.String,
});
export type ProductionChange = typeof ProductionChange.Type;

/** Expected failure while resolving the production acceptance scope. */
class ProductionAcceptanceError extends Schema.TaggedError<ProductionAcceptanceError>()(
  "ProductionAcceptanceError",
  {
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
  }
) {}

const GitRevision = Schema.String.check(Schema.isPattern(GIT_REVISION_PATTERN));

/** Collects one child-process stream as UTF-8 text. */
function collectText(
  stream: Stream.Stream<Uint8Array, PlatformError.PlatformError>
) {
  return stream.pipe(
    Stream.decodeText(),
    Stream.runFold(
      () => "",
      (output, chunk) => output + chunk
    )
  );
}

/** Reads head changes since the merge base without hiding renamed sources. */
export const readProductionChanges = Effect.fn(
  "ProductionAcceptance.readChanges"
)((repositoryRoot: string, base: string, head: string) =>
  Effect.scoped(
    Effect.gen(function* () {
      const command = yield* ChildProcess.make(
        "git",
        [
          "diff",
          "--name-status",
          "--no-renames",
          "-z",
          `${base}...${head}`,
          "--",
        ],
        { cwd: repositoryRoot }
      ).pipe(
        Effect.mapError((cause) =>
          ProductionAcceptanceError.make({
            cause,
            message: "Unable to inspect the pull request changes.",
          })
        )
      );
      const [exitCode, stdout, stderr] = yield* Effect.all(
        [
          command.exitCode,
          collectText(command.stdout),
          collectText(command.stderr),
        ],
        { concurrency: 3 }
      ).pipe(
        Effect.mapError((cause) =>
          ProductionAcceptanceError.make({
            cause,
            message: "Unable to finish inspecting the pull request changes.",
          })
        )
      );
      if (exitCode !== 0) {
        return yield* ProductionAcceptanceError.make({
          message:
            stderr.trim() ||
            stdout.trim() ||
            "Git could not inspect the pull request changes.",
        });
      }

      const split = stdout.split("\0");
      const fields = split.at(-1) === "" ? Arr.dropRight(split, 1) : split;
      if (fields.length % 2 !== 0) {
        return yield* ProductionAcceptanceError.make({
          message: "Git returned an invalid changed-path record.",
        });
      }

      return yield* Effect.forEach(
        Arr.chunksOf(fields, 2),
        ([status, path]): Effect.Effect<
          ProductionChange,
          ProductionAcceptanceError
        > =>
          status && path
            ? Effect.succeed({ path, status })
            : Effect.fail(
                ProductionAcceptanceError.make({
                  message: "Git returned an incomplete changed-path record.",
                })
              )
      );
    })
  )
);

/**
 * Documentation that no build or test reads. `osv.toml` feeds only the security
 * audit, which Quality runs on every head, and `.changeset` only the release
 * tooling.
 */
const DOCUMENTATION_PATTERNS = [
  /\.md$/u,
  /^docs\//u,
  /^\.changeset\//u,
  /^osv\.toml$/u,
] as const;

/**
 * Documentation-shaped paths that a build or a test still reads, or that the
 * app serves: a test packs the CLI README into the npm tarball, and Next.js
 * serves every file under `public`.
 */
const READ_DOCUMENTATION_PATTERNS = [
  /^packages\/cli\/README\.md$/u,
  /(?:^|\/)public\//u,
] as const;

/** Whether a path is documentation that the signed acceptance does not read. */
function isDocumentationPath(path: string) {
  return (
    Arr.some(DOCUMENTATION_PATTERNS, (pattern) => pattern.test(path)) &&
    !Arr.some(READ_DOCUMENTATION_PATTERNS, (pattern) => pattern.test(path))
  );
}

/** Whether one change is documentation or a modified TS test, so it needs no acceptance. */
function needsNoProductionAcceptance(change: ProductionChange) {
  return (
    (change.status === "M" && change.path.endsWith(".test.ts")) ||
    isDocumentationPath(change.path)
  );
}

/** Requires production unless every change is documentation or a modified TS test. */
export function requiresProductionAcceptance(
  changes: readonly ProductionChange[]
) {
  return (
    changes.length === 0 ||
    Arr.some(changes, (change) => !needsNoProductionAcceptance(change))
  );
}

/** Resolves one fail-closed decision from exact revision environment values. */
const resolveProductionAcceptance = Effect.fn(
  "ProductionAcceptance.resolveDecision"
)(function* (repositoryRoot: string, environment: RevisionEnvironment) {
  const config = yield* Config.all({
    base: Config.NonEmptyString(environment.base),
    head: Config.NonEmptyString(environment.head),
  }).pipe(
    Effect.mapError((cause) =>
      ProductionAcceptanceError.make({
        cause,
        message: "Production acceptance configuration is incomplete.",
      })
    )
  );
  const [base, head] = yield* Effect.all(
    [
      Schema.decodeEffect(GitRevision)(config.base),
      Schema.decodeEffect(GitRevision)(config.head),
    ],
    { concurrency: 2 }
  ).pipe(
    Effect.mapError((cause) =>
      ProductionAcceptanceError.make({
        cause,
        message: "Production acceptance requires exact Git revisions.",
      })
    )
  );
  const changes = yield* readProductionChanges(repositoryRoot, base, head);
  return {
    changes,
    required: requiresProductionAcceptance(changes),
  } as const;
});

/** Writes the fail-closed production decision for the GitHub Actions job. */
export const writeProductionAcceptanceDecision = Effect.fn(
  "ProductionAcceptance.writeDecision"
)(function* (repositoryRoot: string) {
  const output = yield* Config.NonEmptyString("GITHUB_OUTPUT").pipe(
    Effect.mapError((cause) =>
      ProductionAcceptanceError.make({
        cause,
        message: "Production acceptance configuration is incomplete.",
      })
    )
  );
  const { changes, required } = yield* resolveProductionAcceptance(
    repositoryRoot,
    {
      base: "BASE_SHA",
      head: "HEAD_SHA",
    }
  );
  const fileSystem = yield* FileSystem.FileSystem;
  yield* fileSystem
    .writeFileString(output, `required=${String(required)}\n`, {
      flag: "a",
    })
    .pipe(
      Effect.mapError((cause) =>
        ProductionAcceptanceError.make({
          cause,
          message: "Unable to write the production acceptance decision.",
        })
      )
    );
  yield* writeOutput(
    required
      ? `Production acceptance required for ${changes.length} changed paths.\n`
      : "Production acceptance skipped: every changed path is documentation or a modified test.\n"
  );
});

runEntry(import.meta.main, writeProductionAcceptanceDecision(process.cwd()));
