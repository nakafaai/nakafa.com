import {
  Array as Arr,
  Config,
  Effect,
  Order,
  Record as Rec,
  Result,
  Schema,
} from "effect";
import { FetchHttpClient } from "effect/http";
import { runPnpm } from "#scripts/dependencies/command";
import { REGISTRY_REVIEWS } from "#scripts/dependencies/policy";
import { inspectDependencyPolicy } from "#scripts/dependencies/source";
import { runEntry } from "#scripts/entry";
import { inspectGithubActionPolicy } from "#scripts/github/policy";
import {
  fetchLatestGithubActionTag,
  githubActionReleaseReviews,
} from "#scripts/github/release";
import { writeError, writeOutput } from "#scripts/output";
import { problemWhen } from "#scripts/problem";

interface BumpDependenciesOptions {
  readonly inspectPolicy?: typeof inspectRepositoryPolicy;
  readonly root: string;
  readonly run?: typeof runPnpm;
  readonly writeError?: typeof writeError;
  readonly writeOutput?: typeof writeOutput;
}

/** Expected failure while decoding package registry metadata. */
class DependencyMetadataError extends Schema.TaggedError<DependencyMetadataError>()(
  "DependencyMetadataError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

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
    Effect.map((dependencies) =>
      Arr.sort(Rec.keys(dependencies), Order.String)
    ),
    Effect.mapError(
      (cause) =>
        new DependencyMetadataError({
          cause,
          message: "pnpm outdated returned invalid JSON.",
        })
    )
  );
}

/** Reviews held package versions and reports registry or metadata failures. */
const reviewRegistryDependencies = Effect.fn("RepositoryPolicy.reviewRegistry")(
  function* (
    root: string,
    run: typeof runPnpm,
    writeOutputMessage: typeof writeOutput
  ) {
    const problems = yield* Effect.forEach(
      REGISTRY_REVIEWS,
      Effect.fnUntraced(function* ([registry, reviewedLatest, reason]) {
        const result = yield* run(
          root,
          ["view", registry, "version", "--json"],
          { capture: true }
        );
        if (result.exitCode !== 0) {
          return [
            result.stderr.trim() ||
              `Unable to inspect reviewed dependency ${registry}.`,
          ];
        }

        const latest = yield* decodeRegistryVersion(
          registry,
          result.stdout
        ).pipe(Effect.result);
        if (Result.isFailure(latest)) {
          return [latest.failure.message];
        }

        yield* writeOutputMessage(
          `${registry}: reviewed ${reviewedLatest}. ${reason}\n`
        );
        return problemWhen(
          latest.success !== reviewedLatest,
          `${registry} is now ${latest.success}; last reviewed ${reviewedLatest}.`
        );
      })
    );
    return Arr.flatten(problems);
  }
);

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
      yield* writeErrorMessage(`${Arr.join(preflightProblems, "\n")}\n`);
      return 1;
    }

    const update = yield* run(root, ["update", "--recursive", "--latest"]);
    if (update.exitCode !== 0) {
      return update.exitCode;
    }

    const policyProblems = yield* inspectPolicy(root);
    const registryProblems = yield* reviewRegistryDependencies(
      root,
      run,
      writeOutputMessage
    );

    const token = yield* Config.option(Config.Redacted("GITHUB_TOKEN"));
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

    const actionProblems = yield* Effect.forEach(
      actionChecks,
      Effect.fnUntraced(function* (check) {
        if (Result.isFailure(check)) {
          return [check.failure.message];
        }
        const { latest, review } = check.success;
        yield* writeOutputMessage(
          `${review.repository}: reviewed ${review.expectedTag}. ${review.reason}\n`
        );
        return problemWhen(
          latest !== review.expectedTag,
          `${review.repository} is now ${latest}; last reviewed ${review.expectedTag}.`
        );
      })
    );

    const outdated = yield* run(
      root,
      ["outdated", "--recursive", "--format", "json"],
      { capture: true }
    );
    const outdatedProblems =
      outdated.exitCode === 0 || outdated.exitCode === 1
        ? yield* decodeOutdatedDependencies(outdated.stdout).pipe(
            Effect.match({
              onFailure: (failure) => [failure.message],
              onSuccess: (unresolved) =>
                problemWhen(
                  unresolved.length > 0,
                  `Routine dependencies remain outdated: ${Arr.join(unresolved, ", ")}.`
                ),
            })
          )
        : [outdated.stderr.trim() || "pnpm outdated failed."];
    const problems = Arr.flatten([
      policyProblems,
      registryProblems,
      Arr.flatten(actionProblems),
      outdatedProblems,
    ]);

    if (problems.length > 0) {
      yield* writeErrorMessage(`${Arr.join(problems, "\n")}\n`);
      return 1;
    }

    yield* writeOutputMessage(
      "Routine dependencies and every reviewed hold match the exact repository policy and reviewed exception allowlist.\n"
    );
    return 0;
  }
);

runEntry(
  import.meta.main,
  bumpDependencies({ root: process.cwd() }).pipe(
    Effect.provide(FetchHttpClient.layer)
  )
);
