import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Path, Record as Rec } from "effect";
import { inspectSharedFiles } from "#scripts/check/shared";

const OSV = "scripts/osv";
const VERIFY = "scripts/provenance/verify.ts";
const OSV_COPY = "#!/usr/bin/env bash\necho audit\n";
const VERIFY_COPY = "export const verify = 1;\n";

/** Writes fixture files below one repository root, creating their folders. */
const writeFiles = Effect.fn("SharedTest.writeFiles")(function* (
  root: string,
  files: Readonly<Record<string, string>>
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* Effect.forEach(
    Rec.toEntries(files),
    ([file, content]) =>
      Effect.andThen(
        fileSystem.makeDirectory(path.dirname(path.join(root, file)), {
          recursive: true,
        }),
        fileSystem.writeFileString(path.join(root, file), content)
      ),
    { discard: true }
  );
});

/** Creates a judged repository and its owner, both empty temporary folders. */
const repositories = Effect.fn("SharedTest.repositories")(function* (
  name: string
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const root = yield* fileSystem.makeTempDirectoryScoped({
    prefix: `shared-${name}-root-`,
  });
  const owner = yield* fileSystem.makeTempDirectoryScoped({
    prefix: `shared-${name}-owner-`,
  });
  return { owner, root };
});

describe("shared file policy", () => {
  it.effect("accepts shared files that equal the owner's copies", () =>
    Effect.gen(function* () {
      const { owner, root } = yield* repositories("equal");
      yield* writeFiles(root, { [OSV]: OSV_COPY, [VERIFY]: VERIFY_COPY });
      yield* writeFiles(owner, { [OSV]: OSV_COPY, [VERIFY]: VERIFY_COPY });

      assert.deepStrictEqual(yield* inspectSharedFiles(root, owner), []);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "reports a shared file whose text differs from the owner's copy",
    () =>
      Effect.gen(function* () {
        const { owner, root } = yield* repositories("divergent");
        yield* writeFiles(root, { [OSV]: "echo changed\n" });
        yield* writeFiles(owner, { [OSV]: OSV_COPY });

        assert.deepStrictEqual(yield* inspectSharedFiles(root, owner), [
          "scripts/osv differs from the copy in the repository that owns this check: change that copy first, then copy it here.",
        ]);
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("compares bytes, so a line ending alone is a finding", () =>
    Effect.gen(function* () {
      const { owner, root } = yield* repositories("bytes");
      yield* writeFiles(root, { [VERIFY]: "export const verify = 1;\r\n" });
      yield* writeFiles(owner, { [VERIFY]: VERIFY_COPY });

      assert.deepStrictEqual(yield* inspectSharedFiles(root, owner), [
        "scripts/provenance/verify.ts differs from the copy in the repository that owns this check: change that copy first, then copy it here.",
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("skips a shared file that the repository does not hold", () =>
    Effect.gen(function* () {
      const { owner, root } = yield* repositories("absent");
      yield* writeFiles(owner, { [OSV]: OSV_COPY, [VERIFY]: VERIFY_COPY });

      assert.deepStrictEqual(yield* inspectSharedFiles(root, owner), []);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("compares nothing when the repository is the owner", () =>
    Effect.gen(function* () {
      const { root } = yield* repositories("self");
      yield* writeFiles(root, { [OSV]: OSV_COPY });

      assert.deepStrictEqual(yield* inspectSharedFiles(root, root), []);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("fails with a typed error when the owner's copy is missing", () =>
    Effect.gen(function* () {
      const { owner, root } = yield* repositories("owner-missing");
      yield* writeFiles(root, { [OSV]: OSV_COPY });

      const failure = yield* inspectSharedFiles(root, owner).pipe(Effect.flip);
      assert.deepStrictEqual(
        [failure._tag, failure.message],
        [
          "SharedFileError",
          "scripts/osv of the repository that owns this check is missing or unreadable, so its copy cannot be compared.",
        ]
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "fails with a typed error when the repository's copy is unreadable",
    () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { owner, root } = yield* repositories("root-unreadable");
        yield* writeFiles(owner, { [OSV]: OSV_COPY });
        yield* fileSystem.makeDirectory(path.join(root, OSV), {
          recursive: true,
        });

        const failure = yield* inspectSharedFiles(root, owner).pipe(
          Effect.flip
        );
        assert.deepStrictEqual(
          [failure._tag, failure.message],
          [
            "SharedFileError",
            "scripts/osv cannot be read in this repository, so it cannot be compared with the owner's copy.",
          ]
        );
      }).pipe(Effect.provide(NodeServices.layer))
  );
});
