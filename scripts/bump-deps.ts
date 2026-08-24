import { NodeRuntime, NodeServices } from "@effect/platform-node";
import {
  Config,
  Effect,
  Layer,
  type PlatformError,
  Result,
  Schema,
  Stream,
} from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { ChildProcess } from "effect/unstable/process";
import { REGISTRY_REVIEWS } from "./dependency-policy.ts";
import { inspectDependencyPolicy } from "./dependency-source.ts";
import {
  fetchLatestGithubActionTag,
  githubActionReleaseReviews,
  inspectGithubActionPolicy,
} from "./github-action-policy.ts";
import { writeError, writeOutput } from "./output.ts";

interface RunOptions {
  readonly capture?: boolean;
}

interface BumpDependenciesOptions {
  readonly inspectPolicy?: typeof inspectRepositoryPolicy;
  readonly root: string;
  readonly run?: typeof runPnpm;
  readonly writeError?: typeof writeError;
  readonly writeOutput?: typeof writeOutput;
}

/** Expected failure while running pnpm for dependency maintenance. */
class DependencyCommandError extends Schema.TaggedError<DependencyCommandError>()(
  "DependencyCommandError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Expected failure while decoding package registry metadata. */
class DependencyMetadataError extends Schema.TaggedError<DependencyMetadataError>()(
  "DependencyMetadataError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

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

/** Runs pnpm without a shell and optionally captures its exact output. */
const runPnpm = Effect.fn("RepositoryPolicy.runPnpm")(function* (
  root: string,
  args: readonly string[],
  options: RunOptions = {}
) {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const capture = options.capture === true;
      const command = yield* ChildProcess.make("pnpm", args, {
        cwd: root,
        stderr: capture ? "pipe" : "inherit",
        stdout: capture ? "pipe" : "inherit",
      }).pipe(
        Effect.mapError(
          (cause) =>
            new DependencyCommandError({
              cause,
              message: `Unable to run pnpm ${args.join(" ")}.`,
            })
        )
      );

      if (!capture) {
        const exitCode = yield* command.exitCode.pipe(
          Effect.mapError(
            (cause) =>
              new DependencyCommandError({
                cause,
                message: `Unable to finish pnpm ${args.join(" ")}.`,
              })
          )
        );
        return { exitCode: Number(exitCode), stderr: "", stdout: "" };
      }

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
            new DependencyCommandError({
              cause,
              message: `Unable to finish pnpm ${args.join(" ")}.`,
            })
        )
      );
      return { exitCode: Number(exitCode), stderr, stdout };
    })
  );
});

/** Returns every local dependency and workflow policy violation. */
export const inspectRepositoryPolicy = Effect.fn(
  "RepositoryPolicy.inspectRepository"
)((root: string) =>
  Effect.all([
    inspectDependencyPolicy(root).pipe(
      Effect.catch((error) =>
        Effect.succeed([`Unable to inspect dependencies: ${error.message}`])
      )
    ),
    inspectGithubActionPolicy(root),
  ]).pipe(Effect.map(([dependency, actions]) => [...dependency, ...actions]))
);

function decodeRegistryVersion(registry: string, source: string) {
  return Effect.try({
    try: (): unknown => JSON.parse(source),
    catch: (cause) =>
      new DependencyMetadataError({
        cause,
        message: `${registry} returned invalid registry metadata.`,
      }),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Schema.String)),
    Effect.mapError(
      (cause) =>
        new DependencyMetadataError({
          cause,
          message: `${registry} returned invalid registry metadata.`,
        })
    )
  );
}

function decodeOutdatedDependencies(source: string) {
  if (!source.trim()) {
    return Effect.succeed<string[]>([]);
  }

  return Effect.try({
    try: (): unknown => JSON.parse(source),
    catch: (cause) =>
      new DependencyMetadataError({
        cause,
        message: "pnpm outdated returned invalid JSON.",
      }),
  }).pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Unknown))
    ),
    Effect.map((dependencies) => Object.keys(dependencies).sort()),
    Effect.mapError(
      (cause) =>
        new DependencyMetadataError({
          cause,
          message: "pnpm outdated returned invalid JSON.",
        })
    )
  );
}

