import { NodeRuntime, NodeServices } from "@effect/platform-node";
import {
  Config,
  Effect,
  FileSystem,
  type PlatformError,
  Schema,
  Stream,
} from "effect";
import { ChildProcess } from "effect/unstable/process";
import { writeOutput } from "./output.ts";

const GIT_REVISION_PATTERN = /^[0-9a-f]{40}$/u;

export interface ProductionChange {
  readonly path: string;
  readonly status: string;
}

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

/** Reads exact changed paths without allowing rename detection to hide a source. */
export const readProductionChanges = Effect.fn(
  "ProductionAcceptance.readChanges"
)((repositoryRoot: string, base: string, head: string) =>
  Effect.scoped(
    Effect.gen(function* () {
      const command = yield* ChildProcess.make(
        "git",
        ["diff", "--name-status", "--no-renames", "-z", base, head, "--"],
        { cwd: repositoryRoot }
      ).pipe(
        Effect.mapError(
          (cause) =>
            new ProductionAcceptanceError({
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
        Effect.mapError(
          (cause) =>
            new ProductionAcceptanceError({
              cause,
              message: "Unable to finish inspecting the pull request changes.",
            })
        )
      );
      if (exitCode !== 0) {
        return yield* new ProductionAcceptanceError({
          message:
            stderr.trim() ||
            stdout.trim() ||
            "Git could not inspect the pull request changes.",
        });
      }

      const fields = stdout.split("\0");
      if (fields.at(-1) === "") {
        fields.pop();
      }
      if (fields.length % 2 !== 0) {
        return yield* new ProductionAcceptanceError({
          message: "Git returned an invalid changed-path record.",
        });
      }

      const changes: ProductionChange[] = [];
      for (let index = 0; index < fields.length; index += 2) {
        const status = fields[index];
        const path = fields[index + 1];
        if (!(status && path)) {
          return yield* new ProductionAcceptanceError({
            message: "Git returned an incomplete changed-path record.",
          });
        }
        changes.push({ path, status });
      }
      return changes;
    })
  )
);

/** Requires production unless every change only modifies an existing TS test. */
export function requiresProductionAcceptance(
  changes: readonly ProductionChange[]
) {
  return (
    changes.length === 0 ||
    changes.some(
      (change) => change.status !== "M" || !change.path.endsWith(".test.ts")
    )
  );
}

/** Writes the fail-closed production decision for the GitHub Actions job. */
export const writeProductionAcceptanceDecision = Effect.fn(
  "ProductionAcceptance.writeDecision"
)(function* (repositoryRoot: string) {
  const config = yield* Config.all({
    base: Config.nonEmptyString("BASE_SHA"),
    head: Config.nonEmptyString("HEAD_SHA"),
    output: Config.nonEmptyString("GITHUB_OUTPUT"),
  }).pipe(
    Effect.mapError(
      (cause) =>
        new ProductionAcceptanceError({
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
    Effect.mapError(
      (cause) =>
        new ProductionAcceptanceError({
          cause,
          message: "Production acceptance requires exact Git revisions.",
        })
    )
  );
  const changes = yield* readProductionChanges(repositoryRoot, base, head);
  const required = requiresProductionAcceptance(changes);
  const fileSystem = yield* FileSystem.FileSystem;
  yield* fileSystem
    .writeFileString(config.output, `required=${String(required)}\n`, {
      flag: "a",
    })
    .pipe(
      Effect.mapError(
        (cause) =>
          new ProductionAcceptanceError({
            cause,
            message: "Unable to write the production acceptance decision.",
          })
      )
    );
  yield* writeOutput(
    required
      ? `Production acceptance required for ${changes.length} changed paths.\n`
      : `Production acceptance skipped for ${changes.length} modified test modules.\n`
  );
  return required;
});

if (import.meta.main) {
  NodeRuntime.runMain(
    writeProductionAcceptanceDecision(process.cwd()).pipe(
      Effect.provide(NodeServices.layer)
    )
  );
}
