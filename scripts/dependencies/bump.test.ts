import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import {
  ConfigProvider,
  Effect,
  FileSystem,
  Layer,
  PlatformError,
  Sink,
  Stdio,
} from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { ChildProcessSpawner } from "effect/unstable/process";
import { bumpDependencies } from "#scripts/dependencies/bump";
import type { runPnpm } from "#scripts/dependencies/command";
import { REGISTRY_REVIEWS } from "#scripts/dependencies/policy";
import {
  type GithubActionReleaseReview,
  githubActionReleaseReviews,
} from "#scripts/github/release";

type CommandResult = Effect.Success<ReturnType<typeof runPnpm>>;

interface Scenario {
  readonly command: (args: readonly string[]) => CommandResult;
  readonly inspectPolicy?: () => string[];
  readonly release?: (review: GithubActionReleaseReview) => Response;
}

function reviewedDependencies(args: readonly string[]): CommandResult {
  if (args[0] === "update" || args[0] === "outdated") {
    return { exitCode: 0, stderr: "", stdout: "" };
  }
  assert.strictEqual(args[0], "view");
  const review = REGISTRY_REVIEWS.find(([registry]) => registry === args[1]);
  assert.isDefined(review);
  return { exitCode: 0, stderr: "", stdout: JSON.stringify(review[1]) };
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
        const review = reviews.find(
          ({ repository }) =>
            request.url ===
            `https://api.github.com/repos/${repository}/releases/latest`
        );
        assert.isDefined(review);
        return HttpClientResponse.fromWeb(request, release(review));
      })
    )
  );
});

const runScenario = Effect.fn("DependencyBumpTest.runScenario")(function* ({
  command,
  inspectPolicy = () => [],
  release = reviewedRelease,
}: Scenario) {
  const commands: string[][] = [];
  const errors: string[] = [];
  const output: string[] = [];
  let inspections = 0;
  const status = yield* bumpDependencies({
    root: "/repository",
    inspectPolicy: () =>
      Effect.sync(() => {
        inspections += 1;
        return inspectPolicy();
      }),
    run: (_root, args) =>
      Effect.sync(() => {
        commands.push([...args]);
        return command(args);
      }),
    writeError: (message) =>
      Effect.sync(() => {
        errors.push(message);
      }),
    writeOutput: (message) =>
      Effect.sync(() => {
        output.push(message);
      }),
  }).pipe(
    Effect.provide(
      Layer.mergeAll(NodeServices.layer, yield* releaseClient(release))
    ),
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnvRecord({})
    )
  );
  return { commands, errors, inspections, output, status };
});

