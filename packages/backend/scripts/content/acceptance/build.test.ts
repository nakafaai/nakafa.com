import { afterEach, beforeEach, expect, layer } from "@effect/vitest";
import { TrustedKeySchema } from "@nakafa/aksara-contracts/signature/trusted";
import type { withAnalyticsSink } from "@repo/backend/scripts/content/acceptance/analytics";
import {
  buildMode,
  keyMode,
  prepareAcceptance,
  prepareMode,
  runAcceptance,
  startMode,
} from "@repo/backend/scripts/content/acceptance/build";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import type { LocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import type { withLocalBackend } from "@repo/backend/scripts/content/acceptance/process";
import { nodePlatform } from "@repo/backend/test/platform";
import { FetchClient } from "@repo/utilities/http/client";
import { ConfigProvider, Effect, Exit, Layer, MutableList } from "effect";
import { TestConsole } from "effect/testing";

/** What a program run under the acceptance backend or analytics sink can fail with. */
type AcceptanceError = Effect.Error<ReturnType<typeof runAcceptance>>;

const mocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  lease: vi.fn(),
  release: vi.fn(),
  reservedRuntime: vi.fn(),
  reserve: vi.fn(),
  backend: vi.fn<typeof withLocalBackend<void, AcceptanceError, never>>(),
  command: vi.fn(),
  publish: vi.fn(),
  renderer: vi.fn(),
  key: vi.fn(),
  restore: vi.fn(),
  save: vi.fn(),
  sink: vi.fn<typeof withAnalyticsSink<void, AcceptanceError, never>>(),
}));
vi.mock("@repo/backend/scripts/content/acceptance/analytics", () => ({
  withAnalyticsSink: mocks.sink,
}));
vi.mock("@repo/backend/scripts/content/acceptance/local", async (load) => ({
  ...(await load<
    typeof import("@repo/backend/scripts/content/acceptance/local")
  >()),
  initializeLocalRuntime: mocks.initialize,
  leaseReservedLocalRuntime: mocks.reservedRuntime,
  releaseLocalRuntime: mocks.release,
  reserveLocalRuntime: mocks.reserve,
}));
vi.mock("@repo/backend/scripts/content/acceptance/lease", () => ({
  leaseLocalRuntime: mocks.lease,
}));
vi.mock("@repo/backend/scripts/content/acceptance/process", async (load) => ({
  ...(await load<
    typeof import("@repo/backend/scripts/content/acceptance/process")
  >()),
  withLocalBackend: mocks.backend,
}));
vi.mock("@repo/backend/scripts/content/acceptance/publication", () => ({
  exportRenderer: mocks.renderer,
  publishAcceptanceSource: mocks.publish,
}));
vi.mock("@repo/backend/scripts/content/acceptance/snapshot", async (load) => ({
  ...(await load<
    typeof import("@repo/backend/scripts/content/acceptance/snapshot")
  >()),
  preparedKey: mocks.key,
  restorePrepared: mocks.restore,
  savePrepared: mocks.save,
}));
vi.mock("@repo/backend/scripts/content/acceptance/terminal", () => ({
  runBuildCommand: mocks.command,
}));

const runtime: LocalRuntime = {
  analytics: "http://127.0.0.1:43122",
  app: "http://localhost:3000",
  backend: "/test/.cache/acceptance/backend",
  directory: "/test/.cache/acceptance",
  directoryInode: 1n,
  databaseInode: 2n,
  configurationHash: "test-config",
  environmentHash: "test-env",
  publicationToken: "test-publication-token",
  query: "http://127.0.0.1:43120",
  site: "http://127.0.0.1:43121",
  signing: {
    keyId: TrustedKeySchema.fields.keyId.make("test-key"),
    publicKeyPem: "test-public-key",
    privateKeyPath: "/test/.cache/acceptance/signing.pem",
    privateKeyInode: 3n,
    privateKeyHash: "test-private-hash",
  },
};
const reservation = {
  directory: runtime.directory,
  directoryInode: runtime.directoryInode,
};

const RENDERER = "/test/.cache/acceptance/renderer.json";
const KEY = "a".repeat(64);
const STORE = "/test/snapshots";

// No test reads the shell's ACCEPTANCE_PORT: each one names the port it runs with.
const services = Layer.mergeAll(
  nodePlatform,
  FetchClient,
  ConfigProvider.layer(
    ConfigProvider.fromEnvRecord({ ACCEPTANCE_SNAPSHOTS: STORE })
  )
);

/** Runs a program with one ACCEPTANCE_PORT, as the shell would name it. */
const withPort =
  (port: string) =>
  <A, E, R>(program: Effect.Effect<A, E, R>) =>
    program.pipe(
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnvRecord({ ACCEPTANCE_PORT: port })
      )
    );

