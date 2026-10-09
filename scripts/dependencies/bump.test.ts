import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import {
  Array as Arr,
  ConfigProvider,
  Effect,
  Fiber,
  FileSystem,
  Layer,
  Option,
  PlatformError,
  Ref,
  Schema,
  Stdio,
} from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { ChildProcessSpawner } from "effect/process";
import { TestClock } from "effect/testing";
import { capture, makeCapture } from "#scripts/capture";
import {
  bumpDependencies,
  RegistryVersionJson,
} from "#scripts/dependencies/bump";
import type { runPnpm } from "#scripts/dependencies/command";
import { REGISTRY_REVIEWS } from "#scripts/dependencies/policy";
import { GITHUB_ACTION_REVIEWS } from "#scripts/github/policy";
import {
  type GithubActionReleaseReview,
  githubActionReleaseReviews,
} from "#scripts/github/release";

type CommandResult = Effect.Success<ReturnType<typeof runPnpm>>;

/** Scripts one pnpm command's result from its arguments. */
type CommandScript = (args: readonly string[]) => CommandResult;
/** Scripts the policy problems that one inspection reports. */
type PolicyScript = () => string[];
/** Scripts the GitHub release response for one reviewed action. */
type ReleaseScript = (review: GithubActionReleaseReview) => Response;

function reviewedDependencies(args: readonly string[]): CommandResult {
  if (args[0] === "update" || args[0] === "outdated") {
    return { exitCode: 0, stderr: "", stdout: "" };
  }
  assert.strictEqual(args[0], "view");
  const review = Option.getOrUndefined(
    Arr.findFirst(REGISTRY_REVIEWS, ([registry]) => registry === args[1])
  );
  assert.isDefined(review);
  return {
    exitCode: 0,
    stderr: "",
    stdout: Schema.encodeSync(RegistryVersionJson)(review[1]),
  };
}

/** Returns the release tag last reviewed for one action. */
function reviewedTag(action: string) {
  return Option.getOrUndefined(
    Arr.findFirst(GITHUB_ACTION_REVIEWS, (review) => review.action === action)
  )?.expectedTag;
}

function reviewedRelease(review: GithubActionReleaseReview) {
  return Response.json({ tag_name: review.expectedTag });
}

/** Serves reviewed GitHub releases through the Effect HTTP client. */
const releaseClient = Effect.fn("DependencyBumpTest.releaseClient")(function* (
  release: (review: GithubActionReleaseReview) => Response
) {
  const reviews = yield* githubActionReleaseReviews();
  return Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.sync(() => {
        const review = Option.getOrUndefined(
          Arr.findFirst(
            reviews,
            ({ repository }) =>
              request.url ===
              `https://api.github.com/repos/${repository}/releases/latest`
          )
        );
        assert.isDefined(review);
        return HttpClientResponse.fromWeb(request, release(review));
      })
    )
  );
});

const runScenario = Effect.fn("DependencyBumpTest.runScenario")(function* (
  command: CommandScript,
  inspectPolicy: PolicyScript = () => [],
  release: ReleaseScript = reviewedRelease
) {
  const commands = yield* Ref.make<readonly string[][]>([]);
  const errors = yield* Ref.make<readonly string[]>([]);
  const output = yield* Ref.make<readonly string[]>([]);
  let inspections = 0;
  const status = yield* bumpDependencies(
    { root: "/repository" },
    () =>
      Effect.sync(() => {
        inspections += 1;
        return inspectPolicy();
      }),
    (_root, args) =>
      Effect.andThen(
        Ref.update(commands, Arr.append([...args])),
        Effect.sync(() => command(args))
      ),
    (message) => Ref.update(errors, Arr.append(message)),
    (message) => Ref.update(output, Arr.append(message))
  ).pipe(
    Effect.provide(
      Layer.mergeAll(NodeServices.layer, yield* releaseClient(release))
    ),
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnvRecord({})
    )
  );
  return {
    commands: yield* Ref.get(commands),
    errors: yield* Ref.get(errors),
    inspections,
    output: yield* Ref.get(output),
    status,
  };
});

