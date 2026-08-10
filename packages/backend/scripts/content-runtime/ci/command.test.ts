import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { FileSystem } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import {
  runRuntimeCommand,
  sanitizeRuntimeCommandError,
} from "@repo/backend/scripts/content-runtime/ci/command";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("content runtime command diagnostics", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps a bounded single-line diagnostic and redacts secrets", () => {
    const deployKey = "sensitive-deploy-key";
    const result = sanitizeRuntimeCommandError(
      `\u001B[31mPermission denied\u001B[0m\n${deployKey}\n${"x".repeat(600)}`,
      [deployKey]
    );

    expect(result).toContain("Permission denied [redacted]");
    expect(result).not.toContain(deployKey);
    expect(result).not.toContain("\n");
    expect(result.length).toBe(500);
  });

  it("preserves the Convex role action required by the CLI", () => {
    expect(
      sanitizeRuntimeCommandError(
        "You do not have permission (deployment:data:view).",
        []
      )
    ).toBe("You do not have permission (deployment:data:view).");
  });

  it("turns failed child stderr into a redacted typed error", async () => {
    const sensitiveValue = "sensitive-deploy-key";
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const root = yield* fileSystem.makeTempDirectoryScoped({
            directory: tmpdir(),
            prefix: "content-runtime-command-test-",
          });
          const stderrPath = `${root}/stderr.log`;
          const stdoutPath = `${root}/stdout.log`;
          const failure = yield* runRuntimeCommand({
            args: [
              "-e",
              `process.stderr.write(${JSON.stringify(`Permission denied for ${sensitiveValue}\n`)}); process.exit(7);`,
            ],
            command: process.execPath,
            operation: "Production probe",
            reportStderr: true,
            sensitiveValues: [sensitiveValue],
            stderrPath,
            stdoutPath,
          }).pipe(Effect.flip);

          return {
            failure,
            stderr: yield* fileSystem.readFileString(stderrPath),
            stdout: yield* fileSystem.readFileString(stdoutPath),
          };
        })
      ).pipe(Effect.provide(NodeContext.layer))
    );

    expect(result.failure).toMatchObject({
      _tag: "ContentRuntimeCiError",
      message: "Production probe failed: Permission denied for [redacted]",
    });
    expect(result.failure.message).not.toContain(sensitiveValue);
    expect(result.stderr).toContain(sensitiveValue);
    expect(result.stdout).toBe("");
  });

  it("scrubs inherited secrets before spawning a child process", async () => {
    const sensitiveValue = "inherited-sensitive-value";
    vi.stubEnv("AGENT_DOCS_CONTENT_CACHE_KEY", sensitiveValue);
    vi.stubEnv("CONVEX_DEPLOY_KEY", sensitiveValue);
    vi.stubEnv("CONVEX_DEPLOYMENT_TOKEN", sensitiveValue);

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const root = yield* fileSystem.makeTempDirectoryScoped({
            directory: tmpdir(),
            prefix: "content-runtime-command-env-test-",
          });
          const stderrPath = `${root}/stderr.log`;
          const stdoutPath = `${root}/stdout.log`;

          yield* runRuntimeCommand({
            args: [
              "-e",
              'process.stdout.write([process.env.AGENT_DOCS_CONTENT_CACHE_KEY, process.env.CONVEX_DEPLOY_KEY, process.env.CONVEX_DEPLOYMENT_TOKEN, Boolean(process.env.PATH)].join("|"));',
            ],
            command: process.execPath,
            operation: "Secret scrub probe",
            stderrPath,
            stdoutPath,
          });

          return {
            stderr: yield* fileSystem.readFileString(stderrPath),
            stdout: yield* fileSystem.readFileString(stdoutPath),
          };
        })
      ).pipe(Effect.provide(NodeContext.layer))
    );

    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("|||true");
    expect(result.stdout).not.toContain(sensitiveValue);
  });

  it("captures output from fast child processes", async () => {
    const stdoutValue = 'stdout $HOME ; "literal"';
    const stderrValue = 'stderr $HOME ; "literal"';
    const results = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const root = yield* fileSystem.makeTempDirectoryScoped({
            directory: tmpdir(),
            prefix: "content-runtime-fast-command-test-",
          });

          return yield* Effect.forEach(Array.from({ length: 20 }), (index) =>
            Effect.gen(function* () {
              const stderrPath = `${root}/stderr ${index}.log`;
              const stdoutPath = `${root}/stdout ${index}.log`;

              yield* runRuntimeCommand({
                args: [
                  "-c",
                  'printf "%s" "$1"; printf "%s" "$2" >&2',
                  "fast-child",
                  stdoutValue,
                  stderrValue,
                ],
                command: "sh",
                operation: "Fast child probe",
                stderrPath,
                stdoutPath,
              });

              return {
                stderr: yield* fileSystem.readFileString(stderrPath),
                stdout: yield* fileSystem.readFileString(stdoutPath),
              };
            })
          );
        })
      ).pipe(Effect.provide(NodeContext.layer))
    );

    expect(results).toEqual(
      Array.from({ length: 20 }, () => ({
        stderr: stderrValue,
        stdout: stdoutValue,
      }))
    );
  });

  it("keeps entrypoint failures off stdout", async () => {
    const tsxCli = fileURLToPath(import.meta.resolve("tsx/cli"));
    const entrypoint = fileURLToPath(new URL("./main.ts", import.meta.url));
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const root = yield* fileSystem.makeTempDirectoryScoped({
            directory: tmpdir(),
            prefix: "content-runtime-entrypoint-test-",
          });
          const stderrPath = `${root}/stderr.log`;
          const stdoutPath = `${root}/stdout.log`;
          const failure = yield* runRuntimeCommand({
            args: [tsxCli, "--conditions=import", entrypoint, "unsupported"],
            command: process.execPath,
            operation: "Entrypoint smoke",
            reportStderr: true,
            stderrPath,
            stdoutPath,
          }).pipe(Effect.flip);

          return {
            failure,
            stderr: yield* fileSystem.readFileString(stderrPath),
            stdout: yield* fileSystem.readFileString(stdoutPath),
          };
        })
      ).pipe(Effect.provide(NodeContext.layer))
    );

    expect(result.failure.message).toContain(
      "Usage: runtime:ci <fingerprint|generations|verify-generations|export|import>"
    );
    expect(result.stderr).toBe(
      "ERROR: Usage: runtime:ci <fingerprint|generations|verify-generations|export|import>\n"
    );
    expect(result.stdout).toBe("");
  }, 15_000);
});
