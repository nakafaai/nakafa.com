import { NodeServices } from "@effect/platform-node";
import { afterEach, assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect, FileSystem, Order, Path } from "effect";
import { API, Program, Snapshot } from "typescript/unstable/sync";
import { arrayFindings, isProjectConfig } from "#scripts/check/arrays";
import {
  fixture,
  PROJECT,
  PROJECT_CONFIG,
  ROOT,
  withProject,
} from "#scripts/check/fixture";
import { openRepositoryCompiler, parseSources } from "#scripts/check/source";

/** A module with one array method call on line 2, judged by the root project. */
const CALL =
  "declare const rows: number[];\nexport const doubled = rows.map(String);\n";
const ORDER = Order.Struct({
  file: Order.String,
  line: Order.Number,
  rule: Order.String,
});

afterEach(() => vi.restoreAllMocks());

/** Lists the array findings of fixture files as `file:line rule`, in file and line order. */
const judge = Effect.fn("ArrayPolicyTest.judge")(
  function* (files: Readonly<Record<string, string>>) {
    const { api, configs, modules } = yield* fixture(files);
    const found = yield* arrayFindings(api, ROOT, configs, modules);
    return Arr.map(
      Arr.sort(found, ORDER),
      ({ file, line, rule }) => `${file}:${line} ${rule}`
    );
  },
  Effect.scoped,
  Effect.provide(NodeServices.layer)
);

/** The typed failure of judging the root project's module after `breakCompiler` has broken the compiler. */
const judgmentFailure = Effect.fn("ArrayPolicyTest.judgmentFailure")(
  function* (breakCompiler: () => void) {
    const { api, configs, modules } = yield* fixture(
      withProject({ "scripts/verdicts/declared.ts": CALL })
    );
    breakCompiler();
    return yield* arrayFindings(api, ROOT, configs, modules).pipe(Effect.flip);
  },
  Effect.scoped,
  Effect.provide(NodeServices.layer)
);

