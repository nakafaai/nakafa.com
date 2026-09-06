import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import type { LocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import {
  localConvexEnvironment,
  runBuildCommand,
  withLocalBackend,
} from "@repo/backend/scripts/content/acceptance/process";
import { createLocalSigningIdentity } from "@repo/backend/scripts/content/acceptance/signing";
import {
  Deferred,
  Effect,
  Fiber,
  FileSystem,
  Logger,
  Schedule,
  Sink,
  Stream,
} from "effect";
import { TestClock } from "effect/testing";
import {
  type ChildProcess,
  ChildProcessSpawner,
} from "effect/unstable/process";

const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({
    directory: tmpdir(),
    prefix: "acceptance-process-test-",
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
    ...(yield* createLocalSigningIdentity(directory)),
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
            return yield* acceptanceRuntimeError("application failed");
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
              env: {
                ...localConvexEnvironment,
                AKSARA_AGENT_SIGNING_KEY_ID: runtime.signing.keyId,
                AKSARA_AGENT_SIGNING_PUBLIC_KEY: runtime.signing.publicKeyPem,
              },
            }),
          }),
        ]);
      }).pipe(Effect.provide(nodeServicesLayer))
    );
  }

  it.live(
    "reports bounded redacted backend diagnostics while preserving the publication failure",
    () =>
      Effect.gen(function* () {
        const { runtime } = yield* fixture;
        const child = spawner({
          output: `${"Convex functions ready!\n".repeat(300)}\u001B[31mStaging rejected: missing publication owner\u001B[0m ${runtime.publicationToken}`,
        });
        const messages: string[] = [];
        const logger = Logger.make(({ message }) =>
          messages.push(String(message))
        );
        const original = acceptanceRuntimeError(
          "Signed publication returned HTTP 500."
        );
        vi.stubGlobal("fetch", () => Promise.resolve(new Response("owned")));
        const failure = yield* withLocalBackend(runtime, original).pipe(
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            child.service
          ),
          Effect.provide(Logger.layer([logger])),
          Effect.flip
        );
        expect(failure).toBe(original);
        expect(messages).toHaveLength(1);
        expect(messages[0]).toContain(
          "Staging rejected: missing publication owner [redacted]"
        );
        expect(messages[0]).not.toContain(runtime.publicationToken);
        expect(messages[0]).not.toContain("\u001B");
        expect(messages[0]?.length).toBeLessThanOrEqual(2040);
        expect(child.release).toHaveBeenCalledOnce();
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  for (const state of ["empty", "missing"]) {
    it.live(
      `preserves the original failure when its backend log is ${state}`,
      () =>
        Effect.gen(function* () {
          const { fs, runtime } = yield* fixture;
          const child = spawner();
          const messages: unknown[] = [];
          const logger = Logger.make(({ message }) => messages.push(message));
          const original = acceptanceRuntimeError("Signed publication failed.");
          vi.stubGlobal("fetch", () => Promise.resolve(new Response("owned")));
          const program = Effect.gen(function* () {
            const logPath = `${runtime.directory}/convex.log`;
            yield* state === "empty"
              ? fs.writeFileString(logPath, "")
              : fs.remove(logPath);
            return yield* original;
          });
          expect(
            yield* withLocalBackend(runtime, program).pipe(
              Effect.provideService(
                ChildProcessSpawner.ChildProcessSpawner,
                child.service
              ),
              Effect.provide(Logger.layer([logger])),
              Effect.flip
            )
          ).toBe(original);
          expect(messages).toEqual([]);
          expect(child.release).toHaveBeenCalledOnce();
        }).pipe(Effect.provide(nodeServicesLayer))
    );
  }

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
          _tag: "AcceptanceRuntimeError",
          message: expect.stringContaining("occupied"),
        });
        expect(listener.listening).toBe(true);
        expect(child.commands).toHaveLength(0);
      }).pipe(Effect.provide(nodeServicesLayer))
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
          _tag: "AcceptanceRuntimeError",
          message: expect.stringContaining(messages[failure]),
        });
        expect(child.release).toHaveBeenCalledOnce();
      }).pipe(Effect.provide(nodeServicesLayer))
    );
  }

  it.effect("bounds backend readiness and releases the child on timeout", () =>
    Effect.gen(function* () {
      const { fs, runtime } = yield* fixture;
      const readinessLog = yield* Deferred.make<string>();
      const child = spawner({ output: "" });
      const request = vi.fn();
      const application = vi.fn();
      vi.stubGlobal("fetch", request);
      const fiber = yield* withLocalBackend(
        runtime,
        Effect.sync(application)
      ).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          readFileString: (path) =>
            fs
              .readFileString(path)
              .pipe(Effect.tap((log) => Deferred.succeed(readinessLog, log))),
        }),
        Effect.provideService(
          ChildProcessSpawner.ChildProcessSpawner,
          child.service
        ),
        Effect.flip,
        Effect.forkChild
      );
      expect(yield* Deferred.await(readinessLog)).toBe("");
      yield* TestClock.adjust("4 minutes");
      expect(yield* Fiber.join(fiber)).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: expect.stringContaining("did not become ready"),
      });
      expect(request).not.toHaveBeenCalled();
      expect(application).not.toHaveBeenCalled();
      expect(child.release).toHaveBeenCalledOnce();
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live("waits for an interrupted command to finish its cleanup", () =>
    Effect.gen(function* () {
      const { fs, runtime } = yield* fixture;
      const script = `${runtime.directory}/worker.mjs`;
      yield* fs.writeFileString(
        script,
        `import { writeFileSync } from "node:fs";
process.once("SIGINT", () => {
  writeFileSync("stopped", "SIGINT");
  process.exit(0);
});
setInterval(() => {}, 1000);
writeFileSync("ready", "ready");`
      );
      const child = yield* runBuildCommand(runtime.directory, [
        process.execPath,
        script,
      ]).pipe(Effect.scoped, Effect.forkChild);
      yield* fs.exists(`${runtime.directory}/ready`).pipe(
        Effect.repeat({
          while: (ready) => !ready,
          schedule: Schedule.spaced("10 millis"),
        }),
        Effect.timeout("5 seconds")
      );
      yield* Fiber.interrupt(child);
      expect(yield* fs.readFileString(`${runtime.directory}/stopped`)).toBe(
        "SIGINT"
      );
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  for (const code of [0, 7]) {
    it.effect(
      `keeps acquisition credentials out of build children with exit ${code}`,
      () =>
        Effect.gen(function* () {
          const child = spawner({
            exit: Effect.succeed(ChildProcessSpawner.ExitCode(code)),
          });
          const result = yield* runBuildCommand("/tmp", ["pnpm", "build"], {
            NEXT_PUBLIC_CONVEX_URL: "https://production.convex.cloud",
            AKSARA_ACCEPTANCE_PRIVATE_KEY: "private",
            AKSARA_SIGNING_PRIVATE_KEY: "private",
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
                  AKSARA_ACCEPTANCE_PRIVATE_KEY: undefined,
                  AKSARA_SIGNING_PRIVATE_KEY: undefined,
                  CONVEX_DEPLOY_KEY: undefined,
                  CONVEX_DEPLOYMENT_TOKEN: undefined,
                }),
              }),
            }),
          ]);
          if (code === 0) {
            yield* runBuildCommand("/tmp", ["pnpm", "build"]).pipe(
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
