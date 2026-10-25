import { FetchClient } from "@repo/utilities/http/client";
import {
  Array as Arr,
  Config,
  Data,
  Duration,
  Effect,
  Order,
  Result,
  Schema,
} from "effect";
import { DependencyCommandError, runBun } from "#scripts/dependencies/command";
import { REGISTRY_REVIEWS } from "#scripts/dependencies/policy";
import { inspectDependencyPolicy } from "#scripts/dependencies/source";
import { heldDependencyNames } from "#scripts/dependencies/validate";
import { runEntry } from "#scripts/entry";
import {
  fetchLatestGithubActionTag,
  githubActionReleaseReviews,
} from "#scripts/github/release";
import { inspectGithubActionPolicy } from "#scripts/github/source";
import { writeError, writeOutput } from "#scripts/output";
import { problemWhen } from "#scripts/problem";

/** Expected failure while decoding package registry metadata. */
class DependencyMetadataError extends Schema.TaggedError<DependencyMetadataError>()(
  "DependencyMetadataError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Returns every local dependency and workflow policy violation. */
const inspectRepositoryPolicy = Effect.fn("RepositoryPolicy.inspectRepository")(
  (root: string) =>
    Effect.all([
      inspectDependencyPolicy(root).pipe(
        Effect.catch((error) =>
          Effect.succeed([`Unable to inspect dependencies: ${error.message}`])
        )
      ),
      inspectGithubActionPolicy(root),
    ]).pipe(Effect.map(([dependency, actions]) => [...dependency, ...actions]))
);

/**
 * The longest one `bun info` may take. It is the 10 second attempt budget of
 * the web app's network reads, kept here because the root scripts do not depend
 * on `@repo/backend`. Only the registry lookup is bounded: `bun outdated` scans every
 * dependency and may run longer.
 */
const REGISTRY_VIEW_DEADLINE = Duration.seconds(10);

/** The registry lookup did not finish within its deadline. */
class RegistryViewDeadline extends Data.TaggedError("RegistryViewDeadline") {}

/** A registry answers with the resolved version as one JSON string. */
export const RegistryVersionJson = Schema.fromJsonString(Schema.String);

function decodeRegistryVersion(registry: string, source: string) {
  return Schema.decodeEffect(RegistryVersionJson)(source).pipe(
    Effect.mapError(
      (cause) =>
        new DependencyMetadataError({
          cause,
          message: `${registry} returned invalid registry metadata.`,
        })
    )
  );
}

const OUTDATED_HEADER = "Package";
const SEPARATOR_CELL = /^-+$/u;
const PACKAGE_CELL = /^\|\s*([^|]+?)\s*\|/u;
const PACKAGE_SUFFIX = /\s+\((?:dev|peer|optional)\)$/u;
const NPM_ALIAS = /@npm:.*$/u;

/** The package name of one `bun outdated` table row, or nothing for a header, a rule, or prose. */
function outdatedPackage(line: string): string[] {
  const cell = PACKAGE_CELL.exec(line)?.[1];
  if (
    cell === undefined ||
    cell === OUTDATED_HEADER ||
    SEPARATOR_CELL.test(cell)
  ) {
    return [];
  }
  return [cell.replace(PACKAGE_SUFFIX, "").replace(NPM_ALIAS, "")];
}

/**
 * Names the outdated packages in `bun outdated` output. Bun prints one box table
 * for each matching workspace, so a package can repeat; the policy reads only the names.
 */
export function outdatedNames(source: string): readonly string[] {
  return Arr.sort(
    Arr.dedupe(Arr.flatMap(source.split("\n"), outdatedPackage)),
    Order.String
  );
}

/** Routine packages are the outdated ones that no reviewed hold leaves in place. */
function routineNames(names: readonly string[]): readonly string[] {
  const held = heldDependencyNames();
  return Arr.filter(names, (name) => !Arr.contains(held, name));
}

/** Reviews held package versions and reports registry or metadata failures. */
const reviewRegistryDependencies = Effect.fn("RepositoryPolicy.reviewRegistry")(
  function* (
    root: string,
    run: typeof runBun,
    writeOutputMessage: typeof writeOutput
  ) {
    const problems = yield* Effect.forEach(
      REGISTRY_REVIEWS,
      Effect.fnUntraced(function* ([registry, reviewedLatest, reason]) {
        const result = yield* run(
          root,
          ["info", registry, "version", "--json"],
          { capture: true }
        ).pipe(
          Effect.timeoutOrElse({
            duration: REGISTRY_VIEW_DEADLINE,
            orElse: () =>
              Effect.fail(
                new DependencyCommandError({
                  cause: new RegistryViewDeadline(),
                  message: `bun info ${registry} did not finish within 10 seconds.`,
                })
              ),
          })
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

const BumpDependenciesOptionsSchema = Schema.Struct({
  root: Schema.String,
});
type BumpDependenciesOptions = typeof BumpDependenciesOptionsSchema.Type;
type InspectPolicy = typeof inspectRepositoryPolicy;
type RunBun = typeof runBun;
type WriteError = typeof writeError;
type WriteOutput = typeof writeOutput;

/** Updates routine dependencies only after every safety policy passes. */
export const bumpDependencies = Effect.fn("RepositoryPolicy.bumpDependencies")(
  function* (
    { root }: BumpDependenciesOptions,
    inspectPolicy: InspectPolicy = inspectRepositoryPolicy,
    run: RunBun = runBun,
    writeErrorMessage: WriteError = writeError,
    writeOutputMessage: WriteOutput = writeOutput
  ) {
    const preflightProblems = yield* inspectPolicy(root);
    if (preflightProblems.length > 0) {
      yield* writeErrorMessage(`${Arr.join(preflightProblems, "\n")}\n`);
      return 1;
    }

    const before = yield* run(root, ["outdated", "--recursive"], {
      capture: true,
    });
    const routine = routineNames(outdatedNames(before.stdout));
    if (routine.length > 0) {
      const update = yield* run(root, [
        "update",
        "--recursive",
        "--latest",
        ...routine,
      ]);
      if (update.exitCode !== 0) {
        return update.exitCode;
      }
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

    const outdated = yield* run(root, ["outdated", "--recursive"], {
      capture: true,
    });
    const unresolved = routineNames(outdatedNames(outdated.stdout));
    const outdatedProblems =
      outdated.exitCode === 0 || outdated.exitCode === 1
        ? problemWhen(
            unresolved.length > 0,
            `Routine dependencies remain outdated: ${Arr.join(unresolved, ", ")}.`
          )
        : [outdated.stderr.trim() || "bun outdated failed."];
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
  bumpDependencies({ root: process.cwd() }).pipe(Effect.provide(FetchClient))
);
