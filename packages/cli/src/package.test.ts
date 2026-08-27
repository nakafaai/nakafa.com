import { fileURLToPath, pathToFileURL } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect, FileSystem, Path, Result, Schema, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";
import {
  isAllowedPackedFile,
  REQUIRED_PACKED_FILES,
  readPackageVersion,
} from "./package.js";

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

const runCommand = Effect.fn("NakafaCli.test.runCommand")(function* (
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

  it.effect("packs only the allowlist and installs a working executable", () =>
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
      const installedRoot = path.join(directory, "node_modules", "nakafa-cli");
      const bundle = yield* fileSystem.readFileString(
        path.join(installedRoot, "dist", "main.js")
      );
      const manifest = yield* fileSystem.readFileString(
        path.join(installedRoot, "package.json")
      );
      const help = yield* runCommand(binary, ["--help"], directory);
      const version = yield* runCommand(binary, ["--version"], directory);

      expect(REQUIRED_PACKED_FILES.every((file) => files.includes(file))).toBe(
        true
      );
      expect(files.every(isAllowedPackedFile)).toBe(true);
      expect(help).toContain("Nakafa CLI");
      expect(version).toBe(`${packageVersion}\n`);
      expect(manifest).not.toContain('"dependencies"');
      expect(bundle).not.toContain("@repo/contents");
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
