import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import {
  Array as Arr,
  Effect,
  FileSystem,
  Layer,
  Path,
  PlatformError,
  Record as Rec,
  Ref,
  Stdio,
} from "effect";
import { capture, makeCapture } from "#scripts/capture";
import { RULES } from "#scripts/check/rules";
import { checkTestPolicy } from "#scripts/check/tests";

const CLEAN_TEST =
  'import { it } from "@effect/vitest";\nit("reads", () => {});\n';

/** Writes fixture files below one repository root. */
const writeFixtures = Effect.fn("TestPolicyTest.writeFixtures")(function* (
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

/** Runs the test policy against a fixture with captured standard streams. */
const checkFixture = Effect.fn("TestPolicyTest.checkFixture")(function* (
  root: string
) {
  const stdout = yield* makeCapture;
  const stderr = yield* makeCapture;
  const status = yield* checkTestPolicy(root).pipe(
    Effect.provide(
      Stdio.layerTest({ stderr: capture(stderr), stdout: capture(stdout) })
    )
  );
  return {
    status,
    stderr: yield* Ref.get(stderr),
    stdout: yield* Ref.get(stdout),
  };
});

/** Delegates to the Node file system except for one unreadable file. */
function unreadableFile(unreadablePath: string) {
  return Layer.effect(
    FileSystem.FileSystem,
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const service: FileSystem.FileSystem = {
        ...fileSystem,
        readFileString: (path, encoding) =>
          path === unreadablePath
            ? Effect.fail(
                PlatformError.systemError({
                  _tag: "PermissionDenied",
                  method: "readFileString",
                  module: "FileSystem",
                  pathOrDescriptor: path,
                })
              )
            : fileSystem.readFileString(path, encoding),
      };
      return service;
    })
  ).pipe(Layer.provide(NodeServices.layer));
}

