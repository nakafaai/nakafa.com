import { createServer } from "node:net";
import { tmpdir } from "node:os";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { contentRuntimeCiError } from "@repo/backend/scripts/content/runtime/ci/error";
import type { LocalRuntime } from "@repo/backend/scripts/content/runtime/local";
import {
  localConvexEnvironment,
  runBuildCommand,
  withLocalBackend,
} from "@repo/backend/scripts/content/runtime/process";
import { Deferred, Effect, Fiber, FileSystem, Sink, Stream } from "effect";
import { TestClock } from "effect/testing";
import {
  type ChildProcess,
  ChildProcessSpawner,
} from "effect/unstable/process";

vi.mock("@repo/backend/scripts/content/runtime/tables", () => ({
  readContentRuntimeSchemaFingerprint: () => Effect.succeed("schema"),
}));

const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({
    directory: tmpdir(),
    prefix: "runtime-process-test-",
  });
  const runtime: LocalRuntime = {
    backend: directory,
    configurationHash: "config",
    databaseInode: 1,
    directory,
    directoryInode: 2,
    environmentHash: "env",
    query: "http://127.0.0.1:43310",
    site: "http://127.0.0.1:43311",
    runtimeSchemaFingerprint: "schema",
    runtimeSelectionHash: "selection",
  };
  return { fs, runtime };
});

function spawner(
  options: {
    exit?: Effect.Effect<ChildProcessSpawner.ExitCode>;
    output?: string;
    running?: Effect.Effect<boolean>;
  } = {}
) {
  const release = vi.fn();
  const commands: ChildProcess.Command[] = [];
  const service = ChildProcessSpawner.make((command) =>
    Effect.gen(function* () {
      commands.push(command);
      yield* Effect.acquireRelease(Effect.void, () => Effect.sync(release));
      return ChildProcessSpawner.makeHandle({
        all: Stream.succeed(
          new TextEncoder().encode(options.output ?? "Convex functions ready!")
        ),
        exitCode: options.exit ?? Effect.never,
        getInputFd: () => Sink.drain,
        getOutputFd: () => Stream.empty,
        isRunning: options.running ?? Effect.succeed(true),
        kill: () => Effect.void,
        pid: ChildProcessSpawner.ProcessId(1),
        stderr: Stream.empty,
        stdin: Sink.drain,
        stdout: Stream.empty,
        unref: Effect.succeed(Effect.void),
      });
    })
  );
  return { commands, release, service };
}

