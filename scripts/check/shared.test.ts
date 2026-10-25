import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Path, Record as Rec, Schema } from "effect";
import { inspectCohortPins, inspectSharedFiles } from "#scripts/check/shared";

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

  it.effect(
    "compares the exact text, so a line ending alone is a finding",
    () =>
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

const ManifestJson = Schema.fromJsonString(
  Schema.Record(Schema.String, Schema.Unknown)
);

/** Writes the root manifest with the catalog that Bun declares under its workspaces. */
function rootManifest(manifest: string, catalog: Record<string, string>) {
  const decoded = Schema.decodeSync(ManifestJson)(manifest);
  return `${Schema.encodeSync(ManifestJson)({ ...decoded, workspaces: { catalog } })}\n`;
}

const PINS =
  '{"devDependencies":{"@effect/tsgo":"0.51.1","effect":"catalog:"}}\n';
const CATALOG = { effect: "4.0.2" };
const CATALOG_OLD = { effect: "4.0.1" };
const NO_CATALOG = {};
const PIN_FINDING =
  "effect is pinned at 4.0.1 here and at 4.0.2 in the repository that owns this check: set this pin to 4.0.2, and move the Effect cohort in the owner first.";

describe("Effect cohort pins", () => {
  it.effect(
    "accepts pins that equal the owner's, through catalog references",
    () =>
      Effect.gen(function* () {
        const { owner, root } = yield* repositories("pins-equal");
        yield* writeFiles(root, {
          "package.json": rootManifest(PINS, CATALOG),
        });
        yield* writeFiles(owner, {
          "package.json": rootManifest(PINS, CATALOG),
        });

        assert.deepStrictEqual(yield* inspectCohortPins(root, owner), []);
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("reports a literal pin that differs from the owner's pin", () =>
    Effect.gen(function* () {
      const { owner, root } = yield* repositories("pins-divergent");
      yield* writeFiles(root, {
        "package.json": rootManifest(
          '{"devDependencies":{"effect":"4.0.1"}}\n',
          NO_CATALOG
        ),
      });
      yield* writeFiles(owner, {
        "package.json": rootManifest(
          '{"devDependencies":{"effect":"catalog:"}}\n',
          CATALOG
        ),
      });

      assert.deepStrictEqual(yield* inspectCohortPins(root, owner), [
        PIN_FINDING,
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("compares a catalog entry that no manifest names", () =>
    Effect.gen(function* () {
      const { owner, root } = yield* repositories("pins-catalog-only");
      yield* writeFiles(root, {
        "package.json": rootManifest('{"dependencies":{}}\n', CATALOG_OLD),
      });
      yield* writeFiles(owner, {
        "package.json": rootManifest(
          '{"dependencies":{"effect":"4.0.2"}}\n',
          NO_CATALOG
        ),
      });

      assert.deepStrictEqual(yield* inspectCohortPins(root, owner), [
        PIN_FINDING,
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "ignores names outside the cohort and names only one repository pins",
    () =>
      Effect.gen(function* () {
        const { owner, root } = yield* repositories("pins-one-side");
        yield* writeFiles(root, {
          "package.json": rootManifest(
            '{"dependencies":{"react":"19.2.8"},"devDependencies":{"@effect/tsgo":"0.51.1"}}\n',
            NO_CATALOG
          ),
        });
        yield* writeFiles(owner, {
          "package.json": rootManifest(
            '{"dependencies":{"react":"19.2.9"}}\n',
            NO_CATALOG
          ),
        });

        assert.deepStrictEqual(yield* inspectCohortPins(root, owner), []);
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("pins nothing through a named catalog reference", () =>
    Effect.gen(function* () {
      const { owner, root } = yield* repositories("pins-named");
      yield* writeFiles(root, {
        "package.json": rootManifest(
          '{"devDependencies":{"effect":"catalog:react"}}\n',
          CATALOG_OLD
        ),
      });
      yield* writeFiles(owner, {
        "package.json": rootManifest(
          '{"devDependencies":{"effect":"4.0.2"}}\n',
          NO_CATALOG
        ),
      });

      assert.deepStrictEqual(yield* inspectCohortPins(root, owner), []);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "compares nothing for the owner itself or a repository without a manifest",
    () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const { owner, root } = yield* repositories("pins-skip");
        const bare = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "shared-pins-bare-",
        });
        yield* writeFiles(root, {
          "package.json": rootManifest(PINS, NO_CATALOG),
        });
        yield* writeFiles(owner, {
          "package.json": rootManifest(PINS, CATALOG),
        });

        assert.deepStrictEqual(yield* inspectCohortPins(root, root), []);
        assert.deepStrictEqual(yield* inspectCohortPins(bare, owner), []);
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "fails with a typed error when the owner's root manifest is missing",
    () =>
      Effect.gen(function* () {
        const { owner, root } = yield* repositories("pins-missing");
        yield* writeFiles(root, {
          "package.json": rootManifest(PINS, CATALOG),
        });

        const failure = yield* inspectCohortPins(root, owner).pipe(Effect.flip);
        assert.deepStrictEqual(
          [failure._tag, failure.message.slice(-"package.json.".length)],
          ["DependencyPolicyReadError", "package.json."]
        );
      }).pipe(Effect.provide(NodeServices.layer))
  );
});