describe("test ownership policy", () => {
  it.effect("accepts colocated tests and skips generated output", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const root = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "test-policy-clean-",
      });
      yield* writeFixtures(root, {
        "apps/web/style.test.ts":
          'import { it } from "@effect/vitest";\nit("keeps size-[4px]", () => {});\n',
        "apps/web/style.ts": 'export const style = "w-[calc(100%-2rem)]";\n',
        "apps/web/tsconfig.json":
          '{"extends":"@repo/typescript-config/base.json"}\n',
        "apps/web/value.test.ts": CLEAN_TEST,
        "apps/web/value.ts": "export const value = 1;\n",
        "packages/core/_generated/api.ts":
          "try {\n  run();\n} catch {\n  stop();\n}\n",
        "packages/core/node_modules/dependency/view.test.tsx": CLEAN_TEST,
        "packages/typescript-config/base.json":
          '{"compilerOptions":{"plugins":[{"name":"@effect/language-service"}]}}\n',
        "packages/core/types.d.ts":
          'export declare const narrowed: typeof value === "object";\n',
        "scripts/tool.test.ts": CLEAN_TEST,
        "scripts/tool.ts": "export const tool = true;\n",
      });

      assert.deepStrictEqual(yield* checkFixture(root), {
        status: 0,
        stderr: [],
        stdout: ["Test ownership checks passed.\n"],
      });
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("reports ownership, layout, runner, and source violations", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const root = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "test-policy-dirty-",
      });
      yield* writeFixtures(root, {
        "apps/web/card.tsx": 'export const card = "size-[4px]";\n',
        "apps/web/orphan.test.ts": CLEAN_TEST,
        "apps/web/view.test.tsx": CLEAN_TEST,
        "apps/web/view.ts": "export const view = true;\n",
        "packages/core/__tests__/value.ts": "export const value = 1;\n",
        "packages/core/runner.test.ts":
          'import { Effect } from "effect";\nEffect.runPromise(program);\n',
        "packages/core/runner.ts": "export const runner = true;\n",
        "scripts/raw.ts":
          "export function read() {\n  try {\n    return 1;\n  } catch {\n    return 0;\n  }\n}\n",
        "apps/web/store.ts":
          "export const store = new Map();\nexport const names = Object.keys(value);\n",
        "apps/web/tsconfig.json":
          '{"compilerOptions":{"plugins":[{"name":"@effect/language-service"}]}}\n',
        "tsconfig.json": '{"compilerOptions":{"plugins":[]}}\n',
      });

      assert.deepStrictEqual(yield* checkFixture(root), {
        status: 1,
        stderr: [
          "Every final test must have a colocated .ts Module with the same name; React and TSX behavior belongs in Browser or E2E acceptance:\n  - apps/web/orphan.test.ts\n",
          "Final code must not contain .test.tsx files:\n  - apps/web/view.test.tsx\n",
          "Tests must not use __test__ or __tests__ folders:\n  - packages/core/__tests__/value.ts\n",
          "packages/core/runner.test.ts: return the Effect to @effect/vitest instead of running it.\n",
          `apps/web/store.ts:1: ${RULES["map-set"].message} (map-set)\napps/web/store.ts:2: ${RULES["object-helper"].message} (object-helper)\nscripts/raw.ts:2: ${RULES["try-catch"].message} (try-catch)\n`,
          "apps/web/tsconfig.json: remove its plugins array and inherit the shared one, because a plugins array replaces the one it extends.\ntsconfig.json: remove its plugins array and inherit the shared one, because a plugins array replaces the one it extends.\n",
          "apps/web/card.tsx:1: use size-1 instead of size-[4px].\n",
        ],
        stdout: [],
      });
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect.each([
    {
      category: "an orphan test",
      files: { "apps/web/orphan.test.ts": CLEAN_TEST },
    },
    {
      category: "a TSX test",
      files: {
        "apps/web/view.test.tsx": CLEAN_TEST,
        "apps/web/view.ts": "export const view = true;\n",
      },
    },
    {
      category: "a nested test folder",
      files: { "packages/core/__test__/value.ts": "export const value = 1;\n" },
    },
    {
      category: "a test that runs its Effect",
      files: {
        "scripts/runner.test.ts":
          'import { Effect } from "effect";\nEffect.runSync(program);\n',
        "scripts/runner.ts": "export const runner = true;\n",
      },
    },
    {
      category: "an arbitrary value a Tailwind class repeats",
      files: { "apps/web/card.tsx": 'export const card = "ring-[3px]";\n' },
    },
    {
      category: "a native Map",
      files: { "apps/web/store.ts": "export const store = new Map();\n" },
    },
    {
      category: "an Object helper",
      files: {
        "apps/web/store.ts": "export const store = Object.keys(value);\n",
      },
    },
    {
      category: "a gateway client outside its module",
      files: {
        "packages/core/model.ts":
          'import { createGateway } from "@ai-sdk/gateway";\n',
      },
    },
    {
      category: "typeof-object narrowing",
      files: {
        "packages/core/guard.ts":
          'export const isRecord = (value: unknown) => typeof value === "object";\n',
      },
    },
  ])("fails for $category alone", ({ files }) =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const root = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "test-policy-category-",
      });
      yield* writeFixtures(root, {
        "apps/web/value.ts": "export const value = 1;\n",
        "packages/core/value.ts": "export const value = 1;\n",
        "scripts/tool.ts": "export const tool = true;\n",
        ...files,
      });

      const result = yield* checkFixture(root);
      assert.strictEqual(result.status, 1);
      assert.strictEqual(result.stderr.length, 1);
      assert.deepStrictEqual(result.stdout, []);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("reports unreadable repository sources as typed failures", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repository = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "test-policy-unreadable-",
      });
      yield* writeFixtures(repository, {
        "apps/web/value.test.ts": CLEAN_TEST,
        "apps/web/value.ts": "export const value = 1;\n",
        "packages/core/value.ts": "export const value = 1;\n",
        "scripts/tool.ts": "export const tool = true;\n",
      });
      const unreadableTest = path.join(repository, "apps/web/value.test.ts");
      const unreadableSource = path.join(repository, "scripts/tool.ts");

      const failures = [
        yield* checkFixture(repository).pipe(
          Effect.provide(unreadableFile(unreadableTest)),
          Effect.flip
        ),
        yield* checkFixture(repository).pipe(
          Effect.provide(unreadableFile(unreadableSource)),
          Effect.flip
        ),
      ];

      assert.deepStrictEqual(
        Arr.map(failures, ({ _tag, message }) => [_tag, message]),
        [
          ["RepositoryReadError", `Unable to read ${unreadableTest}.`],
          ["RepositoryReadError", `Unable to read ${unreadableSource}.`],
        ]
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
