import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Path, Record as Rec } from "effect";
import { PACKAGE_MANAGER } from "#scripts/dependencies/policy";
import {
  inspectDependencyPolicy,
  readFirstPartyManifests,
} from "#scripts/dependencies/source";

const WORKSPACE_MANIFEST =
  '{ "workspaces": { "packages": ["apps/*", "packages/*"] } }';

/** Writes fixture files below one repository root. */
const writeFixtures = Effect.fn("DependencySourceTest.writeFixtures")(
  function* (root: string, files: Record<string, string>) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    for (const [file, content] of Rec.toEntries(files)) {
      const filePath = path.join(root, file);
      yield* fileSystem.makeDirectory(path.dirname(filePath), {
        recursive: true,
      });
      yield* fileSystem.writeFileString(filePath, content);
    }
  }
);

/** Creates one isolated repository fixture. */
const makeRepository = Effect.fn("DependencySourceTest.makeRepository")(
  function* (files: Record<string, string>) {
    const fileSystem = yield* FileSystem.FileSystem;
    const root = yield* fileSystem.makeTempDirectoryScoped({
      prefix: "dependency-source-",
    });
    yield* writeFixtures(root, files);
    return root;
  }
);

describe("dependency policy sources", () => {
  it.effect("reads every first-party manifest by relative path", () =>
    Effect.gen(function* () {
      const root = yield* makeRepository({
        "apps/README.md": "Workspace notes.\n",
        "apps/web/package.json": '{ "dependencies": { "next": "16.3.6" } }',
        "package.json": `{ "packageManager": "${PACKAGE_MANAGER}" }`,
        "packages/core/package.json": '{ "scripts": { "test": "vitest" } }',
      });

      assert.deepStrictEqual(yield* readFirstPartyManifests(root), [
        { manifest: { packageManager: PACKAGE_MANAGER }, path: "package.json" },
        {
          manifest: { dependencies: { next: "16.3.6" } },
          path: "apps/web/package.json",
        },
        {
          manifest: { scripts: { test: "vitest" } },
          path: "packages/core/package.json",
        },
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("validates the manifests it reads", () =>
    Effect.gen(function* () {
      const root = yield* makeRepository({
        "apps/web/package.json": "{}",
        "bun.lock":
          '{ "packages": { "hono": ["hono@4.13.13", "", {}, "sha512-b"] } }',
        "package.json": `{ "packageManager": "pnpm@11.26.0", "workspaces": { "packages": ["apps/*", "packages/*"] } }`,
        "packages/core/package.json": "{}",
      });

      const problems = yield* inspectDependencyPolicy(root);
      assert.include(problems, `packageManager must be ${PACKAGE_MANAGER}.`);
      assert.include(
        problems,
        "bun.lock resolves the retired package hono; the Confect router with Effect HttpApi (ADR 0029) replaces it."
      );
      assert.include(
        problems,
        "mermaid has 0 declarations; expected at least 1."
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("reports unreadable and invalid policy files", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const layout = {
        "apps/web/package.json": "{}",
        "packages/core/package.json": "{}",
      };
      const cases = [
        { files: {}, message: "Unable to read {root}/package.json." },
        {
          files: { "package.json": "{" },
          message: "{root}/package.json does not contain valid JSON.",
        },
        {
          files: { "package.json": '{ "dependencies": { "effect": 1 } }' },
          message: "{root}/package.json has an invalid package manifest.",
        },
        {
          files: {
            "package.json": '{ "workspaces": { "catalog": ["effect"] } }',
          },
          message: "{root}/package.json has an invalid package manifest.",
        },
        {
          files: { "package.json": '{ "overrides": { "effect": 1 } }' },
          message: "{root}/package.json has an invalid package manifest.",
        },
        {
          files: { "package.json": WORKSPACE_MANIFEST },
          message: "Unable to read {root}/apps.",
        },
        {
          files: { ...layout, "package.json": WORKSPACE_MANIFEST },
          message: "Unable to read {root}/bun.lock.",
        },
      ];

      for (const { files, message } of cases) {
        const root = yield* makeRepository(files);
        const failure = yield* inspectDependencyPolicy(root).pipe(Effect.flip);
        assert.strictEqual(failure._tag, "DependencyPolicyReadError");
        assert.strictEqual(failure.message, message.replace("{root}", root));
      }

      const root = yield* makeRepository({
        ...layout,
        "package.json": WORKSPACE_MANIFEST,
      });
      const brokenLink = path.join(root, "apps/broken");
      yield* fileSystem.symlink(path.join(root, "absent"), brokenLink);
      const failure = yield* inspectDependencyPolicy(root).pipe(Effect.flip);
      assert.strictEqual(failure._tag, "DependencyPolicyReadError");
      assert.strictEqual(failure.message, `Unable to inspect ${brokenLink}.`);
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
