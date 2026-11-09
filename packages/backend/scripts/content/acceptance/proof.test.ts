import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import {
  PROOF_SUITES,
  proofMode,
  proveHere,
  runShard,
  shardMode,
} from "@repo/backend/scripts/content/acceptance/proof";
import { nodePlatform } from "@repo/backend/test/platform";
import { ConfigProvider, Effect, Fiber, FileSystem, Layer, Ref } from "effect";
import { FetchHttpClient } from "effect/http";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { TestClock, TestConsole } from "effect/testing";

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  run: vi.fn(),
  clean: vi.fn(),
}));
vi.mock("@repo/backend/scripts/content/acceptance/build", () => ({
  prepareAcceptance: mocks.prepare,
  runAcceptance: mocks.run,
}));
vi.mock("@repo/backend/scripts/content/acceptance/local", async (load) => ({
  ...(await load<
    typeof import("@repo/backend/scripts/content/acceptance/local")
  >()),
  cleanLocalRuntime: mocks.clean,
}));

const fetcher = vi.fn<typeof fetch>();
const SHA = "b".repeat(40);

/** How the fake Playwright answers one suite: its report and its exit code. */
type Suite = { readonly report?: unknown; readonly code: number };

/**
 * A spawner where Playwright writes the scripted report of each suite and exits
 * with its code, and Git answers a head and a status. Every other command is
 * refused, so a proof runs nothing it did not name.
 */
const fakeProcesses = (
  suites: (suite: string, engine: string) => Suite,
  git: { readonly head: string; readonly status: string; readonly code?: number },
  calls: Ref.Ref<readonly string[]>
) =>
  Layer.effect(
    ChildProcessSpawner.ChildProcessSpawner,
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const fs = yield* FileSystem.FileSystem;
      return ChildProcessSpawner.make((command) =>
        Effect.gen(function* () {
          if (!ChildProcess.isStandardCommand(command)) {
            return yield* Effect.die("unexpected pipeline");
          }
          const env = command.options.env ?? {};
          const args = command.args.map(String);
          yield* Ref.update(calls, (all) => [
            ...all,
            [command.command, ...args].join(" "),
          ]);
          if (command.command === "git") {
            const text = args[0] === "status" ? git.status : git.head;
            return yield* spawner.spawn(
              ChildProcess.make("printf", ["%s\n", text]).pipe((made) =>
                git.code === undefined
                  ? made
                  : ChildProcess.make("sh", ["-c", `exit ${git.code}`])
              )
            );
          }
          const answer = suites(
            String(env.PLAYWRIGHT_SUITE),
            String(env.PLAYWRIGHT_ENGINE)
          );
          if (answer.report !== undefined) {
            yield* fs.writeFileString(
              String(env.PLAYWRIGHT_JSON_OUTPUT_FILE),
              JSON.stringify(answer.report)
            );
          }
          return yield* spawner.spawn(
            ChildProcess.make("sh", ["-c", `exit ${answer.code}`])
          );
        })
      );
    })
  ).pipe(Layer.provide(nodePlatform));

const passing: Suite = { report: { suites: [], errors: [] }, code: 0 };

/** Runs a program on the fake processes, with the file system of Node. */
const withProcesses = <A, E, R>(
  program: Effect.Effect<A, E, R>,
  suites: (suite: string, engine: string) => Suite,
  git = { head: SHA, status: "" }
) =>
  Effect.gen(function* () {
    const calls = yield* Ref.make<readonly string[]>([]);
    const value = yield* program.pipe(
      Effect.provide(fakeProcesses(suites, git, calls))
    );
    return { value, calls: yield* Ref.get(calls) };
  });

