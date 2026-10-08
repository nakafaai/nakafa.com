import { NodeServices } from "@effect/platform-node";
import { afterEach, assert, describe, it } from "@effect/vitest";
import {
  Array as Arr,
  Effect,
  FileSystem,
  Order,
  Path,
  Record as Rec,
  Result,
} from "effect";
import { API, Checker, Program, Snapshot } from "typescript/unstable/sync";
import { arrayFindings, isProjectConfig } from "#scripts/check/arrays";
import {
  openCompiler,
  openRepositoryCompiler,
  parseSources,
} from "#scripts/check/source";

const ROOT = "/fixture";
const PROJECT_CONFIG = "tsconfig.json";
const PROJECT =
  '{"compilerOptions":{"moduleResolution":"bundler","module":"esnext","noEmit":true,"strict":true,"target":"es2022"},"include":["**/*.ts"]}\n';
const ORDER = Order.Struct({
  file: Order.String,
  line: Order.Number,
  rule: Order.String,
});

/**
 * Writes fixture modules into an in-memory repository with their configurations,
 * and parses their sources. Every fixture module sits under `scripts/`, the folder
 * that the array rules cover.
 */
const fixture = Effect.fn("ArrayPolicyTest.fixture")(function* (
  files: Readonly<Record<string, string>>
) {
  const sources = Arr.filterMap(Rec.toEntries(files), ([file, sourceText]) =>
    isProjectConfig(file)
      ? Result.failVoid
      : Result.succeed({ file, sourceText })
  );
  const parsed = yield* parseSources(sources);
  const api = yield* openCompiler(
    Rec.fromEntries(
      Arr.map(Rec.toEntries(files), ([file, text]): [string, string] => [
        `${ROOT}/${file}`,
        text,
      ])
    ),
    "Unable to start the array fixture compiler."
  );
  return {
    api,
    configs: Arr.filter(Rec.keys(files), isProjectConfig),
    modules: parsed.modules,
  };
});

/** Lists the array findings of fixture modules as `file:line rule`, in file and line order. */
const judge = Effect.fn("ArrayPolicyTest.judge")(function* (
  files: Readonly<Record<string, string>>
) {
  const { api, configs, modules } = yield* fixture(files);
  const found = yield* arrayFindings(api, ROOT, configs, modules);
  return Arr.map(
    Arr.sort(found, ORDER),
    ({ file, line, rule }) => `${file}:${line} ${rule}`
  );
}, Effect.scoped);

/** The fixture modules with the root project that judges them. */
const withProject = (files: Readonly<Record<string, string>>) => ({
  [PROJECT_CONFIG]: PROJECT,
  ...files,
});

afterEach(() => vi.restoreAllMocks());

describe("array receivers by declared type", () => {
  it.effect("reports a receiver whose type is an array", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* judge(
          withProject({
            "scripts/verdicts/any.ts":
              "declare const rows: any;\nexport const doubled = rows.map(String);\n",
            "scripts/verdicts/declared.ts":
              "declare const rows: number[];\nexport const doubled = rows.map(String);\n",
            "scripts/verdicts/intersection.ts":
              "declare const rows: { id: number }[] & { tag: string };\nexport const ids = rows.map((row) => row.id);\n",
            "scripts/verdicts/nullable.ts":
              "declare const rows: number[] | null;\nexport const doubled = rows?.map(String);\n",
            "scripts/verdicts/optional.ts":
              "declare const rows: number[] | undefined;\nexport const doubled = rows?.map(String);\n",
            "scripts/verdicts/parameter.ts":
              "export function doubled<T extends number[]>(rows: T) {\n  return rows.map(String);\n}\n",
            "scripts/verdicts/readonly.ts":
              "declare const names: readonly string[];\nexport const lengths = names.map((name) => name.length);\n",
            "scripts/verdicts/tuple.ts":
              "declare const pair: [number, string];\nexport const first = pair.map(String);\n",
            "scripts/verdicts/union.ts":
              "declare const rows: number[] | string[];\nexport const seen = rows.forEach(() => {});\n",
            "scripts/verdicts/unresolved.ts":
              'import { rows } from "./missing";\nexport const doubled = rows.map(String);\n',
          })
        ).pipe(Effect.provide(NodeServices.layer)),
        [
          "scripts/verdicts/any.ts:2 array-method",
          "scripts/verdicts/declared.ts:2 array-method",
          "scripts/verdicts/intersection.ts:2 array-method",
          "scripts/verdicts/nullable.ts:2 array-method",
          "scripts/verdicts/optional.ts:2 array-method",
          "scripts/verdicts/parameter.ts:2 array-method",
          "scripts/verdicts/readonly.ts:2 array-method",
          "scripts/verdicts/tuple.ts:2 array-method",
          "scripts/verdicts/union.ts:2 array-method",
          "scripts/verdicts/unresolved.ts:2 array-method",
        ]
      );
    })
  );

  it.effect("leaves a receiver that is not an array unreported", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* judge(
          withProject({
            "scripts/plain/arr.ts":
              "export function map(values: unknown, apply: (value: unknown) => unknown) {\n  return apply(values);\n}\n",
            "scripts/plain/map.ts":
              "export const names = new Map<string, number>();\nexport const seen = names.forEach(() => {});\n",
            "scripts/plain/mixed.ts":
              "declare const rows: number[] | Set<number>;\nexport const seen = rows.forEach(() => {});\n",
            "scripts/plain/named.ts":
              "declare const tagged: Set<number> & { tag: string };\nexport const seen = tagged.forEach(() => {});\n",
            "scripts/plain/namespace.ts":
              'import * as Arr from "./arr";\nexport const mapped = Arr.map([1], String);\n',
            "scripts/plain/nullish.ts":
              "declare const nothing: null | undefined;\nexport const doubled = nothing?.map(String);\n",
            "scripts/plain/object.ts":
              "const stack = { push(value: number) { return value; } };\nexport const pushed = stack.push(1);\n",
            "scripts/plain/path.ts":
              'declare const path: { join(left: string, right: string): string };\nexport const joined = path.join("a", "b");\n',
            "scripts/plain/set.ts":
              "declare const names: Set<string>;\nexport const seen = names.forEach(() => {});\n",
            "scripts/plain/typed.ts":
              "export const doubled = new Uint8Array(2).map((value) => value + 1);\n",
            "scripts/plain/unconstrained.ts":
              "export function doubled<T>(rows: T) {\n  return rows.map(String);\n}\n",
          })
        ).pipe(Effect.provide(NodeServices.layer)),
        []
      );
    })
  );
});

