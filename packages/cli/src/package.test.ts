import path from "node:path";
import { pathToFileURL } from "node:url";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Result, Schema, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";
import { describe, expect, it } from "vitest";
import {
  isAllowedPackedFile,
  REQUIRED_PACKED_FILES,
  readPackageVersion,
} from "./package.js";

const packageRoot = path.resolve(import.meta.dirname, "..");
const PackResultSchema = Schema.fromJsonString(
  Schema.NonEmptyArray(
    Schema.Struct({
      filename: Schema.String,
      files: Schema.Array(Schema.Struct({ path: Schema.String })),
    })
  )
);

const withTempDirectory = Effect.fn("nakafaCli.test.withTempDirectory")(
  function* <A, E, R>(
    prefix: string,
    use: (directory: string) => Effect.Effect<A, E, R>
  ) {
    const fileSystem = yield* FileSystem.FileSystem;
    return yield* Effect.acquireUseRelease(
      fileSystem.makeTempDirectory({ prefix }),
      use,
      (directory) =>
        fileSystem
          .remove(directory, { force: true, recursive: true })
          .pipe(Effect.orDie)
    );
  }
);

const runCommand = Effect.fn("nakafaCli.test.runCommand")(function* (
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
  if (exitCode !== 0) {
    return yield* Effect.die(
      new Error(`${command} exited with ${exitCode}: ${stderr.trim()}`)
    );
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

  it("reads valid package metadata and reports read and decode failures", async () => {
    const result = await Effect.runPromise(
      withTempDirectory("nakafa-cli-metadata-", (directory) =>
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const validPath = path.join(directory, "valid.json");
          const invalidPath = path.join(directory, "invalid.json");
          yield* fileSystem.writeFileString(validPath, '{"version":"9.8.7"}');
          yield* fileSystem.writeFileString(invalidPath, '{"version":7}');

          return {
            invalid: yield* readPackageVersion(pathToFileURL(invalidPath)).pipe(
              Effect.result
            ),
            missing: yield* readPackageVersion(
              pathToFileURL(path.join(directory, "missing.json"))
            ).pipe(Effect.result),
            valid: yield* readPackageVersion(pathToFileURL(validPath)),
          };
        })
      ).pipe(Effect.provide(NodeServices.layer))
    );

    expect(result.valid).toBe("9.8.7");
    expect(
      Result.isFailure(result.invalid) && result.invalid.failure.message
    ).toContain("metadata is invalid");
    expect(
      Result.isFailure(result.missing) && result.missing.failure.message
    ).toContain("Unable to read");
  });

  it("packs only the allowlist and installs a working executable", async () => {
    const result = await Effect.runPromise(
      withTempDirectory("nakafa-cli-pack-", (directory) =>
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const packOutput = yield* runCommand(
            "npm",
            ["pack", "--json", "--pack-destination", directory],
            packageRoot
          );
          const [pack] =
            yield* Schema.decodeEffect(PackResultSchema)(packOutput);
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
          return {
            bundle: yield* fileSystem.readFileString(
              path.join(installedRoot, "dist", "main.js")
            ),
            files,
            help: yield* runCommand(binary, ["--help"], directory),
            manifest: yield* fileSystem.readFileString(
              path.join(installedRoot, "package.json")
            ),
            version: yield* runCommand(binary, ["--version"], directory),
          };
        })
      ).pipe(Effect.provide(NodeServices.layer))
    );

    expect(
      REQUIRED_PACKED_FILES.every((file) => result.files.includes(file))
    ).toBe(true);
    expect(result.files.every(isAllowedPackedFile)).toBe(true);
    expect(result.help).toContain("Nakafa CLI");
    expect(result.version).toBe("0.1.0\n");
    expect(result.manifest).not.toContain('"dependencies"');
    expect(result.bundle).not.toContain("@repo/contents");
  }, 60_000);
});
