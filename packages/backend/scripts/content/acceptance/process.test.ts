import { beforeEach, describe, expect, it } from "@effect/vitest";
import { LocalDeploymentJson } from "@repo/backend/scripts/content/acceptance/deployment";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import type { LocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import {
  localConvexEnvironment,
  PRODUCTION_CONCURRENCY,
  withLocalBackend,
} from "@repo/backend/scripts/content/acceptance/process";
import { createLocalSigningIdentity } from "@repo/backend/scripts/content/acceptance/signing";
import { isPortOccupied, occupyPort } from "@repo/backend/test/acceptance";
import { nodePlatform } from "@repo/backend/test/platform";
import { FetchClient } from "@repo/utilities/http/client";
import {
  Array as Arr,
  Deferred,
  Effect,
  Fiber,
  FileSystem,
  Layer,
  Logger,
  MutableList,
  Path,
  Predicate,
  Schema,
  Sink,
  Stream,
} from "effect";
import { FetchHttpClient } from "effect/http";
import { type ChildProcess, ChildProcessSpawner } from "effect/process";
import { TestClock } from "effect/testing";

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();
/** Node services with the Fetch client reading that controlled fetch. */
const services = Layer.mergeAll(
  nodePlatform,
  FetchClient,
  Layer.succeed(FetchHttpClient.Fetch, fetcher)
);

/** The deployment `convex init` saved. The backend answers with its name. */
const LOCAL_DEPLOYMENT = {
  adminKey: "local-admin-key",
  backendVersion: "precompiled-test",
  deploymentName: "owned",
  instanceSecret: "local-instance-secret",
  ports: { cloud: 43_310, site: 43_311 },
};

const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({
    prefix: "acceptance-process-test-",
  });
  const state = `${directory}/.convex/local/default`;
  yield* fs.makeDirectory(state, { recursive: true });
  yield* fs.writeFileString(
    `${state}/config.json`,
    yield* Schema.encodeEffect(LocalDeploymentJson)(LOCAL_DEPLOYMENT)
  );
  const runtime: LocalRuntime = {
    analytics: "http://127.0.0.1:43312",
    app: "http://localhost:3000",
    backend: directory,
    configurationHash: "config",
    databaseInode: 1n,
    directory,
    directoryInode: 2n,
    environmentHash: "env",
    query: "http://127.0.0.1:43310",
    site: "http://127.0.0.1:43311",
    ...(yield* createLocalSigningIdentity(directory)),
  };
  return { fs, runtime };
});

const isDeploy = (command: ChildProcess.Command) =>
  command._tag === "StandardCommand" && Arr.contains(command.args, "deploy");