describe("array rules and call forms", () => {
  it.effect("reports each array rule by its method and call form", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* judge(
          withProject({
            "scripts/rules/element.ts":
              'declare const rows: number[];\nexport const doubled = rows["map"](String);\n',
            "scripts/rules/dynamic.ts":
              'declare const rows: number[];\ndeclare const name: "map" | "filter";\nexport const doubled = rows[name](String);\n',
            "scripts/rules/join.ts":
              'declare const parts: string[];\nexport const text = parts.join(", ");\nexport const plain = parts.join();\n',
            "scripts/rules/mutation.ts":
              "declare const rows: number[];\nrows.push(1);\n",
            "scripts/rules/other.ts":
              "declare const rows: number[];\nexport const sliced = rows.slice(1);\n",
            "scripts/rules/search.ts":
              "declare const rows: number[];\nexport const first = rows.find((row) => row > 1);\n",
          })
        ).pipe(Effect.provide(NodeServices.layer)),
        [
          "scripts/rules/element.ts:2 array-method",
          "scripts/rules/join.ts:2 array-method",
          "scripts/rules/join.ts:3 array-method",
          "scripts/rules/mutation.ts:2 array-mutation",
          "scripts/rules/search.ts:2 array-search",
        ]
      );
    })
  );

  it.effect("keeps browser page functions out of the verdict", () =>
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
          })
        ).pipe(Effect.provide(NodeServices.layer)),
        ["scripts/e2e/support/canvas.ts:5 array-method"]
      );
    })
  );

  it.effect("skips a generated module", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* judge(
          withProject({
            "scripts/generated/rows.ts":
              "// @generated by a tool\ndeclare const rows: number[];\nexport const doubled = rows.map(String);\n",
          })
        ).pipe(Effect.provide(NodeServices.layer)),
        []
      );
    })
  );

  it.effect("counts a receiver whose type the checker cannot give", () =>
    Effect.gen(function* () {
      vi.spyOn(Checker.prototype, "getTypeAtLocation").mockReturnValueOnce([
        undefined,
      ]);
      assert.deepStrictEqual(
        yield* judge(
          withProject({
            "scripts/verdicts/untyped.ts":
              "declare const rows: string;\nexport const doubled = rows.map(String);\n",
          })
        ).pipe(Effect.provide(NodeServices.layer)),
        ["scripts/verdicts/untyped.ts:2 array-method"]
      );
    })
  );
});