describe("array findings by project", () => {
  it.effect("reports a chained array method at the line of its name", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* judge({
          [PROJECT_CONFIG]: PROJECT,
          "scripts/chain.ts":
            "declare const rows: number[];\nexport const ids = rows\n  .filter(Boolean)\n  .map(String);\n",
        }),
        ["scripts/chain.ts:3 array-method", "scripts/chain.ts:4 array-method"]
      );
    })
  );

  it.effect("judges an array call inside an extends clause", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* judge({
          [PROJECT_CONFIG]: PROJECT,
          "scripts/heritage.ts":
            "declare function makeBase<T>(items: T): new () => object;\nexport class Holder extends makeBase([1, 2].map(String)) {}\n",
        }),
        ["scripts/heritage.ts:2 array-method"]
      );
    })
  );

  it.effect(
    "judges a module in its nearest project, one project at a time",
    () =>
      Effect.gen(function* () {
        const update = vi.spyOn(API.prototype, "updateSnapshot");
        assert.deepStrictEqual(
          yield* judge({
            [PROJECT_CONFIG]: PROJECT,
            "scripts/core/value.ts": CALL,
            "scripts/web/tsconfig.json": PROJECT,
            "scripts/web/value.ts": CALL,
          }),
          [
            "scripts/core/value.ts:2 array-method",
            "scripts/web/value.ts:2 array-method",
          ]
        );
        // The fixture's in-memory parse opens first, so the last two openings are the typed projects.
        const web = `${ROOT}/scripts/web/tsconfig.json`;
        assert.deepStrictEqual(
          Arr.takeRight(
            Arr.map(update.mock.calls, ([params]) => params),
            2
          ),
          [
            { closeProjects: [], openProjects: [web] },
            {
              closeProjects: [web],
              openProjects: [`${ROOT}/${PROJECT_CONFIG}`],
            },
          ]
        );
      })
  );

  it.effect(
    "judges a module in the project above its nearest one when that one excludes it",
    () =>
      Effect.gen(function* () {
        const update = vi.spyOn(API.prototype, "updateSnapshot");
        assert.deepStrictEqual(
          yield* judge({
            [PROJECT_CONFIG]: PROJECT,
            "packages/contracts/tsconfig.json": '{"include":["src/**/*.ts"]}\n',
            "packages/contracts/scripts/consumer/package.ts": CALL,
          }),
          ["packages/contracts/scripts/consumer/package.ts:2 array-method"]
        );
        // The nearest project opens first, and the project above it opens once, after it.
        const nested = `${ROOT}/packages/contracts/tsconfig.json`;
        assert.deepStrictEqual(
          Arr.takeRight(
            Arr.map(update.mock.calls, ([params]) => params),
            2
          ),
          [
            { closeProjects: [], openProjects: [nested] },
            {
              closeProjects: [nested],
              openProjects: [`${ROOT}/${PROJECT_CONFIG}`],
            },
          ]
        );
      })
  );

  it.effect(
    "judges a module that the nearest project and the project above both contain once, in the nearest",
    () =>
      Effect.gen(function* () {
        const update = vi.spyOn(API.prototype, "updateSnapshot");
        assert.deepStrictEqual(
          yield* judge({
            [PROJECT_CONFIG]: PROJECT,
            "packages/web/tsconfig.json": PROJECT,
            "packages/web/value.ts": CALL,
          }),
          ["packages/web/value.ts:2 array-method"]
        );
        // The fixture's in-memory parse opens first. The project above has nothing left to judge, so it never opens.
        assert.strictEqual(update.mock.calls.length, 2);
        assert.deepStrictEqual(
          Arr.takeRight(
            Arr.map(update.mock.calls, ([params]) => params),
            1
          ),
          [
            {
              closeProjects: [],
              openProjects: [`${ROOT}/packages/web/tsconfig.json`],
            },
          ]
        );
      })
  );

  it.effect(
    "fails when a judged module has no project up its folder tree",
    () =>
      Effect.gen(function* () {
        const failure = yield* judge({
          "scripts/cas/vercel.ts": "export const config = {};\n",
        }).pipe(Effect.flip);
        assert.deepStrictEqual(
          [failure._tag, failure.message],
          [
            "TestCompilerError",
            "scripts/cas/vercel.ts has no tsconfig.json up its folder tree, so the array rules cannot read its types.",
          ]
        );
      })
  );

  it.effect("fails when a project does not contain a judged module", () =>
    Effect.gen(function* () {
      const failure = yield* judge({
        [PROJECT_CONFIG]: '{"include":["src/**/*.ts"]}\n',
        "scripts/tool.ts": "export const tool = 1;\n",
      }).pipe(Effect.flip);
      assert.deepStrictEqual(
        [failure._tag, failure.message],
        [
          "TestCompilerError",
          "scripts/tool.ts is not part of any project up its folder tree (tried tsconfig.json), so the array rules cannot read its types.",
        ]
      );
    })
  );

  it.effect(
    "names every project tried when none up the folder tree contains a judged module",
    () =>
      Effect.gen(function* () {
        const failure = yield* judge({
          [PROJECT_CONFIG]: '{"include":["src/**/*.ts"]}\n',
          "packages/contracts/tsconfig.json": '{"include":["src/**/*.ts"]}\n',
          "packages/contracts/scripts/consumer/package.ts": CALL,
        }).pipe(Effect.flip);
        assert.deepStrictEqual(
          [failure._tag, failure.message],
          [
            "TestCompilerError",
            "packages/contracts/scripts/consumer/package.ts is not part of any project up its folder tree (tried packages/contracts/tsconfig.json, tsconfig.json), so the array rules cannot read its types.",
          ]
        );
      })
  );

  it.effect(
    "fails with a typed error when the compiler cannot open a project",
    () =>
      Effect.gen(function* () {
        const cause = new Error("native snapshot unavailable");
        const failure = yield* judgmentFailure(() => {
          vi.spyOn(API.prototype, "updateSnapshot").mockImplementationOnce(
            () => {
              throw cause;
            }
          );
        });
        assert.deepStrictEqual(
          [failure._tag, failure.cause, failure.message],
          ["TestCompilerError", cause, "Unable to open tsconfig.json."]
        );
      })
  );

  it.effect("fails when the snapshot omits a project", () =>
    Effect.gen(function* () {
      const failure = yield* judgmentFailure(() => {
        vi.spyOn(Snapshot.prototype, "getProject").mockReturnValueOnce(
          undefined
        );
      });
      assert.deepStrictEqual(
        [failure._tag, failure.cause, failure.message],
        [
          "TestCompilerError",
          "The native project tsconfig.json is missing.",
          "Unable to open tsconfig.json.",
        ]
      );
    })
  );

  it.effect(
    "fails with a typed error when the program cannot locate a module",
    () =>
      Effect.gen(function* () {
        const cause = new Error("native program disconnected");
        const failure = yield* judgmentFailure(() => {
          vi.spyOn(Program.prototype, "getSourceFile").mockImplementationOnce(
            () => {
              throw cause;
            }
          );
        });
        assert.deepStrictEqual(
          [failure._tag, failure.cause, failure.message],
          [
            "TestCompilerError",
            cause,
            "Unable to inspect scripts/verdicts/declared.ts.",
          ]
        );
      })
  );

  it.effect("judges a repository read from disk", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "array-policy-disk-",
      });
      yield* fileSystem.writeFileString(
        path.join(root, PROJECT_CONFIG),
        PROJECT
      );
      yield* fileSystem.makeDirectory(path.join(root, "scripts"));
      yield* fileSystem.writeFileString(
        path.join(root, "scripts/value.ts"),
        CALL
      );
      const parsed = yield* parseSources([
        { file: "scripts/value.ts", sourceText: CALL },
      ]);
      const api = yield* openRepositoryCompiler(
        root,
        "Unable to start the repository compiler."
      );
      const found = yield* arrayFindings(
        api,
        root,
        [PROJECT_CONFIG],
        parsed.modules
      );
      assert.deepStrictEqual(
        Arr.map(found, ({ file, line, rule }) => `${file}:${line} ${rule}`),
        ["scripts/value.ts:2 array-method"]
      );
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );
});

