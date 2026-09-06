import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { TrustedKeySchema } from "@nakafa/aksara-contracts/signature/trusted";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import type { LocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import {
  prepareAcceptanceSource,
  publishAcceptanceSource,
} from "@repo/backend/scripts/content/acceptance/publication";
import source from "@repo/backend/scripts/content/acceptance/source.json" with {
  type: "json",
};
import { Effect, FileSystem } from "effect";

const mocks = vi.hoisted(() => ({ command: vi.fn() }));
vi.mock("@repo/backend/scripts/content/acceptance/command", () => ({
  runAcceptanceCommand: mocks.command,
}));

const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({
    prefix: "acceptance-publication-test-",
  });
  const runtime: LocalRuntime = {
    backend: `${directory}/backend`,
    directory,
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
      privateKeyPath: `${directory}/signing.pem`,
      privateKeyInode: 3,
      privateKeyHash: "test-private-hash",
    },
  };
  return { fs, runtime };
});

describe("pinned Aksara acceptance publication", () => {
  afterEach(() => vi.resetAllMocks());

  it.live(
    "uses only the pinned source and exports the real renderer before local signed publication",
    () =>
      Effect.gen(function* () {
        const { fs, runtime } = yield* fixture;
        mocks.command.mockImplementation(
          (spec: {
            command: string;
            args: readonly string[];
            stdoutPath: string;
          }) =>
            spec.args.includes("renderer:manifest")
              ? fs.writeFileString(spec.stdoutPath, "test-real-renderer-output")
              : Effect.void
        );
        yield* publishAcceptanceSource("/test/nakafa", runtime);
        expect(
          yield* fs.readFileString(`${runtime.directory}/renderer.json`)
        ).toBe("test-real-renderer-output");
        expect(
          (yield* fs.stat(`${runtime.directory}/renderer.json`)).mode % 0o1000
        ).toBe(0o600);
        const calls = mocks.command.mock.calls.map(([spec]) => spec);
        expect(calls[0]).toMatchObject({
          command: "pnpm",
          cwd: "/test/nakafa",
          args: ["--silent", "--filter", "www", "renderer:manifest"],
        });
        expect(
          calls.slice(1, 6).map(({ command, args }) => [command, ...args])
        ).toEqual([
          ["git", "init", "--quiet"],
          ["git", "remote", "add", "origin", source.repository],
          [
            "git",
            "fetch",
            "--quiet",
            "--depth",
            "1",
            "origin",
            source.revision,
          ],
          [
            "git",
            "-c",
            "core.hooksPath=/dev/null",
            "checkout",
            "--quiet",
            "--detach",
            source.revision,
          ],
          ["pnpm", "install", "--frozen-lockfile", "--prefer-offline"],
        ]);
        expect(calls.at(-1)).toMatchObject({
          command: "pnpm",
          cwd: `${runtime.directory}/source`,
          args: ["--filter", "@nakafa/aksara-cli", "acceptance"],
          sensitiveValues: [runtime.publicationToken],
          env: {
            AKSARA_ACCEPTANCE_ENDPOINT: `${runtime.site}/internal/content/releases`,
            AKSARA_ACCEPTANCE_SOURCE: `${runtime.directory}/source`,
            AKSARA_ACCEPTANCE_REVISION: source.revision,
            AKSARA_ACCEPTANCE_RENDERER: `${runtime.directory}/renderer.json`,
            AKSARA_ACCEPTANCE_PRIVATE_KEY: runtime.signing.privateKeyPath,
            AKSARA_AGENT_SIGNING_KEY_ID: runtime.signing.keyId,
            AKSARA_PUBLICATION_TOKEN: runtime.publicationToken,
            CONVEX_DEPLOY_KEY: undefined,
          },
        });
        expect(calls).toHaveLength(7);
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live(
    "stops before installing or publishing if the exact Git revision cannot be acquired",
    () =>
      Effect.gen(function* () {
        const { runtime } = yield* fixture;
        const failure = acceptanceRuntimeError(
          "test pinned commit unavailable"
        );
        mocks.command.mockImplementation((spec: { args: readonly string[] }) =>
          spec.args[0] === "fetch" ? Effect.fail(failure) : Effect.void
        );
        expect(yield* prepareAcceptanceSource(runtime).pipe(Effect.flip)).toBe(
          failure
        );
        expect(mocks.command).toHaveBeenCalledTimes(3);
        expect(mocks.command).not.toHaveBeenCalledWith(
          expect.objectContaining({ command: "pnpm" })
        );
      }).pipe(Effect.provide(nodeServicesLayer))
  );
});
