import { tmpdir } from "node:os";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import { sanitizeAcceptanceCommandError } from "@repo/backend/scripts/content/acceptance/error";
import { Effect, FileSystem } from "effect";

const REDACTED_PERMISSION_FAILURE = /Permission denied \[redacted\]$/u;

describe("acceptance command diagnostics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("preserves the final failure after download progress and redacts secrets", () => {
    const deployKey = "sensitive-deploy-key";
    const result = sanitizeAcceptanceCommandError(
      `${"Downloading backend binary\n".repeat(100)}\u001B[31mPermission denied\u001B[0m\n${deployKey}`,
      ["", deployKey]
    );

    expect(result).toMatch(REDACTED_PERMISSION_FAILURE);
    expect(result).not.toContain(deployKey);
    expect(result).not.toContain("\n");
    expect(result.length).toBe(2000);
  });

  it.live("turns failed child stderr into a redacted typed error", () =>
    Effect.gen(function* () {
      const sensitiveValue = "sensitive-deploy-key";
      const result = yield* Effect.scoped(
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const root = yield* fileSystem.makeTempDirectoryScoped({
            directory: tmpdir(),
            prefix: "content-acceptance-command-test-",
          });
          const stderrPath = `${root}/stderr.log`;
          const stdoutPath = `${root}/stdout.log`;
          const failure = yield* runAcceptanceCommand({
            args: [
              "-e",
              `process.stderr.write(${JSON.stringify(`Permission denied for ${sensitiveValue}\n`)}); process.exit(7);`,
            ],
            command: process.execPath,
            operation: "Acceptance probe",
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
      ).pipe(Effect.provide(nodeServicesLayer));

      expect(result.failure).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "Acceptance probe failed: Permission denied for [redacted]",
      });
      expect(result.failure.message).not.toContain(sensitiveValue);
      expect(result.stderr).toContain(sensitiveValue);
      expect(result.stdout).toBe("");
    })
  );

  it.live("scrubs inherited secrets before spawning a child process", () =>
    Effect.gen(function* () {
      const sensitiveValue = "inherited-sensitive-value";
      vi.stubEnv("AKSARA_SIGNING_PRIVATE_KEY", sensitiveValue);
      vi.stubEnv("AKSARA_ACCEPTANCE_PRIVATE_KEY", sensitiveValue);
      vi.stubEnv("CONVEX_DEPLOY_KEY", sensitiveValue);
      vi.stubEnv("CONVEX_DEPLOYMENT_TOKEN", sensitiveValue);

      const result = yield* Effect.scoped(
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const root = yield* fileSystem.makeTempDirectoryScoped({
            directory: tmpdir(),
            prefix: "content-acceptance-command-env-test-",
          });
          const stderrPath = `${root}/stderr.log`;
          const stdoutPath = `${root}/stdout.log`;

          yield* runAcceptanceCommand({
            args: [
              "-e",
              'process.stdout.write([process.env.AKSARA_SIGNING_PRIVATE_KEY, process.env.AKSARA_ACCEPTANCE_PRIVATE_KEY, process.env.CONVEX_DEPLOY_KEY, process.env.CONVEX_DEPLOYMENT_TOKEN, Boolean(process.env.PATH)].join("|"));',
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
      ).pipe(Effect.provide(nodeServicesLayer));

      expect(result.stderr).toBe("");
      expect(result.stdout).toBe("||||true");
      expect(result.stdout).not.toContain(sensitiveValue);
    })
  );

  it.live("captures output from fast child processes", () =>
    Effect.gen(function* () {
      const stdoutValue = 'stdout $HOME ; "literal"';
      const stderrValue = 'stderr $HOME ; "literal"';
      const results = yield* Effect.scoped(
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const root = yield* fileSystem.makeTempDirectoryScoped({
            directory: tmpdir(),
            prefix: "content-acceptance-fast-command-test-",
          });

          return yield* Effect.forEach(Array.from({ length: 20 }), (index) =>
            Effect.gen(function* () {
              const stderrPath = `${root}/stderr ${index}.log`;
              const stdoutPath = `${root}/stdout ${index}.log`;

              yield* runAcceptanceCommand({
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
      ).pipe(Effect.provide(nodeServicesLayer));

      expect(results).toEqual(
        Array.from({ length: 20 }, () => ({
          stderr: stderrValue,
          stdout: stdoutValue,
        }))
      );
    })
  );

  it.live("forwards stdin into one protected output stream", () =>
    Effect.gen(function* () {
      const result = yield* Effect.scoped(
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const root = yield* fileSystem.makeTempDirectoryScoped({
            directory: tmpdir(),
            prefix: "content-acceptance-stdin-test-",
          });
          const outputPath = `${root}/combined.log`;

          yield* runAcceptanceCommand({
            args: [
              "-e",
              'let input = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk) => { input += chunk; }); process.stdin.on("end", () => { process.stdout.write(input); process.stderr.write("stderr"); });',
            ],
            command: process.execPath,
            operation: "Stdin probe",
            stderrPath: outputPath,
            stdin: "private input\n",
            stdoutPath: outputPath,
          });

          return yield* fileSystem.readFileString(outputPath);
        })
      ).pipe(Effect.provide(nodeServicesLayer));

      expect(result).toBe("private input\nstderr");
    })
  );

  it.live(
    "returns generic failures when diagnostics are disabled or empty",
    () =>
      Effect.gen(function* () {
        const failures = yield* Effect.scoped(
          Effect.gen(function* () {
            const fileSystem = yield* FileSystem.FileSystem;
            const root = yield* fileSystem.makeTempDirectoryScoped({
              directory: tmpdir(),
              prefix: "content-acceptance-generic-error-test-",
            });

            return yield* Effect.forEach(
              [
                { reportStderr: false, stderr: "private detail" },
                { reportStderr: true, stderr: "\u001B[31m\u001B[0m\n" },
              ],
              ({ reportStderr, stderr }, index) =>
                runAcceptanceCommand({
                  args: [
                    "-e",
                    `process.stderr.write(${JSON.stringify(stderr)}); process.exit(7);`,
                  ],
                  command: process.execPath,
                  operation: "Generic failure probe",
                  reportStderr,
                  stderrPath: `${root}/stderr-${index}.log`,
                  stdoutPath: `${root}/stdout-${index}.log`,
                }).pipe(Effect.flip)
            );
          })
        ).pipe(Effect.provide(nodeServicesLayer));

        expect(failures).toHaveLength(2);
        for (const failure of failures) {
          expect(failure).toMatchObject({
            _tag: "AcceptanceRuntimeError",
            message: "Generic failure probe failed.",
          });
        }
      })
  );
});