layer(services)("signed acceptance lifecycle", (it) => {
  beforeEach(() => {
    mocks.reserve.mockReturnValue(Effect.succeed(reservation));
    mocks.initialize.mockReturnValue(Effect.succeed(runtime));
    mocks.reservedRuntime.mockReturnValue(Effect.succeedSome(runtime));
    mocks.renderer.mockReturnValue(Effect.succeed(RENDERER));
    mocks.key.mockReturnValue(Effect.succeed(KEY));
    mocks.restore.mockReturnValue(Effect.succeedNone);
    for (const mock of [
      mocks.save,
      mocks.lease,
      mocks.release,
      mocks.command,
      mocks.publish,
    ]) {
      mock.mockReturnValue(Effect.void);
    }
    mocks.backend.mockImplementation((_runtime, program) => program);
    mocks.sink.mockImplementation((_origin, _directory, program) => program);
  });
  afterEach(() => vi.resetAllMocks());

  it.effect(
    "retains a successfully published database without building the app",
    () =>
      Effect.gen(function* () {
        yield* prepareAcceptance("/test");
        expect(mocks.renderer).toHaveBeenCalledWith("/test", runtime.directory);
        expect(mocks.key).toHaveBeenCalledWith(
          "/test",
          RENDERER,
          "http://localhost:3000"
        );
        expect(mocks.restore).toHaveBeenCalledWith(
          STORE,
          KEY,
          "/test",
          reservation
        );
        expect(mocks.publish).toHaveBeenCalledWith(runtime, RENDERER);
        expect(mocks.save).toHaveBeenCalledWith(STORE, KEY, runtime);
        expect(mocks.backend).toHaveBeenCalledOnce();
        expect(mocks.release).not.toHaveBeenCalled();
        expect(mocks.command).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "restores the saved runtime of an unchanged key and prepares nothing",
    () =>
      Effect.gen(function* () {
        mocks.restore.mockReturnValue(Effect.succeedSome(runtime));
        yield* prepareAcceptance("/test");
        expect(mocks.initialize).not.toHaveBeenCalled();
        expect(mocks.backend).not.toHaveBeenCalled();
        expect(mocks.publish).not.toHaveBeenCalled();
        expect(mocks.save).not.toHaveBeenCalled();
        expect(mocks.release).not.toHaveBeenCalled();
      })
  );

  it.effect("prints the key that prepare would restore or save", () =>
    Effect.gen(function* () {
      const lines = yield* Effect.gen(function* () {
        yield* keyMode.run("/test").pipe(Effect.scoped);
        return yield* TestConsole.logLines;
      }).pipe(Effect.provide(TestConsole.layer));
      expect(lines).toContain(KEY);
      expect(mocks.renderer).toHaveBeenCalledWith(
        "/test",
        expect.stringContaining("acceptance-key-")
      );
      expect(mocks.reserve).not.toHaveBeenCalled();
    })
  );

  for (const phase of [
    "lease",
    "renderer",
    "key",
    "restore",
    "initialize",
    "backend",
    "publish",
    "save",
  ] as const) {
    it.effect(`releases its reservation when ${phase} fails`, () =>
      Effect.gen(function* () {
        const failure = acceptanceRuntimeError(`test ${phase} failure`);
        mocks[phase].mockReturnValue(Effect.fail(failure));
        expect(yield* prepareAcceptance("/test").pipe(Effect.flip)).toBe(
          failure
        );
        expect(mocks.release).toHaveBeenCalledWith(reservation);
        expect(mocks.command).not.toHaveBeenCalled();
      })
    );
  }

  it.effect("does not clean a reservation it failed to acquire", () =>
    Effect.gen(function* () {
      mocks.reserve.mockReturnValue(
        Effect.fail(acceptanceRuntimeError("already exists"))
      );
      yield* prepareAcceptance("/test").pipe(Effect.flip);
      expect(mocks.release).not.toHaveBeenCalled();
      expect(mocks.initialize).not.toHaveBeenCalled();
    })
  );

  it.effect("releases its reservation after publication interruption", () =>
    Effect.gen(function* () {
      mocks.publish.mockReturnValue(Effect.interrupt);
      const result = yield* prepareAcceptance("/test").pipe(Effect.exit);
      expect(Exit.hasInterrupts(result)).toBe(true);
      expect(mocks.release).toHaveBeenCalledWith(reservation);
    })
  );

  for (const [operation, command] of [
    [
      "build",
      ["nice", "-n", "10", "bunx", "turbo", "run", "build", "--filter=www"],
    ],
    [
      "start",
      [
        "bunx",
        "--cwd",
        "apps/www",
        "vite",
        "preview",
        "--strictPort",
        "--port",
        "3000",
      ],
    ],
  ] as const) {
    it.effect(
      `runs normal ${operation} with the retained local selection and arguments`,
      () =>
        Effect.gen(function* () {
          yield* runAcceptance("/test", operation, ["--force"]);
          expect(mocks.command).toHaveBeenCalledWith(
            "/test",
            [...command, "--force"],
            expect.objectContaining({
              VITE_CONVEX_URL: runtime.query,
              AKSARA_AGENT_SIGNING_PUBLIC_KEY: runtime.signing.publicKeyPem,
              AKSARA_ACCEPTANCE_PRIVATE_KEY: undefined,
              CONVEX_DEPLOY_KEY: undefined,
            })
          );
          expect(mocks.reserve).not.toHaveBeenCalled();
          expect(mocks.publish).not.toHaveBeenCalled();
          expect(mocks.release).not.toHaveBeenCalled();
        })
    );
  }

  it.effect(
    "clears foreign signed responses once the backend is ready, before building",
    () =>
      Effect.gen(function* () {
        const steps = MutableList.make<string>();
        const record = (step: string) =>
          Effect.sync(() => MutableList.append(steps, step));
        mocks.backend.mockImplementation((_runtime, program) =>
          record("backend ready").pipe(Effect.andThen(program))
        );
        mocks.sink.mockImplementation((_origin, _directory, program) =>
          record("analytics stand-in").pipe(Effect.andThen(program))
        );
        mocks.command.mockReturnValue(record("command"));
        yield* runAcceptance("/test", "build", []);
        expect(mocks.sink).not.toHaveBeenCalled();
        expect(MutableList.toArray(steps)).toEqual([
          "backend ready",
          "command",
        ]);
        MutableList.clear(steps);
        yield* runAcceptance("/test", "start", []);
        expect(mocks.sink).toHaveBeenCalledWith(
          runtime.analytics,
          runtime.directory,
          expect.anything()
        );
        expect(MutableList.toArray(steps)).toEqual([
          "analytics stand-in",
          "backend ready",
          "command",
        ]);
      })
  );

  it.effect(
    "serves the port of the origin that prepare recorded, as ACCEPTANCE_PORT names it",
    () =>
      Effect.gen(function* () {
        mocks.reservedRuntime.mockReturnValue(
          Effect.succeedSome({ ...runtime, app: "http://localhost:3100" })
        );
        yield* runAcceptance("/test", "start", []).pipe(withPort("3100"));
        expect(mocks.command).toHaveBeenCalledWith(
          "/test",
          [
            "bunx",
            "--cwd",
            "apps/www",
            "vite",
            "preview",
            "--strictPort",
            "--port",
            "3100",
          ],
          expect.objectContaining({
            SITE_URL: "http://localhost:3100",
            VITE_SITE_URL: "http://localhost:3100",
            VITE_POSTHOG_UI_HOST: "http://localhost:3100",
          })
        );
      })
  );

  for (const operation of ["build", "start"] as const) {
    it.effect(
      `refuses to ${operation} when ACCEPTANCE_PORT names another origin than prepare recorded`,
      () =>
        Effect.gen(function* () {
          expect(
            yield* runAcceptance("/test", operation, []).pipe(
              withPort("3100"),
              Effect.flip
            )
          ).toMatchObject({
            _tag: "AcceptanceRuntimeError",
            message: expect.stringContaining(
              "This runtime serves http://localhost:3000, but ACCEPTANCE_PORT names http://localhost:3100."
            ),
          });
          expect(mocks.backend).not.toHaveBeenCalled();
          expect(mocks.sink).not.toHaveBeenCalled();
          expect(mocks.command).not.toHaveBeenCalled();
        })
    );
  }

  it.effect("refuses an unprepared acceptance build", () =>
    Effect.gen(function* () {
      mocks.reservedRuntime.mockReturnValue(Effect.succeedNone);
      expect(
        yield* runAcceptance("/test", "build", []).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: expect.stringContaining("acceptance:prepare"),
      });
      expect(mocks.command).not.toHaveBeenCalled();
      expect(mocks.lease).not.toHaveBeenCalled();
    })
  );

  it.effect("runs the prepare mode for the repository root", () =>
    Effect.gen(function* () {
      yield* prepareMode.run("/test");
      expect(mocks.publish).toHaveBeenCalledWith(runtime, RENDERER);
    })
  );

  it.effect(
    "runs the build and start modes with the arguments after their words",
    () =>
      Effect.gen(function* () {
        yield* buildMode.run("/test", ["--force"]);
        yield* startMode.run("/test", ["--host"]);
        expect(mocks.command).toHaveBeenNthCalledWith(
          1,
          "/test",
          [
            "nice",
            "-n",
            "10",
            "bunx",
            "turbo",
            "run",
            "build",
            "--filter=www",
            "--force",
          ],
          expect.anything()
        );
        expect(mocks.command).toHaveBeenNthCalledWith(
          2,
          "/test",
          [
            "bunx",
            "--cwd",
            "apps/www",
            "vite",
            "preview",
            "--strictPort",
            "--port",
            "3000",
            "--host",
          ],
          expect.objectContaining({ VITE_CONVEX_URL: runtime.query })
        );
      })
  );
});