describe("proof shard", () => {
  it.effect(
    "runs every suite of one engine's shard and records the failing specs",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const output = yield* fs.makeTempDirectoryScoped();
        const { value, calls } = yield* withProcesses(
          runShard("/root", {
            engine: "firefox",
            shard: 2,
            total: 3,
            specs: ["e2e/chat/send.browser.ts"],
            output,
          }),
          (suite) => {
            if (suite === "chat") {
              return {
                report: {
                  suites: [{ specs: [{ file: "chat/send.browser.ts", ok: false }] }],
                  errors: [],
                },
                code: 1,
              };
            }
            if (suite === "timing") {
              return { code: 1 };
            }
            if (suite === "visual") {
              return { report: { suites: [], errors: [] }, code: 1 };
            }
            return passing;
          }
        );
        expect(value).toEqual({
          engine: "firefox",
          shard: 2,
          passed: false,
          failures: ["e2e/chat/send.browser.ts", "suite:timing", "suite:visual"],
        });
        expect(calls).toHaveLength(PROOF_SUITES.length);
        expect(calls[0]).toBe(
          "bunx --no-install playwright test --shard=2/3 --pass-with-no-tests --reporter=line,json e2e/chat/send.browser.ts"
        );
        expect(yield* fs.readFileString(`${output}/result.json`)).toBe(
          JSON.stringify(value)
        );
      }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("reads its machine from the arguments and refuses a bad one", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const output = yield* fs.makeTempDirectoryScoped();
      yield* withProcesses(
        shardMode.run("/root", ["webkit", "1", "1", output]),
        () => passing
      );
      expect(yield* fs.exists(`${output}/result.json`)).toBe(true);
      for (const args of [
        ["opera", "1", "1", output],
        ["webkit", "0", "1", output],
        ["webkit", "1"],
      ]) {
        expect(
          (yield* shardMode.run("/root", args).pipe(Effect.flip)).message
        ).toContain("Usage: acceptance shard");
      }
      expect(
        (yield* shardMode
          .run("/root", ["webkit", "3", "2", output])
          .pipe(Effect.flip)).message
      ).toBe("Shard 3 does not exist in 2 shards.");
    }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );
});

const services = Layer.mergeAll(
  nodePlatform,
  ConfigProvider.layer(ConfigProvider.fromEnvRecord({ ACCEPTANCE_PORT: "3176" }))
);