describe("dependency updates", () => {
  it.effect(
    "rechecks policy and both registries after a successful update",
    () =>
      Effect.gen(function* () {
        const result = yield* runScenario(reviewedDependencies);
        assert.strictEqual(result.status, 0);
        assert.strictEqual(result.inspections, 2);
        assert.deepStrictEqual(result.errors, []);
        assert.deepStrictEqual(result.commands[0], [
          "update",
          "--recursive",
          "--latest",
        ]);
        assert.deepStrictEqual(
          Arr.last(result.commands),
          Option.some(["outdated", "--recursive", "--format", "json"])
        );
        assert.ok(
          Option.exists(Arr.last(result.output), (message) =>
            message.startsWith("Routine dependencies and")
          )
        );
        assert.ok(
          Arr.some(result.output, (message) =>
            message.startsWith("actions/checkout:")
          )
        );
      })
  );

  it.effect("rejects unsafe policy before running pnpm update", () =>
    Effect.gen(function* () {
      const result = yield* runScenario(reviewedDependencies, () => [
        "unsafe dependency policy",
      ]);
      assert.strictEqual(result.status, 1);
      assert.strictEqual(result.inspections, 1);
      assert.deepStrictEqual(result.commands, []);
      assert.deepStrictEqual(result.errors, ["unsafe dependency policy\n"]);
    })
  );

  it.effect("preserves an update failure without querying registries", () =>
    Effect.gen(function* () {
      const result = yield* runScenario(() => ({
        exitCode: 23,
        stderr: "update failed",
        stdout: "",
      }));
      assert.strictEqual(result.status, 23);
      assert.strictEqual(result.inspections, 1);
      assert.strictEqual(result.commands.length, 1);
      assert.deepStrictEqual(result.output, []);
      assert.deepStrictEqual(result.errors, []);
    })
  );

  it.effect("reports registry failures and unresolved updates together", () =>
    Effect.gen(function* () {
      const sharedPlatformReview = Option.getOrUndefined(
        Arr.findFirst(
          REGISTRY_REVIEWS,
          ([registry]) => registry === "@effect/platform-node-shared@latest"
        )
      );
      assert.isDefined(sharedPlatformReview);
      const result = yield* runScenario((args) => {
        if (args[0] === "outdated") {
          return {
            exitCode: 1,
            stderr: "",
            stdout: '{"unreviewed-library":{}}',
          };
        }
        if (args[1] === "react@latest") {
          return { exitCode: 1, stderr: "", stdout: "" };
        }
        if (args[1] === "effect@latest") {
          return { exitCode: 2, stderr: "registry unavailable", stdout: "" };
        }
        if (args[1] === "@effect/platform-node@latest") {
          return { exitCode: 0, stderr: "", stdout: "{" };
        }
        if (args[1] === "@effect/platform-node-shared@latest") {
          return { exitCode: 0, stderr: "", stdout: '"99.0.0"' };
        }
        return reviewedDependencies(args);
      });
      assert.strictEqual(result.status, 1);
      assert.strictEqual(result.inspections, 2);
      assert.deepStrictEqual(result.errors, [
        "Unable to inspect reviewed dependency react@latest.\n" +
          "registry unavailable\n" +
          "@effect/platform-node@latest returned invalid registry metadata.\n" +
          `@effect/platform-node-shared@latest is now 99.0.0; last reviewed ${sharedPlatformReview[1]}.\n` +
          "Routine dependencies remain outdated: unreviewed-library.\n",
      ]);
      assert.ok(
        Arr.some(result.output, (message) =>
          message.startsWith("@effect/platform-node-shared@latest: reviewed")
        )
      );
    })
  );

  it.effect("reports unavailable and drifted action releases", () =>
    Effect.gen(function* () {
      const result = yield* runScenario(
        (args) =>
          args[0] === "outdated"
            ? { exitCode: 1, stderr: "", stdout: "{" }
            : reviewedDependencies(args),
        () => [],
        (review) => {
          if (review.repository === "actions/checkout") {
            return new Response(null, { status: 404 });
          }
          return review.repository === "pnpm/setup"
            ? Response.json({ tag_name: "v99.0.0" })
            : reviewedRelease(review);
        }
      );
      assert.strictEqual(result.status, 1);
      assert.deepStrictEqual(result.errors, [
        "Unable to read the latest actions/checkout release.\n" +
          `pnpm/setup is now v99.0.0; last reviewed ${reviewedTag("pnpm/setup")}.\n` +
          "pnpm outdated returned invalid JSON.\n",
      ]);
      assert.ok(
        Arr.every(
          result.output,
          (message) => !message.startsWith("actions/checkout:")
        )
      );
    })
  );

  it.effect("reports failed outdated checks with their diagnostics", () =>
    Effect.gen(function* () {
      const failures = yield* Effect.forEach(["network down\n", ""], (stderr) =>
        Effect.map(
          runScenario((args) =>
            args[0] === "outdated"
              ? { exitCode: 2, stderr, stdout: "" }
              : reviewedDependencies(args)
          ),
          (result) => [result.status, result.errors]
        )
      );
      assert.deepStrictEqual(failures, [
        [1, ["network down\n"]],
        [1, ["pnpm outdated failed.\n"]],
      ]);
    })
  );

  it.effect("inspects the repository before starting pnpm by default", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const root = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "dependency-bump-",
      });
      const spawned = yield* Ref.make<readonly unknown[]>([]);
      const stderr = yield* makeCapture;
      const status = yield* bumpDependencies({ root }).pipe(
        Effect.provide(
          Layer.mergeAll(
            yield* releaseClient(reviewedRelease),
            Layer.succeed(
              ChildProcessSpawner.ChildProcessSpawner,
              ChildProcessSpawner.make((command) =>
                Ref.update(spawned, Arr.append<unknown>(command)).pipe(
                  Effect.andThen(
                    Effect.fail(
                      PlatformError.systemError({
                        _tag: "PermissionDenied",
                        method: "spawn",
                        module: "ChildProcess",
                      })
                    )
                  )
                )
              )
            ),
            Stdio.layerTest({
              stderr: capture(stderr),
            })
          )
        )
      );

      assert.strictEqual(status, 1);
      assert.deepStrictEqual(yield* Ref.get(spawned), []);
      assert.deepStrictEqual(yield* Ref.get(stderr), [
        `Unable to inspect dependencies: Unable to read ${root}/package.json.\n` +
          "Unable to inspect GitHub Actions: Unable to read GitHub workflow files.\n",
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "fails the registry review when pnpm view misses its deadline",
    () =>
      Effect.gen(function* () {
        const releases = yield* releaseClient(reviewedRelease);
        const fiber = yield* Effect.forkChild(
          bumpDependencies(
            { root: "/repository" },
            () => Effect.succeed([]),
            (_root, args) =>
              args[0] === "view"
                ? Effect.never
                : Effect.succeed({ exitCode: 0, stderr: "", stdout: "" }),
            () => Effect.void,
            () => Effect.void
          ).pipe(
            Effect.provide(Layer.mergeAll(NodeServices.layer, releases)),
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromEnvRecord({})
            ),
            Effect.flip
          )
        );

        yield* TestClock.adjust("10 seconds");

        const failure = yield* Fiber.join(fiber);
        const registry = REGISTRY_REVIEWS[0]?.[0];
        assert.strictEqual(failure._tag, "DependencyCommandError");
        assert.strictEqual(
          failure.message,
          `pnpm view ${registry} did not finish within 10 seconds.`
        );
      })
  );
});
