import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { bumpDependencies } from "#scripts/dependencies/bump";
import type { runPnpm } from "#scripts/dependencies/command";
import { REGISTRY_REVIEWS } from "#scripts/dependencies/policy";
import { githubActionReleaseReviews } from "#scripts/github/release";

type CommandResult = Effect.Success<ReturnType<typeof runPnpm>>;

function reviewedDependencies(args: readonly string[]): CommandResult {
  if (args[0] === "update" || args[0] === "outdated") {
    return { exitCode: 0, stderr: "", stdout: "" };
  }
  assert.strictEqual(args[0], "view");
  const review = REGISTRY_REVIEWS.find(([registry]) => registry === args[1]);
  assert.isDefined(review);
  return { exitCode: 0, stderr: "", stdout: JSON.stringify(review[1]) };
}

const runScenario = Effect.fn("DependencyBumpTest.runScenario")(function* (
  response: (args: readonly string[]) => CommandResult
) {
  const commands: string[][] = [];
  const errors: string[] = [];
  const output: string[] = [];
  let inspections = 0;
  const reviews = yield* githubActionReleaseReviews();
  const client = Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.sync(() => {
        const review = reviews.find(
          ({ repository }) =>
            request.url ===
            `https://api.github.com/repos/${repository}/releases/latest`
        );
        assert.isDefined(review);
        return HttpClientResponse.fromWeb(
          request,
          Response.json({ tag_name: review.expectedTag })
        );
      })
    )
  );
  const status = yield* bumpDependencies({
    root: "/repository",
    inspectPolicy: () =>
      Effect.sync(() => {
        inspections += 1;
        return [];
      }),
    run: (_root, args) =>
      Effect.sync(() => {
        commands.push([...args]);
        return response(args);
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
    Effect.provide(Layer.mergeAll(NodeServices.layer, client)),
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
        const result = yield* runScenario(reviewedDependencies);
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
      const sharedPlatformReview = REGISTRY_REVIEWS.find(
        ([registry]) => registry === "@effect/platform-node-shared@rc"
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
      });
      assert.strictEqual(result.status, 1);
      assert.strictEqual(result.inspections, 2);
      assert.deepStrictEqual(result.errors, [
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
});