describe("dependency updates", () => {
  it.effect(
    "rechecks policy and both registries after a successful update",
    () =>
      Effect.gen(function* () {
        const result = yield* runScenario({ command: reviewedDependencies });
        assert.strictEqual(result.status, 0);
        assert.strictEqual(result.inspections, 2);
        assert.deepStrictEqual(result.errors, []);
        assert.deepStrictEqual(result.commands[0], [
          "update",
          "--recursive",
          "--latest",
        ]);
        assert.deepStrictEqual(result.commands.at(-1), [
          "outdated",
          "--recursive",
          "--format",
          "json",
        ]);
        assert.ok(result.output.at(-1)?.startsWith("Routine dependencies and"));
        assert.ok(
          result.output.some((message) =>
            message.startsWith("actions/checkout:")
          )
        );
      })
  );

  it.effect("rejects unsafe policy before running pnpm update", () =>
    Effect.gen(function* () {
      const result = yield* runScenario({
        command: reviewedDependencies,
        inspectPolicy: () => ["unsafe dependency policy"],
      });
      assert.strictEqual(result.status, 1);
      assert.strictEqual(result.inspections, 1);
      assert.deepStrictEqual(result.commands, []);
      assert.deepStrictEqual(result.errors, ["unsafe dependency policy\n"]);
    })
  );

  it.effect("preserves an update failure without querying registries", () =>
    Effect.gen(function* () {
      const result = yield* runScenario({
        command: () => ({ exitCode: 23, stderr: "update failed", stdout: "" }),
      });
      assert.strictEqual(result.status, 23);
      assert.strictEqual(result.inspections, 1);
      assert.strictEqual(result.commands.length, 1);
      assert.deepStrictEqual(result.output, []);
      assert.deepStrictEqual(result.errors, []);
    })
  );

  it.effect("reports registry failures and unresolved updates together", () =>
    Effect.gen(function* () {
      const sharedPlatformReview = REGISTRY_REVIEWS.find(
        ([registry]) => registry === "@effect/platform-node-shared@rc"
      );
      assert.isDefined(sharedPlatformReview);
      const result = yield* runScenario({
        command: (args) => {
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
          if (args[1] === "effect@rc") {
            return { exitCode: 2, stderr: "registry unavailable", stdout: "" };
          }
          if (args[1] === "@effect/platform-node@rc") {
            return { exitCode: 0, stderr: "", stdout: "{" };
          }
          if (args[1] === "@effect/platform-node-shared@rc") {
            return { exitCode: 0, stderr: "", stdout: '"99.0.0"' };
          }
          return reviewedDependencies(args);
        },
      });
      assert.strictEqual(result.status, 1);
      assert.strictEqual(result.inspections, 2);
      assert.deepStrictEqual(result.errors, [
        "Unable to inspect reviewed dependency react@latest.\n" +
          "registry unavailable\n" +
          "@effect/platform-node@rc returned invalid registry metadata.\n" +
          `@effect/platform-node-shared@rc is now 99.0.0; last reviewed ${sharedPlatformReview[1]}.\n` +
          "Routine dependencies remain outdated: unreviewed-library.\n",
      ]);
      assert.ok(
        result.output.some((message) =>
          message.startsWith("@effect/platform-node-shared@rc: reviewed")
        )
      );
    })
  );

  it.effect("reports unavailable and drifted action releases", () =>
    Effect.gen(function* () {
      const result = yield* runScenario({
        command: (args) =>
          args[0] === "outdated"
            ? { exitCode: 1, stderr: "", stdout: "{" }
            : reviewedDependencies(args),
        release: (review) => {
          if (review.repository === "actions/checkout") {
            return new Response(null, { status: 404 });
          }
          return review.repository === "pnpm/setup"
            ? Response.json({ tag_name: "v3.0.0" })
            : reviewedRelease(review);
        },
      });
      assert.strictEqual(result.status, 1);
      assert.deepStrictEqual(result.errors, [
        "Unable to read the latest actions/checkout release.\n" +
          "pnpm/setup is now v3.0.0; last reviewed v2.0.2.\n" +
          "pnpm outdated returned invalid JSON.\n",
      ]);
      assert.ok(
        result.output.every(
          (message) => !message.startsWith("actions/checkout:")
        )
      );
    })
  );

  it.effect("reports failed outdated checks with their diagnostics", () =>
    Effect.gen(function* () {
      const failures: [number, readonly string[]][] = [];
      for (const stderr of ["network down\n", ""]) {
        const result = yield* runScenario({
          command: (args) =>
            args[0] === "outdated"
              ? { exitCode: 2, stderr, stdout: "" }
              : reviewedDependencies(args),
        });
        failures.push([result.status, result.errors]);
      }
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
      const spawned: unknown[] = [];
      const stderr: Array<string | Uint8Array> = [];
      const status = yield* bumpDependencies({ root }).pipe(
        Effect.provide(
          Layer.mergeAll(
            yield* releaseClient(reviewedRelease),
            Layer.succeed(
              ChildProcessSpawner.ChildProcessSpawner,
              ChildProcessSpawner.make((command) =>
                Effect.sync(() => spawned.push(command)).pipe(
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
              stderr: () =>
                Sink.forEachArray((chunks) =>
                  Effect.sync(() => {
                    stderr.push(...chunks);
                  })
                ),
            })
          )
        )
      );

      assert.strictEqual(status, 1);
      assert.deepStrictEqual(spawned, []);
      assert.deepStrictEqual(stderr, [
        `Unable to inspect dependencies: Unable to read ${root}/package.json.\n` +
          "Unable to inspect GitHub Actions: Unable to read GitHub workflow files.\n",
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