const spawner = Effect.fn("ProcessTest.spawner")(function* (
  options: {
    /** The exit code of the one `convex deploy`, which succeeds unless a test says otherwise. */
    deployExit?: number;
    exit?: Effect.Effect<ChildProcessSpawner.ExitCode>;
    output?: string;
    running?: Effect.Effect<boolean>;
  } = {}
) {
  const fs = yield* FileSystem.FileSystem;
  const release = vi.fn();
  const commands = MutableList.make<ChildProcess.Command>();
  const temporaryRoots = MutableList.make<string>();
  const service = ChildProcessSpawner.make((command) =>
    Effect.gen(function* () {
      MutableList.append(commands, command);
      const tmpdir =
        command._tag === "StandardCommand"
          ? command.options.env?.TMPDIR
          : undefined;
      // The runtime passes its temporary root as plain text, never redacted.
      const root = Predicate.isString(tmpdir) ? tmpdir : undefined;
      if (root !== undefined) {
        MutableList.append(temporaryRoots, root);
      }
      // Records whether the command's temporary root outlived its group.
      yield* Effect.acquireRelease(Effect.void, () =>
        Effect.gen(function* () {
          const present = root === undefined ? false : yield* fs.exists(root);
          release(present);
        }).pipe(Effect.orDie)
      );
      const deploying = isDeploy(command);
      return ChildProcessSpawner.makeHandle({
        all: deploying
          ? Stream.empty
          : Stream.succeed(new TextEncoder().encode(options.output ?? "")),
        exitCode: deploying
          ? Effect.succeed(
              ChildProcessSpawner.ExitCode(options.deployExit ?? 0)
            )
          : (options.exit ?? Effect.never),
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
  return { commands, release, service, temporaryRoots };
});

describe("application process ownership", () => {
  beforeEach(() => {
    fetcher.mockReset();
  });

  for (const outcome of ["success", "failure", "interruption"]) {
    it.live(`closes its local child after application ${outcome}`, () =>
      Effect.gen(function* () {
        const { fs, runtime } = yield* fixture;
        const path = yield* Path.Path;
        const child = yield* spawner();
        fetcher.mockImplementation(() =>
          Promise.resolve(new Response("owned"))
        );
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
        // The temporary root outlives both process groups, then leaves with them.
        expect(child.release.mock.calls).toEqual([[true], [true]]);
        expect(
          (yield* fs.stat(`${runtime.directory}/convex.log`)).mode % 0o1000
        ).toBe(0o600);
        const environment = {
          ...localConvexEnvironment,
          AKSARA_AGENT_SIGNING_KEY_ID: runtime.signing.keyId,
          AKSARA_AGENT_SIGNING_PUBLIC_KEY: runtime.signing.publicKeyPem,
          DATABASE_UDF_USER_TIMEOUT_SECONDS: "5",
          FUNRUN_ISOLATE_ACTIVE_THREADS: String(navigator.hardwareConcurrency),
          ISOLATE_ANALYZE_USER_TIMEOUT_SECONDS: "30",
          TMPDIR: expect.stringContaining(
            `${path.dirname(runtime.directory)}/convex-`
          ),
        };
        const state = `${runtime.backend}/.convex/local/default`;
        const environmentFile = `${runtime.backend}/deploy.env`;
        expect(MutableList.toArray(child.commands)).toEqual([
          expect.objectContaining({
            args: [
              "--port",
              "43310",
              "--site-proxy-port",
              "43311",
              "--instance-name",
              LOCAL_DEPLOYMENT.deploymentName,
              "--instance-secret",
              LOCAL_DEPLOYMENT.instanceSecret,
              "--local-storage",
              `${state}/convex_local_storage`,
              "--local-log-sink",
              `${runtime.directory}/functions.log`,
              "--disable-beacon",
              `${state}/convex_local_backend.sqlite3`,
            ],
            command: expect.stringContaining(
              `/.cache/convex/binaries/${LOCAL_DEPLOYMENT.backendVersion}/convex-local-backend`
            ),
            options: expect.objectContaining({
              cwd: runtime.backend,
              env: environment,
            }),
          }),
          expect.objectContaining({
            args: [
              "node_modules/convex/bin/main.js",
              "deploy",
              "--typecheck",
              "disable",
              "--skip-large-indexes-check",
              "--env-file",
              environmentFile,
            ],
            options: expect.objectContaining({
              cwd: path.resolve(runtime.directory, "../../packages/backend"),
              env: environment,
            }),
          }),
        ]);
        expect(yield* fs.readFileString(environmentFile)).toBe(
          `CONVEX_SELF_HOSTED_URL=${runtime.query}\nCONVEX_SELF_HOSTED_ADMIN_KEY=${LOCAL_DEPLOYMENT.adminKey}\n`
        );
        expect((yield* fs.stat(environmentFile)).mode % 0o1000).toBe(0o600);
        expect(child.temporaryRoots).toHaveLength(2);
        for (const root of MutableList.toArray(child.temporaryRoots)) {
          expect(yield* fs.exists(root)).toBe(false);
        }
      }).pipe(Effect.provide(services))
    );
  }

  it.live(
    "starts the backend with the concurrency its caller asks for, such as production's",
    () =>
      Effect.gen(function* () {
        const { runtime } = yield* fixture;
        const child = yield* spawner();
        fetcher.mockImplementation(() =>
          Promise.resolve(new Response("owned"))
        );
        yield* withLocalBackend(
          runtime,
          Effect.void,
          PRODUCTION_CONCURRENCY
        ).pipe(
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            child.service
          )
        );
        expect(MutableList.toArray(child.commands)[0]).toEqual(
          expect.objectContaining({
            options: expect.objectContaining({
              env: expect.objectContaining({
                APPLICATION_MAX_CONCURRENT_MUTATIONS: "256",
                APPLICATION_MAX_CONCURRENT_QUERIES: "256",
                APPLICATION_MAX_CONCURRENT_V8_ACTIONS: "512",
              }),
            }),
          })
        );
      }).pipe(Effect.provide(services))
  );

  it.live(
    "reports bounded redacted backend diagnostics while preserving the publication failure",
    () =>
      Effect.gen(function* () {
        const { runtime } = yield* fixture;
        const child = yield* spawner({
          output: `${"Local backend listening\n".repeat(300)}\u001B[31mStaging rejected: missing publication owner\u001B[0m ${runtime.publicationToken}`,
        });
        const messages = MutableList.make<string>();
        const logger = Logger.make(({ message }) =>
          MutableList.append(messages, String(message))
        );
        const original = acceptanceRuntimeError(
          "Signed publication returned HTTP 500."
        );
        fetcher.mockImplementation(() =>
          Promise.resolve(new Response("owned"))
        );
        const failure = yield* withLocalBackend(runtime, original).pipe(
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            child.service
          ),
          Effect.provide(Logger.layer([logger])),
          Effect.flip
        );
        expect(failure).toBe(original);
        const logged = MutableList.toArray(messages);
        expect(messages).toHaveLength(1);
        expect(logged[0]).toContain(
          "Staging rejected: missing publication owner [redacted]"
        );
        expect(logged[0]).not.toContain(runtime.publicationToken);
        expect(logged[0]).not.toContain("\u001B");
        expect(logged[0]?.length).toBeLessThanOrEqual(2040);
        expect(child.release).toHaveBeenCalledTimes(2);
      }).pipe(Effect.provide(services))
  );

  for (const state of ["empty", "missing"]) {
    it.live(
      `preserves the original failure when its backend log is ${state}`,
      () =>
        Effect.gen(function* () {
          const { fs, runtime } = yield* fixture;
          const child = yield* spawner();
          const messages = MutableList.make<unknown>();
          const logger = Logger.make(({ message }) =>
            MutableList.append(messages, message)
          );
          const original = acceptanceRuntimeError("Signed publication failed.");
          fetcher.mockImplementation(() =>
            Promise.resolve(new Response("owned"))
          );
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
          expect(MutableList.toArray(messages)).toEqual([]);
          expect(child.release).toHaveBeenCalledTimes(2);
        }).pipe(Effect.provide(services))
    );
  }

  it.live(
    "leaves an existing listener alive instead of passing it to Convex",
    () =>
      Effect.gen(function* () {
        const { runtime } = yield* fixture;
        yield* occupyPort(43_310);
        const child = yield* spawner();
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
        expect(yield* isPortOccupied(43_310)).toBe(true);
        expect(child.commands).toHaveLength(0);
      }).pipe(Effect.provide(services))
  );

  for (const failure of ["exited", "deploy", "during"] as const) {
    it.live(`reports a typed local backend failure: ${failure}`, () =>
      Effect.gen(function* () {
        const { runtime } = yield* fixture;
        const child = yield* spawner({
          deployExit: failure === "deploy" ? 1 : 0,
          exit: Effect.succeed(ChildProcessSpawner.ExitCode(7)),
          running: Effect.succeed(failure !== "exited"),
        });
        fetcher.mockImplementation(() =>
          Promise.resolve(new Response("owned"))
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
          deploy: "deploy exited with code 1",
          during: "during the application",
        };
        expect(error).toMatchObject({
          _tag: "AcceptanceRuntimeError",
          message: expect.stringContaining(messages[failure]),
        });
        expect(child.release).toHaveBeenCalledTimes(
          failure === "exited" ? 1 : 2
        );
      }).pipe(Effect.provide(services))
    );
  }

  it.live("keeps the admin key out of a failed deploy's message", () =>
    Effect.gen(function* () {
      const { runtime } = yield* fixture;
      const child = yield* spawner({
        deployExit: 1,
        output: `The push failed for ${LOCAL_DEPLOYMENT.adminKey}`,
      });
      fetcher.mockImplementation(() => Promise.resolve(new Response("owned")));
      const error = yield* withLocalBackend(runtime, Effect.void).pipe(
        Effect.provideService(
          ChildProcessSpawner.ChildProcessSpawner,
          child.service
        ),
        Effect.flip
      );
      expect(error.message).toContain("The push failed for [redacted]");
    }).pipe(Effect.provide(services))
  );

  it.live(
    "waits through a refused connection until its own backend answers",
    () =>
      Effect.gen(function* () {
        const { runtime } = yield* fixture;
        const child = yield* spawner();
        const refused = new Error("connection refused");
        fetcher
          .mockRejectedValueOnce(refused)
          .mockImplementation(() => Promise.resolve(new Response("owned")));
        yield* withLocalBackend(runtime, Effect.void).pipe(
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            child.service
          )
        );
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(child.commands).toHaveLength(2);
      }).pipe(Effect.provide(services))
  );

  it.effect("bounds backend readiness and releases the child on timeout", () =>
    Effect.gen(function* () {
      const { runtime } = yield* fixture;
      const asked = yield* Deferred.make<void>();
      const child = yield* spawner();
      const application = vi.fn<() => void>();
      fetcher.mockImplementation(() => {
        Deferred.doneUnsafe(asked, Effect.void);
        return Promise.resolve(new Response("another backend"));
      });
      const fiber = yield* withLocalBackend(
        runtime,
        Effect.sync(application)
      ).pipe(
        Effect.provideService(
          ChildProcessSpawner.ChildProcessSpawner,
          child.service
        ),
        Effect.flip,
        Effect.forkChild
      );
      yield* Deferred.await(asked);
      // A push that outlasts four minutes on a busy machine still gets its start.
      yield* TestClock.adjust("9 minutes");
      expect(fiber.pollUnsafe()).toBeUndefined();
      yield* TestClock.adjust("1 minute");
      expect(yield* Fiber.join(fiber)).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: expect.stringContaining("did not become ready"),
      });
      expect(application).not.toHaveBeenCalled();
      expect(child.commands).toHaveLength(1);
      expect(child.release).toHaveBeenCalledOnce();
    }).pipe(Effect.provide(services))
  );
});
