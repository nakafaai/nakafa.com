import * as NodeHttp from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import { NodeHttpServer, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  Deferred,
  Effect,
  Fiber,
  FileSystem,
  Path,
  Result,
  Schema,
  Stream,
} from "effect";
import { HttpServer, HttpServerResponse } from "effect/unstable/http";
import { ChildProcess } from "effect/unstable/process";
import {
  isAllowedPackedFile,
  REQUIRED_PACKED_FILES,
  readPackageVersion,
} from "#cli/package";

class CliTestCommandError extends Schema.TaggedError<CliTestCommandError>()(
  "CliTestCommandError",
  {
    command: Schema.String,
    exitCode: Schema.Finite.pipe(Schema.check(Schema.isInt())),
    stderr: Schema.String,
  }
) {}

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const PackResultSchema = Schema.fromJsonString(
  Schema.NonEmptyArray(
    Schema.Struct({
      filename: Schema.String,
      files: Schema.Array(Schema.Struct({ path: Schema.String })),
    })
  )
);

const readCommand = Effect.fn("NakafaCli.test.readCommand")(function* (
  command: string,
  args: readonly string[],
  cwd: string
) {
  const [stdout, stderr, exitCode] = yield* Effect.scoped(
    Effect.gen(function* () {
      const childProcess = yield* ChildProcess.make(command, args, { cwd });
      return yield* Effect.all(
        [
          Stream.mkString(Stream.decodeText(childProcess.stdout)),
          Stream.mkString(Stream.decodeText(childProcess.stderr)),
          childProcess.exitCode,
        ],
        { concurrency: "unbounded" }
      );
    })
  );
  return { exitCode, stderr, stdout };
});

const runCommand = Effect.fn("NakafaCli.test.runCommand")(function* (
  command: string,
  args: readonly string[],
  cwd: string
) {
  const { exitCode, stderr, stdout } = yield* readCommand(command, args, cwd);
  if (exitCode !== 0) {
    return yield* new CliTestCommandError({
      command: [command, ...args].join(" "),
      exitCode,
      stderr: stderr.trim(),
    });
  }
  return stdout;
});

describe("Nakafa CLI package", () => {
  it("allows only runtime distribution files", () => {
    for (const file of REQUIRED_PACKED_FILES) {
      expect(isAllowedPackedFile(file)).toBe(true);
    }
    expect(isAllowedPackedFile("dist/client.js")).toBe(true);
    expect(isAllowedPackedFile("src/main.ts")).toBe(false);
    expect(isAllowedPackedFile("vitest.config.mts")).toBe(false);
  });

  it.effect("reads valid package metadata and reports typed failures", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "nakafa-cli-metadata-",
      });
      const validPath = path.join(directory, "valid.json");
      const invalidPath = path.join(directory, "invalid.json");
      yield* fileSystem.writeFileString(validPath, '{"version":"9.8.7"}');
      yield* fileSystem.writeFileString(invalidPath, '{"version":7}');

      const valid = yield* readPackageVersion(pathToFileURL(validPath));
      const invalid = yield* readPackageVersion(
        pathToFileURL(invalidPath)
      ).pipe(Effect.result);
      const missing = yield* readPackageVersion(
        pathToFileURL(path.join(directory, "missing.json"))
      ).pipe(Effect.result);

      expect(valid).toBe("9.8.7");
      expect(Result.isFailure(invalid) && invalid.failure.message).toContain(
        "metadata is invalid"
      );
      expect(Result.isFailure(missing) && missing.failure.message).toContain(
        "Unable to read"
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "packs only the allowlist and installs a working executable",
    () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "nakafa-cli-pack-",
        });
        const packageVersion = yield* readPackageVersion(
          pathToFileURL(path.join(packageRoot, "package.json"))
        );
        const packOutput = yield* runCommand(
          "npm",
          ["pack", "--json", "--pack-destination", directory],
          packageRoot
        );
        const [pack] = yield* Schema.decodeEffect(PackResultSchema)(packOutput);
        const files = pack.files.map(({ path: file }) => file);
        const tarballPath = path.join(directory, pack.filename);

        yield* fileSystem.writeFileString(
          path.join(directory, "package.json"),
          '{"name":"nakafa-cli-smoke","private":true}'
        );
        yield* runCommand(
          "npm",
          [
            "install",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
            "--package-lock=false",
            tarballPath,
          ],
          directory
        );

        const binary = path.join(directory, "node_modules", ".bin", "nakafa");
        const installedRoot = path.join(
          directory,
          "node_modules",
          "nakafa-cli"
        );
        const bundle = yield* fileSystem.readFileString(
          path.join(installedRoot, "dist", "main.js")
        );
        const manifest = yield* fileSystem.readFileString(
          path.join(installedRoot, "package.json")
        );
        const help = yield* runCommand(binary, ["--help"], directory);
        const version = yield* runCommand(binary, ["--version"], directory);
        const invalid = yield* readCommand(binary, ["--unknown"], directory);
        const interrupted = yield* Effect.scoped(
          Effect.gen(function* () {
            const completeRequest = yield* Deferred.make<void>();
            const requestStarted = yield* Deferred.make<void>();
            const server = yield* HttpServer.HttpServer;
            yield* server.serve(
              Deferred.succeed(requestStarted, undefined).pipe(
                Effect.andThen(Deferred.await(completeRequest)),
                Effect.as(HttpServerResponse.empty())
              )
            );
            const childProcess = yield* ChildProcess.make(
              binary,
              [
                "taxonomy",
                "--api-base",
                HttpServer.formatAddress(server.address),
              ],
              { cwd: directory }
            );
            const stdout = yield* Stream.mkString(
              Stream.decodeText(childProcess.stdout)
            ).pipe(Effect.forkScoped);
            const stderr = yield* Stream.mkString(
              Stream.decodeText(childProcess.stderr)
            ).pipe(Effect.forkScoped);
            yield* Deferred.await(requestStarted).pipe(
              Effect.timeout("5 seconds")
            );
            yield* childProcess.kill({
              forceKillAfter: "5 seconds",
              killSignal: "SIGINT",
            });
            const exitCode = yield* childProcess.exitCode;
            yield* Deferred.succeed(completeRequest, undefined);
            const capturedStderr = yield* Fiber.join(stderr);
            const capturedStdout = yield* Fiber.join(stdout);
            return {
              exitCode,
              stderr: capturedStderr,
              stdout: capturedStdout,
            };
          }).pipe(
            Effect.provide(
              NodeHttpServer.layer(NodeHttp.createServer, {
                host: "127.0.0.1",
                port: 0,
              })
            )
          )
        );

        expect(
          REQUIRED_PACKED_FILES.every((file) => files.includes(file))
        ).toBe(true);
        expect(files.every(isAllowedPackedFile)).toBe(true);
        expect(help).toContain("Nakafa CLI");
        expect(version).toBe(`${packageVersion}\n`);
        expect(invalid.exitCode).toBe(2);
        expect(
          yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Json))(
            invalid.stderr
          )
        ).toMatchObject({ code: "INVOCATION_ERROR" });
        expect(manifest).not.toContain('"dependencies"');
        expect(bundle).not.toContain("@repo/contents");
        expect(interrupted).toEqual({
          exitCode: 130,
          stderr: "",
          stdout: "",
        });
      }).pipe(Effect.provide(NodeServices.layer)),
    { timeout: 30_000 }
  );
});