describe("local proof", () => {
  beforeEach(() => {
    mocks.prepare.mockReturnValue(Effect.void);
    mocks.clean.mockReturnValue(Effect.void);
    mocks.run.mockImplementation((_root: string, operation: string) =>
      operation === "start" ? Effect.never : Effect.void
    );
    fetcher.mockResolvedValue(new Response("ok", { status: 200 }));
  });
  afterEach(() => vi.resetAllMocks());

  it.effect(
    "prepares, builds and starts this head, proves it in every engine, then stops and cleans",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped();
        const { value } = yield* withProcesses(
          proveHere(root, SHA, []),
          (_suite, engine) =>
            engine === "webkit"
              ? {
                  report: {
                    suites: [{ specs: [{ file: "a.browser.ts", ok: false }] }],
                    errors: [],
                  },
                  code: 1,
                }
              : passing
        );
        expect(value.passed).toBe(false);
        expect(value.engines.webkit.failures).toEqual(["e2e/a.browser.ts"]);
        expect(value.engines.chromium.passed).toBe(true);
        expect(mocks.run.mock.calls.map(([, operation]) => operation)).toEqual([
          "build",
          "start",
        ]);
        expect(String(fetcher.mock.calls[0]?.[0])).toBe(
          "http://localhost:3176/llms.txt"
        );
        expect(mocks.clean).toHaveBeenCalledOnce();
      }).pipe(
        Effect.scoped,
        Effect.provideService(FetchHttpClient.Fetch, fetcher),
        Effect.provide(services)
      )
  );

  it.effect("waits until the app answers", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      fetcher
        .mockRejectedValueOnce(new TypeError("refused"))
        .mockResolvedValueOnce(new Response("", { status: 503 }));
      const fiber = yield* withProcesses(
        proveHere(root, SHA, []),
        () => passing
      ).pipe(Effect.forkChild);
      // Each poll waits on the test clock after the real Git and file work before it.
      while (fiber.pollUnsafe() === undefined) {
        yield* TestClock.withLive(Effect.sleep("20 millis"));
        yield* TestClock.adjust("2 seconds");
      }
      const { value } = yield* Fiber.join(fiber);
      expect(value.passed).toBe(true);
      expect(fetcher).toHaveBeenCalledTimes(3);
    }).pipe(
      Effect.scoped,
      Effect.provideService(FetchHttpClient.Fetch, fetcher),
      Effect.provide(services)
    )
  );

  it.effect("fails when the server stops before the app answers", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      mocks.run.mockReturnValue(Effect.void);
      fetcher.mockResolvedValue(new Response("", { status: 503 }));
      mocks.clean.mockReturnValue(
        Effect.fail(acceptanceRuntimeError("test clean failure"))
      );
      const stopped = yield* withProcesses(
        proveHere(root, SHA, []).pipe(Effect.flip),
        () => passing
      );
      expect(stopped.value.message).toBe("The app stopped before it answered.");
      expect(mocks.clean).toHaveBeenCalledOnce();
    }).pipe(
      Effect.scoped,
      Effect.provideService(FetchHttpClient.Fetch, fetcher),
      Effect.provide(services)
    )
  );

  it.effect("gives up on an app that never answers", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      fetcher.mockResolvedValue(new Response("", { status: 503 }));
      const fiber = yield* withProcesses(
        proveHere(root, SHA, []).pipe(Effect.flip),
        () => passing
      ).pipe(Effect.forkChild);
      while (fiber.pollUnsafe() === undefined) {
        yield* TestClock.withLive(Effect.sleep("20 millis"));
        yield* TestClock.adjust("1 minute");
      }
      const { value } = yield* Fiber.join(fiber);
      expect(value.message).toBe("The started app did not answer in time.");
    }).pipe(
      Effect.scoped,
      Effect.provideService(FetchHttpClient.Fetch, fetcher),
      Effect.provide(services)
    )
  );

  it.effect("refuses another head, a dirty checkout and a failing Git", () =>
    Effect.gen(function* () {
      const other = yield* withProcesses(
        proveHere("/root", SHA, []).pipe(Effect.flip),
        () => passing,
        { head: "c".repeat(40), status: "" }
      );
      expect(other.value.message).toContain("check out");
      const dirty = yield* withProcesses(
        proveHere("/root", SHA, []).pipe(Effect.flip),
        () => passing,
        { head: SHA, status: " M file.ts" }
      );
      expect(dirty.value.message).toContain("commit or set aside");
      const broken = yield* withProcesses(
        proveHere("/root", SHA, []).pipe(Effect.flip),
        () => passing,
        { head: SHA, status: "", code: 128 }
      );
      expect(broken.value.message).toBe(
        "git status --porcelain exited with code 128."
      );
      expect(mocks.prepare).not.toHaveBeenCalled();
    }).pipe(Effect.provide(services))
  );

  it.effect("prints the result of a proof as JSON", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      const { value: lines } = yield* withProcesses(
        Effect.gen(function* () {
          yield* proofMode.run(root, [SHA, "e2e/home/page.browser.ts"]);
          return yield* TestConsole.logLines;
        }).pipe(Effect.provide(TestConsole.layer)),
        () => passing
      );
      expect(lines.map(String).some((line) => line.includes(`"sha":"${SHA}"`))).toBe(
        true
      );
      expect(
        (yield* proofMode.run(root, []).pipe(Effect.flip))._tag
      ).toBe("SchemaError");
    }).pipe(
      Effect.scoped,
      Effect.provideService(FetchHttpClient.Fetch, fetcher),
      Effect.provide(services)
    )
  );
});
