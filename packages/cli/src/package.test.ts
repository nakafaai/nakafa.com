import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";
import {
  isAllowedPackedFile,
  REQUIRED_PACKED_FILES,
  readPackageVersion,
} from "./package.js";

const executeFile = promisify(execFile);
const packageRoot = path.resolve(import.meta.dirname, "..");

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
    const directory = await mkdtemp(
      path.join(tmpdir(), "nakafa-cli-metadata-")
    );
    const validPath = path.join(directory, "valid.json");
    const invalidPath = path.join(directory, "invalid.json");
    try {
      await writeFile(validPath, '{"version":"9.8.7"}', "utf8");
      await writeFile(invalidPath, '{"version":7}', "utf8");

      await expect(
        Effect.runPromise(readPackageVersion(new URL(`file://${validPath}`)))
      ).resolves.toBe("9.8.7");
      const invalid = await Effect.runPromise(
        readPackageVersion(new URL(`file://${invalidPath}`)).pipe(Effect.result)
      );
      const missing = await Effect.runPromise(
        readPackageVersion(
          new URL(`file://${path.join(directory, "missing.json")}`)
        ).pipe(Effect.result)
      );

      expect(Result.isFailure(invalid) && invalid.failure.message).toContain(
        "metadata is invalid"
      );
      expect(Result.isFailure(missing) && missing.failure.message).toContain(
        "Unable to read"
      );
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("packs only the allowlist and installs a working executable", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "nakafa-cli-pack-"));
    try {
      const { stdout } = await executeFile(
        "npm",
        ["pack", "--json", "--pack-destination", directory],
        { cwd: packageRoot }
      );
      const [pack] = JSON.parse(stdout);
      const files = pack.files.map(({ path: file }: { path: string }) => file);
      const tarballPath = path.join(directory, pack.filename);

      expect(REQUIRED_PACKED_FILES.every((file) => files.includes(file))).toBe(
        true
      );
      expect(files.every(isAllowedPackedFile)).toBe(true);
      await writeFile(
        path.join(directory, "pack-files.json"),
        JSON.stringify(files),
        "utf8"
      );
      await writeFile(
        path.join(directory, "package.json"),
        '{"name":"nakafa-cli-smoke","private":true}',
        "utf8"
      );
      await executeFile(
        "npm",
        [
          "install",
          "--ignore-scripts",
          "--no-audit",
          "--no-fund",
          "--package-lock=false",
          tarballPath,
        ],
        { cwd: directory }
      );
      const binary = path.join(directory, "node_modules", ".bin", "nakafa");
      const help = await executeFile(binary, ["--help"], {
        cwd: directory,
      });
      const version = await executeFile(binary, ["--version"], {
        cwd: directory,
      });

      expect(help.stdout).toContain("Nakafa CLI");
      expect(version.stdout).toBe("0.1.0\n");
      expect(
        await readFile(path.join(directory, "pack-files.json"), "utf8")
      ).toContain("dist/main.js");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  }, 60_000);
});