describe("application process ownership", () => {
  afterEach(() => vi.unstubAllGlobals());

  for (const outcome of ["success", "failure", "interruption"]) {
    it.live(`closes its local child after application ${outcome}`, () =>
      Effect.gen(function* () {
        const { fs, runtime } = yield* fixture;
        const child = spawner();
        vi.stubGlobal("fetch", () => Promise.resolve(new Response("owned")));
        const program = Effect.gen(function* () {
          if (outcome === "failure") {
            return yield* contentRuntimeCiError("application failed");
          }
          if (outcome === "interruption") {
            return yield* Effect.interrupt;
          }
          return "built";
        });
        const result = yield* withLocalBackend(runtime, program).pipe(
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            child.service
          ),
          Effect.exit
        );
        expect(result._tag).toBe(outcome === "success" ? "Success" : "Failure");
        expect(child.release).toHaveBeenCalledOnce();
        expect(
          (yield* fs.stat(`${runtime.directory}/convex.log`)).mode % 0o1000
        ).toBe(0o600);
        expect(child.commands).toEqual([
          expect.objectContaining({
            options: expect.objectContaining({
              cwd: runtime.backend,
              env: localConvexEnvironment,
            }),
          }),
        ]);
      }).pipe(Effect.provide(NodeServices.layer))
    );
  }

  it.live(
    "fails closed before spawning when the prepared schema is obsolete",
    () =>
      Effect.gen(function* () {
        const { runtime } = yield* fixture;
        const child = spawner();
        const error = yield* withLocalBackend(
          { ...runtime, runtimeSchemaFingerprint: "old" },
          Effect.void
        ).pipe(
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            child.service
          ),
          Effect.flip
        );
        expect(error).toMatchObject({
          _tag: "ContentRuntimeCiError",
          message: expect.stringContaining("schema changed"),
        });
        expect(child.commands).toHaveLength(0);
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.live(
    "leaves an existing listener alive instead of passing it to Convex",
    () =>
      Effect.gen(function* () {
        const { runtime } = yield* fixture;
        const listener = yield* Effect.acquireRelease(
          Effect.sync(() => createServer()),
          (server) =>
            Effect.callback<void>((resume) => {
              server.close(() => resume(Effect.void));
            })
        );
        yield* Effect.callback<void>((resume) => {
          listener.listen(43_310, "127.0.0.1", () => resume(Effect.void));
        });
        const child = spawner();
        const error = yield* withLocalBackend(runtime, Effect.void).pipe(
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            child.service
          ),
          Effect.flip
        );
        expect(error).toMatchObject({
          _tag: "ContentRuntimeCiError",
          message: expect.stringContaining("occupied"),
        });
        expect(listener.listening).toBe(true);
        expect(child.commands).toHaveLength(0);
      }).pipe(Effect.provide(NodeServices.layer))
  );

  for (const failure of ["exited", "request", "during"] as const) {
    it.live(`reports a typed local backend failure: ${failure}`, () =>
      Effect.gen(function* () {
        const { runtime } = yield* fixture;
        const child = spawner({
          exit: Effect.succeed(ChildProcessSpawner.ExitCode(7)),
          running: Effect.succeed(failure !== "exited"),
        });
        vi.stubGlobal("fetch", () =>
          failure === "request"
            ? Promise.reject(new Error("connection refused"))
            : Promise.resolve(new Response("owned"))
        );
        const error = yield* withLocalBackend(runtime, Effect.never).pipe(
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            child.service
          ),
          Effect.flip
        );
        const messages = {
          exited: "before readiness",
          request: "readiness request",
          during: "during the application",
        };
        expect(error).toMatchObject({
          _tag: "ContentRuntimeCiError",
          message: expect.stringContaining(messages[failure]),
        });
        expect(child.release).toHaveBeenCalledOnce();
      }).pipe(Effect.provide(NodeServices.layer))
    );
  }

  it.effect("bounds backend readiness and releases the child on timeout", () =>
    Effect.gen(function* () {
      const { runtime } = yield* fixture;
      const entered = yield* Deferred.make<void>();
      const child = spawner({
        output: "",
        running: Deferred.succeed(entered, undefined).pipe(Effect.as(true)),
      });
      const fiber = yield* withLocalBackend(runtime, Effect.void).pipe(
        Effect.provideService(
          ChildProcessSpawner.ChildProcessSpawner,
          child.service
        ),
        Effect.flip,
        Effect.forkChild
      );
      yield* Deferred.await(entered);
      yield* TestClock.adjust("4 minutes");
      expect(yield* Fiber.join(fiber)).toMatchObject({
        _tag: "ContentRuntimeCiError",
        message: expect.stringContaining("did not become ready"),
      });
      expect(child.release).toHaveBeenCalledOnce();
    }).pipe(Effect.provide(NodeServices.layer))
  );

  for (const code of [0, 7]) {
    it.effect(
      `keeps acquisition credentials out of build children with exit ${code}`,
      () =>
        Effect.gen(function* () {
          const child = spawner({
            exit: Effect.succeed(ChildProcessSpawner.ExitCode(code)),
          });
          const result = yield* runBuildCommand("/tmp", ["build"], {
            NEXT_PUBLIC_CONVEX_URL: "https://production.convex.cloud",
            CONTENT_RUNTIME_CACHE_KEY: "private",
          }).pipe(
            Effect.provideService(
              ChildProcessSpawner.ChildProcessSpawner,
              child.service
            ),
            Effect.result
          );
          expect(result._tag).toBe(code === 0 ? "Success" : "Failure");
          expect(child.commands).toEqual([
            expect.objectContaining({
              options: expect.objectContaining({
                env: expect.objectContaining({
                  NEXT_PUBLIC_CONVEX_URL: "https://production.convex.cloud",
                  CONTENT_RUNTIME_CACHE_KEY: undefined,
                  CONVEX_DEPLOY_KEY: undefined,
                  CONVEX_DEPLOYMENT_TOKEN: undefined,
                }),
              }),
            }),
          ]);
          if (code === 0) {
            yield* runBuildCommand("/tmp", ["build"]).pipe(
              Effect.provideService(
                ChildProcessSpawner.ChildProcessSpawner,
                child.service
              )
            );
          }
        })
    );
  }
});