describe("projects of the judged modules", () => {
  it.effect(
    "judges a module in its nearest project, one project at a time",
    () =>
      Effect.gen(function* () {
        const update = vi.spyOn(API.prototype, "updateSnapshot");
        const found = yield* judge({
          [PROJECT_CONFIG]: PROJECT,
          "scripts/core/value.ts":
            "declare const rows: number[];\nexport const doubled = rows.map(String);\n",
          "scripts/web/tsconfig.json": PROJECT,
          "scripts/web/value.ts":
            "declare const rows: number[];\nexport const doubled = rows.map(String);\n",
        }).pipe(Effect.provide(NodeServices.layer));
        assert.deepStrictEqual(found, [
          "scripts/core/value.ts:2 array-method",
          "scripts/web/value.ts:2 array-method",
        ]);
        assert.deepStrictEqual(
          Arr.filter(
            Arr.map(update.mock.calls, ([params]) => params),
            (params) => {
              const [project] = params?.openProjects ?? [];
              return typeof project === "string" && project.startsWith(ROOT);
            }
          ),
          [
            {
              closeProjects: [],
              openProjects: [`${ROOT}/scripts/web/tsconfig.json`],
            },
            {
              closeProjects: [`${ROOT}/scripts/web/tsconfig.json`],
              openProjects: [`${ROOT}/${PROJECT_CONFIG}`],
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
        }).pipe(Effect.provide(NodeServices.layer), Effect.flip);
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
      }).pipe(Effect.provide(NodeServices.layer), Effect.flip);
      assert.deepStrictEqual(
        [failure._tag, failure.message],
        [
          "TestCompilerError",
          "scripts/tool.ts is not part of its nearest project tsconfig.json, so the array rules cannot read its types.",
        ]
      );
    })
  );

  it.effect(
    "fails with a typed error when the compiler cannot open a project",
    () =>
      Effect.gen(function* () {
        const cause = new Error("native snapshot unavailable");
        const { api, configs, modules } = yield* fixture(
          withProject({
            "scripts/verdicts/declared.ts":
              "declare const rows: number[];\nexport const doubled = rows.map(String);\n",
          })
        );
        vi.spyOn(API.prototype, "updateSnapshot").mockImplementationOnce(() => {
          throw cause;
        });
        const failure = yield* arrayFindings(api, ROOT, configs, modules).pipe(
          Effect.flip
        );
        assert.deepStrictEqual(
          [failure._tag, failure.cause, failure.message],
          ["TestCompilerError", cause, "Unable to open tsconfig.json."]
        );
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect("fails when the snapshot omits a project", () =>
    Effect.gen(function* () {
      const { api, configs, modules } = yield* fixture(
        withProject({
          "scripts/verdicts/declared.ts":
            "declare const rows: number[];\nexport const doubled = rows.map(String);\n",
        })
      );
      vi.spyOn(Snapshot.prototype, "getProject").mockReturnValueOnce(undefined);
      const failure = yield* arrayFindings(api, ROOT, configs, modules).pipe(
        Effect.flip
      );
      assert.deepStrictEqual(
        [failure._tag, failure.cause, failure.message],
        [
          "TestCompilerError",
          "The native project tsconfig.json is missing.",
          "Unable to open tsconfig.json.",
        ]
      );
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect(
    "fails with a typed error when the program cannot locate a module",
    () =>
      Effect.gen(function* () {
        const cause = new Error("native program disconnected");
        const { api, configs, modules } = yield* fixture(
          withProject({
            "scripts/verdicts/declared.ts":
              "declare const rows: number[];\nexport const doubled = rows.map(String);\n",
          })
        );
        vi.spyOn(Program.prototype, "getSourceFile").mockImplementationOnce(
          () => {
            throw cause;
          }
        );
        const failure = yield* arrayFindings(api, ROOT, configs, modules).pipe(
          Effect.flip
        );
        assert.deepStrictEqual(
          [failure._tag, failure.cause, failure.message],
          [
            "TestCompilerError",
            cause,
            "Unable to inspect scripts/verdicts/declared.ts.",
          ]
        );
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect("fails with a typed error when the checker cannot answer", () =>
    Effect.gen(function* () {
      const cause = new Error("native checker disconnected");
      const { api, configs, modules } = yield* fixture(
        withProject({
          "scripts/verdicts/declared.ts":
            "declare const rows: number[];\nexport const doubled = rows.map(String);\n",
        })
      );
      vi.spyOn(Checker.prototype, "isArrayType").mockImplementationOnce(() => {
        throw cause;
      });
      const failure = yield* arrayFindings(api, ROOT, configs, modules).pipe(
        Effect.flip
      );
      assert.deepStrictEqual(
        [failure._tag, failure.cause, failure.message],
        ["TestCompilerError", cause, "Unable to read repository types."]
      );
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect("judges a repository read from disk", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "array-policy-disk-",
      });
      const sourceText =
        "declare const rows: number[];\nexport const doubled = rows.map(String);\n";
      yield* fileSystem.makeDirectory(path.join(root, "scripts"));
      yield* fileSystem.writeFileString(
        path.join(root, PROJECT_CONFIG),
        PROJECT
      );
      yield* fileSystem.writeFileString(
        path.join(root, "scripts/value.ts"),
        sourceText
      );
      const parsed = yield* parseSources([
        { file: "scripts/value.ts", sourceText },
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
