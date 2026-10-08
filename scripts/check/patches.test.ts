import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Path, Ref, Stdio } from "effect";
import { capture, makeCapture } from "#scripts/capture";
import { checkPatchPolicy } from "#scripts/check/patches";

/** Writes one fixture file below the repository root. */
const writeFixture = Effect.fn("PatchPolicyTest.writeFixture")(function* (
  root: string,
  file: string,
  content: string
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const filePath = path.join(root, file);
  yield* fileSystem.makeDirectory(path.dirname(filePath), { recursive: true });
  yield* fileSystem.writeFileString(filePath, content);
});

/** Runs the patch policy against a fixture with captured standard streams. */
const checkFixture = Effect.fn("PatchPolicyTest.checkFixture")(function* (
  root: string
) {
  const stdout = yield* makeCapture;
  const stderr = yield* makeCapture;
  const status = yield* checkPatchPolicy(root).pipe(
    Effect.provide(
      Stdio.layerTest({
        stderr: capture(stderr),
        stdout: capture(stdout),
      })
    )
  );
  return {
    status,
    stderr: yield* Ref.get(stderr),
    stdout: yield* Ref.get(stdout),
  };
});

describe("dependency patch policy", () => {
  it.effect("accepts patches that only generated or vendored trees own", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const root = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "patch-policy-clean-",
      });
      yield* writeFixture(
        root,
        "pnpm-workspace.yaml",
        "packages:\n  - apps/*\n"
      );
      yield* writeFixture(root, "apps/web/notes.md", "patch notes\n");
      for (const directory of [
        ".cache/acceptance",
        ".git",
        ".venv",
        "node_modules/react",
        "repos/effect",
      ]) {
        yield* writeFixture(root, `${directory}/fix.patch`, "diff\n");
      }

      assert.deepStrictEqual(yield* checkFixture(root), {
        status: 0,
        stderr: [],
        stdout: ["No application dependency patches are registered.\n"],
      });
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("rejects application patches and registered pnpm patches", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const root = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "patch-policy-dirty-",
      });
      yield* writeFixture(
        root,
        "pnpm-workspace.yaml",
        "patchedDependencies:\n  react: patches/react.patch\n"
      );
      yield* writeFixture(root, "patches/react.patch", "diff\n");
      yield* writeFixture(root, "apps/web/fix.patch", "diff\n");

      assert.deepStrictEqual(yield* checkFixture(root), {
        status: 1,
        stderr: [
          "Application dependency patches require explicit review: apps/web/fix.patch, patches/react.patch.\n" +
            "pnpm-workspace.yaml must not register dependency patches.\n",
        ],
        stdout: [],
      });
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
