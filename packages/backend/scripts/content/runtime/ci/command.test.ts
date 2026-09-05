import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT } from "@repo/backend/content/deployment";
import {
  runConvexData,
  runConvexImport,
  runRuntimeCommand,
  setConvexAdminAuth,
} from "@repo/backend/scripts/content/runtime/ci/command";
import { sanitizeRuntimeCommandError } from "@repo/backend/scripts/content/runtime/ci/error";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { Effect, FileSystem } from "effect";

describe("content runtime command diagnostics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.effect("authenticates and clears Convex system-query requests", () =>
    Effect.gen(function* () {
      const authorizations: Array<null | string> = [];
      const client = new ConvexHttpClient(
        "https://happy-animal-123.convex.cloud",
        {
          fetch: (_input, init) => {
            authorizations.push(
              new Headers(init?.headers).get("Authorization")
            );
            return Promise.resolve(
              new Response(JSON.stringify({ status: "success", value: null }), {
                headers: { "Content-Type": "application/json" },
                status: 200,
              })
            );
          },
          logger: false,
        }
      );
      const query = makeFunctionReference<"query", Record<string, never>, null>(
        "test:query"
      );

      yield* setConvexAdminAuth(client, "test-admin-key");
      yield* Effect.promise(() => client.query(query, {}));
      client.clearAuth();
      yield* Effect.promise(() => client.query(query, {}));

      expect(authorizations).toEqual(["Convex test-admin-key", null]);
    })
  );

  it.effect("fails closed when Convex removes runtime admin auth", () =>
    Effect.gen(function* () {
      const failure = yield* setConvexAdminAuth({}, "test-admin-key").pipe(
        Effect.flip
      );

      expect(failure).toMatchObject({
        _tag: "ContentRuntimeCiError",
        message: "Convex HTTP client does not expose admin authentication.",
      });
    })
  );

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

  it.live("turns failed child stderr into a redacted typed error", () =>
    Effect.gen(function* () {
      const sensitiveValue = "sensitive-deploy-key";
      const result = yield* Effect.scoped(
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
      ).pipe(Effect.provide(NodeServices.layer));

      expect(result.failure).toMatchObject({
        _tag: "ContentRuntimeCiError",
        message: "Production probe failed: Permission denied for [redacted]",
      });
      expect(result.failure.message).not.toContain(sensitiveValue);
      expect(result.stderr).toContain(sensitiveValue);
      expect(result.stdout).toBe("");
    })
  );

  it.live("scrubs inherited secrets before spawning a child process", () =>
    Effect.gen(function* () {
      const sensitiveValue = "inherited-sensitive-value";
      vi.stubEnv("CONTENT_RUNTIME_CACHE_KEY", sensitiveValue);
      vi.stubEnv("CONVEX_DEPLOY_KEY", sensitiveValue);
      vi.stubEnv("CONVEX_DEPLOYMENT_TOKEN", sensitiveValue);

      const result = yield* Effect.scoped(
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
              'process.stdout.write([process.env.CONTENT_RUNTIME_CACHE_KEY, process.env.CONVEX_DEPLOY_KEY, process.env.CONVEX_DEPLOYMENT_TOKEN, Boolean(process.env.PATH)].join("|"));',
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
      ).pipe(Effect.provide(NodeServices.layer));

      expect(result.stderr).toBe("");
      expect(result.stdout).toBe("|||true");
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
      ).pipe(Effect.provide(NodeServices.layer));

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
            prefix: "content-runtime-stdin-test-",
          });
          const outputPath = `${root}/combined.log`;

          yield* runRuntimeCommand({
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
      ).pipe(Effect.provide(NodeServices.layer));

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
              prefix: "content-runtime-generic-error-test-",
            });

            return yield* Effect.forEach(
              [
                { reportStderr: false, stderr: "private detail" },
                { reportStderr: true, stderr: "\u001B[31m\u001B[0m\n" },
              ],
              ({ reportStderr, stderr }, index) =>
                runRuntimeCommand({
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
        ).pipe(Effect.provide(NodeServices.layer));

        expect(failures).toHaveLength(2);
        for (const failure of failures) {
          expect(failure).toMatchObject({
            _tag: "ContentRuntimeCiError",
            message: "Generic failure probe failed.",
          });
        }
      })
  );

  it.live(
    "reads a bounded authenticated production table into a private file",
    () =>
      Effect.gen(function* () {
        const deployKey = "prod:deployment:data:view|private-key";
        const requests: Array<{ input: string; init?: RequestInit }> = [];
        const clearAuth = vi.spyOn(ConvexHttpClient.prototype, "clearAuth");
        vi.stubGlobal(
          "fetch",
          vi.fn<typeof fetch>((input, init) => {
            requests.push({ input: String(input), init });
            return Promise.resolve(
              new Response(
                JSON.stringify({
                  status: "success",
                  value: {
                    continueCursor: "done",
                    isDone: true,
                    page: [{ slug: "safe" }],
                  },
                }),
                {
                  headers: { "Content-Type": "application/json" },
                  status: 200,
                }
              )
            );
          })
        );

        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const fileSystem = yield* FileSystem.FileSystem;
            const root = yield* fileSystem.makeTempDirectoryScoped({
              directory: tmpdir(),
              prefix: "content-runtime-data-test-",
            });
            const logPath = `${root}/runtime.log`;
            const outputPath = `${root}/contentKeys.json`;

            yield* runConvexData({
              deployKey,
              limit: 2,
              logPath,
              outputPath,
              table: "contentKeys",
            });

            return {
              log: yield* fileSystem.readFileString(logPath),
              output: yield* fileSystem.readFileString(outputPath),
            };
          })
        ).pipe(Effect.provide(NodeServices.layer));

        expect(result).toEqual({ log: "", output: '[{"slug":"safe"}]' });
        expect(requests).toHaveLength(1);
        expect(requests[0]?.input).toBe(
          `https://${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}.convex.cloud/api/query`
        );
        expect(
          new Headers(requests[0]?.init?.headers).get("Authorization")
        ).toBe(`Convex ${deployKey}`);
        expect(String(requests[0]?.init?.body)).toContain(
          '"path":"_system/cli/tableData"'
        );
        expect(String(requests[0]?.init?.body)).toContain(
          '"paginationOpts":{"cursor":null,"numItems":3}'
        );
        expect(clearAuth).toHaveBeenCalledTimes(2);
      })
  );

  it.live("invokes local imports with the exact replacement contract", () =>
    Effect.gen(function* () {
      const result = yield* Effect.scoped(
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const root = yield* fileSystem.makeTempDirectoryScoped({
            directory: tmpdir(),
            prefix: "content-runtime-import-command-test-",
          });
          const binPath = `${root}/bin`;
          const pnpmPath = `${binPath}/pnpm`;
          const inputPath = `${root}/content keys.jsonl`;
          const logPath = `${root}/runtime.log`;
          yield* fileSystem.makeDirectory(binPath);
          yield* fileSystem.writeFileString(
            pnpmPath,
            '#!/bin/sh\nprintf "%s\\n" "$@"\n',
            { mode: 0o700 }
          );
          yield* fileSystem.chmod(pnpmPath, 0o700);
          vi.stubEnv("PATH", `${binPath}:${process.env.PATH ?? ""}`);

          yield* runConvexImport({
            inputPath,
            logPath,
            table: "contentKeys",
          });

          return {
            inputPath,
            log: yield* fileSystem.readFileString(logPath),
          };
        })
      ).pipe(Effect.provide(NodeServices.layer));

      expect(result.log).toBe(
        [
          "exec",
          "convex",
          "import",
          "--format",
          "jsonLines",
          "--table",
          "contentKeys",
          "--replace",
          "--yes",
          result.inputPath,
          "",
        ].join("\n")
      );
    })
  );

  it.live(
    "keeps entrypoint failures off stdout",
    () =>
      Effect.gen(function* () {
        const tsxCli = fileURLToPath(import.meta.resolve("tsx/cli"));
        const entrypoint = fileURLToPath(new URL("./main.ts", import.meta.url));
        const result = yield* Effect.scoped(
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
        ).pipe(Effect.provide(NodeServices.layer));

        expect(result.failure.message).toContain(
          "Usage: runtime:ci <build|prepare|start|clean|fingerprint|generations|verify-generations|export|import>"
        );
        expect(result.stderr).toBe(
          "ERROR: Usage: runtime:ci <build|prepare|start|clean|fingerprint|generations|verify-generations|export|import>\n"
        );
        expect(result.stdout).toBe("");
      }),
    15_000
  );
});