/** Updates routine dependencies only after every safety policy passes. */
export const bumpDependencies = Effect.fn("RepositoryPolicy.bumpDependencies")(
  function* ({
    inspectPolicy = inspectRepositoryPolicy,
    root,
    run = runPnpm,
    writeError: writeErrorMessage = writeError,
    writeOutput: writeOutputMessage = writeOutput,
  }: BumpDependenciesOptions) {
    const preflightProblems = yield* inspectPolicy(root);
    if (preflightProblems.length > 0) {
      yield* writeErrorMessage(`${preflightProblems.join("\n")}\n`);
      return 1;
    }

    const update = yield* run(root, ["update", "--recursive", "--latest"]);
    if (update.exitCode !== 0) {
      return update.exitCode;
    }

    const problems = [...(yield* inspectPolicy(root))];

    for (const [registry, reviewedLatest, reason] of REGISTRY_REVIEWS) {
      const result = yield* run(root, ["view", registry, "version", "--json"], {
        capture: true,
      });
      if (result.exitCode !== 0) {
        problems.push(
          result.stderr.trim() ||
            `Unable to inspect reviewed dependency ${registry}.`
        );
        continue;
      }

      const latest = yield* decodeRegistryVersion(registry, result.stdout).pipe(
        Effect.result
      );
      if (Result.isFailure(latest)) {
        problems.push(latest.failure.message);
        continue;
      }

      if (latest.success !== reviewedLatest) {
        problems.push(
          `${registry} is now ${latest.success}; last reviewed ${reviewedLatest}.`
        );
      }
      yield* writeOutputMessage(
        `${registry}: reviewed ${reviewedLatest}. ${reason}\n`
      );
    }

    const token = yield* Config.option(Config.redacted("GITHUB_TOKEN"));
    const actionReviews = yield* githubActionReleaseReviews();
    const actionChecks = yield* Effect.forEach(
      actionReviews,
      (review) =>
        fetchLatestGithubActionTag(review, token).pipe(
          Effect.map((latest) => ({ latest, review })),
          Effect.result
        ),
      { concurrency: "unbounded" }
    );

    for (const check of actionChecks) {
      if (Result.isFailure(check)) {
        problems.push(check.failure.message);
        continue;
      }
      const { latest, review } = check.success;
      if (latest !== review.expectedTag) {
        problems.push(
          `${review.repository} is now ${latest}; last reviewed ${review.expectedTag}.`
        );
      }
      yield* writeOutputMessage(
        `${review.repository}: reviewed ${review.expectedTag}. ${review.reason}\n`
      );
    }

    const outdated = yield* run(
      root,
      ["outdated", "--recursive", "--format", "json"],
      { capture: true }
    );
    if (outdated.exitCode === 0 || outdated.exitCode === 1) {
      const unresolved = yield* decodeOutdatedDependencies(
        outdated.stdout
      ).pipe(Effect.result);
      if (Result.isFailure(unresolved)) {
        problems.push(unresolved.failure.message);
      } else if (unresolved.success.length > 0) {
        problems.push(
          `Routine dependencies remain outdated: ${unresolved.success.join(", ")}.`
        );
      }
    } else {
      problems.push(outdated.stderr.trim() || "pnpm outdated failed.");
    }

    if (problems.length > 0) {
      yield* writeErrorMessage(`${problems.join("\n")}\n`);
      return 1;
    }

    yield* writeOutputMessage(
      "Routine dependencies and every reviewed hold are current under the repository's 24-hour release-maturity policy and exact reviewed exception allowlist.\n"
    );
    return 0;
  }
);

if (import.meta.main) {
  NodeRuntime.runMain(
    bumpDependencies({ root: process.cwd() }).pipe(
      Effect.tap((status) =>
        status === 0
          ? Effect.void
          : Effect.sync(() => {
              process.exitCode = status;
            })
      ),
      Effect.provide(Layer.mergeAll(FetchHttpClient.layer, NodeServices.layer))
    )
  );
}