describe("array findings by method", () => {
  it.effect(
    "reports each array method that Effect replaces by the rule it breaks",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* judge({
            [PROJECT_CONFIG]: PROJECT,
            "scripts/methods.ts": `declare const rows: number[];
export const first = rows.at(0);
export const index = rows.indexOf(1);
export const last = rows.lastIndexOf(1);
export const has = rows.includes(1);
export const rest = rows.slice(1);
export const more = rows.concat([2]);
export const pairs = rows.entries();
`,
          }),
          [
            "scripts/methods.ts:2 array-search",
            "scripts/methods.ts:3 array-search",
            "scripts/methods.ts:4 array-search",
            "scripts/methods.ts:5 array-method",
            "scripts/methods.ts:6 array-method",
            "scripts/methods.ts:7 array-method",
            "scripts/methods.ts:8 array-method",
          ]
        );
      })
  );

  it.effect(
    "leaves a string, a Map, and a typed array with these method names unreported",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* judge({
            [PROJECT_CONFIG]: PROJECT,
            "scripts/label.ts": `declare const label: string;
export const first = label.at(0);
export const index = label.indexOf("a");
export const last = label.lastIndexOf("a");
export const has = label.includes("a");
export const rest = label.slice(1);
export const more = label.concat("b");
`,
            "scripts/names.ts": `declare const names: Map<string, number>;
export const pairs = names.entries();
`,
            "scripts/bytes.ts":
              "export const pairs = new Uint8Array(2).entries();\n",
          }),
          []
        );
      })
  );
});

describe("array findings by scope", () => {
  it.effect(
    "keeps browser page functions and generated modules out of the verdict",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* judge(
            withProject({
              "scripts/e2e/init.spec.ts":
                'import { patch } from "./support/canvas";\nimport { test } from "@playwright/test";\ntest("init", async ({ page }) => {\n  await page.addInitScript(patch, [1]);\n});\n',
              "scripts/e2e/inline.spec.ts":
                'import { test } from "@playwright/test";\ntest("reads", async ({ page }) => {\n  await page.evaluate(() => {\n    const rows = [1, 2];\n    return rows.map(String);\n  });\n});\n',
              "scripts/e2e/support/canvas.ts":
                "export function patch(rows: number[]) {\n  return rows.map(String);\n}\nexport function local(rows: number[]) {\n  return rows.map(String);\n}\n",
              "scripts/generated/rows.ts": `// @generated by a tool\n${CALL}`,
            })
          ),
          ["scripts/e2e/support/canvas.ts:5 array-method"]
        );
      })
  );

  it.effect(
    "judges every authored module outside framework configuration, tests included, reporting only arrays",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* judge({
            "apps/www/tsconfig.json": PROJECT,
            "packages/backend/tsconfig.json": PROJECT,
            "scripts/tsconfig.json": PROJECT,
            "apps/www/lib/list.ts": CALL,
            "packages/backend/confect/users/list.test.ts": CALL,
            "packages/backend/confect/users/list.ts": CALL,
            "packages/backend/convex/users.ts": CALL,
            "scripts/check/list.ts": CALL,
            "scripts/check/names.ts":
              "declare const names: Set<string>;\nexport const seen = names.forEach(() => {});\n",
            "scripts/vitest.config.ts": `import { defineConfig } from "vitest/config";\n${CALL}`,
          }),
          [
            "apps/www/lib/list.ts:2 array-method",
            "packages/backend/confect/users/list.test.ts:2 array-method",
            "packages/backend/confect/users/list.ts:2 array-method",
            "packages/backend/convex/users.ts:2 array-method",
            "scripts/check/list.ts:2 array-method",
          ]
        );
      })
  );

  it.effect("needs no project for framework configuration", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* judge({
          "apps/cas/vercel.ts": `import type { VercelConfig } from "@vercel/config/v1";\n${CALL}`,
          "apps/www/vitest.config.ts": `import { defineConfig } from "vitest/config";\n${CALL}`,
        }),
        []
      );
    })
  );
});

describe("project configuration names", () => {
  it("recognizes only a project's tsconfig.json", () => {
    assert.deepStrictEqual(
      Arr.map(
        [
          "tsconfig.json",
          "apps/www/tsconfig.json",
          "apps/www/mytsconfig.json",
          "packages/typescript-config/base.json",
        ],
        isProjectConfig
      ),
      [true, true, false, false]
    );
  });
});
