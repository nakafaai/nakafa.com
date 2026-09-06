import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, beforeEach, expect, layer } from "@effect/vitest";
import { TrustedKeySchema } from "@nakafa/aksara-contracts/signature/trusted";
import {
  prepareAcceptance,
  runAcceptance,
} from "@repo/backend/scripts/content/acceptance/build";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import type { LocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { Effect, Exit } from "effect";

const mocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  lease: vi.fn(),
  read: vi.fn(),
  release: vi.fn(),
  reserve: vi.fn(),
  backend: vi.fn(),
  command: vi.fn(),
  publish: vi.fn(),
}));
vi.mock("@repo/backend/scripts/content/acceptance/local", async (load) => ({
  ...(await load<
    typeof import("@repo/backend/scripts/content/acceptance/local")
  >()),
  initializeLocalRuntime: mocks.initialize,
  leaseLocalRuntime: mocks.lease,
  readLocalRuntime: mocks.read,
  releaseLocalRuntime: mocks.release,
  reserveLocalRuntime: mocks.reserve,
}));
vi.mock("@repo/backend/scripts/content/acceptance/process", async (load) => ({
  ...(await load<
    typeof import("@repo/backend/scripts/content/acceptance/process")
  >()),
  withLocalBackend: mocks.backend,
  runBuildCommand: mocks.command,
}));
vi.mock("@repo/backend/scripts/content/acceptance/publication", () => ({
  publishAcceptanceSource: mocks.publish,
}));

const runtime: LocalRuntime = {
  backend: "/test/.cache/acceptance/backend",
  directory: "/test/.cache/acceptance",
  directoryInode: 1,
  databaseInode: 2,
  configurationHash: "test-config",
  environmentHash: "test-env",
  publicationToken: "test-publication-token",
  query: "http://127.0.0.1:43120",
  site: "http://127.0.0.1:43121",
  signing: {
    keyId: TrustedKeySchema.fields.keyId.make("test-key"),
    publicKeyPem: "test-public-key",
    privateKeyPath: "/test/.cache/acceptance/signing.pem",
    privateKeyInode: 3,
    privateKeyHash: "test-private-hash",
  },
};
const reservation = {
  directory: runtime.directory,
  directoryInode: runtime.directoryInode,
};

layer(nodeServicesLayer)("signed acceptance lifecycle", (it) => {
  beforeEach(() => {
    mocks.reserve.mockReturnValue(Effect.succeed(reservation));
    mocks.initialize.mockReturnValue(Effect.succeed(runtime));
    mocks.read.mockReturnValue(Effect.succeed(runtime));
    for (const mock of [
      mocks.lease,
      mocks.release,
      mocks.command,
      mocks.publish,
    ]) {
      mock.mockReturnValue(Effect.void);
    }
    mocks.backend.mockImplementation((_runtime, program) => program);
  });
  afterEach(() => vi.resetAllMocks());

  it.effect(
    "retains a successfully published database without building the app",
    () =>
      Effect.gen(function* () {
        yield* prepareAcceptance("/test");
        expect(mocks.publish).toHaveBeenCalledWith("/test", runtime);
        expect(mocks.backend).toHaveBeenCalledOnce();
        expect(mocks.release).not.toHaveBeenCalled();
        expect(mocks.command).not.toHaveBeenCalled();
      })
  );

  for (const phase of ["lease", "initialize", "backend", "publish"] as const) {
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

  for (const operation of ["build", "start"] as const) {
    it.effect(
      `runs normal ${operation} with the retained local selection and arguments`,
      () =>
        Effect.gen(function* () {
          yield* runAcceptance("/test", operation, ["--filter=www"]);
          expect(mocks.command).toHaveBeenCalledWith(
            "/test",
            ["pnpm", "run", operation, "--filter=www"],
            expect.objectContaining({
              NEXT_PUBLIC_CONVEX_URL: runtime.query,
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

  it.effect("refuses an unprepared acceptance build", () =>
    Effect.gen(function* () {
      mocks.read.mockReturnValue(Effect.void);
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
});
