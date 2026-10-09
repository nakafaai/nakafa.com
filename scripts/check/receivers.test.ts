import { afterEach, assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect, Record as Rec } from "effect";
import { Checker, type Project } from "typescript/unstable/sync";
import { arrayCall } from "#scripts/check/calls";
import { receiverVerdicts } from "#scripts/check/receivers";
import { descendants } from "#scripts/check/source";
import { ROOT, typedProject, withProject } from "#scripts/check/test.helpers";

/** Modules whose array method receivers the compiler types as arrays, each call on line 2. */
const ARRAYS = {
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
};

/** Modules whose array method receivers the compiler does not type as arrays. */
const NOT_ARRAYS = {
  "scripts/plain/map.ts":
    "export const names = new Map<string, number>();\nexport const seen = names.forEach(() => {});\n",
  "scripts/plain/mixed.ts":
    "declare const rows: number[] | Set<number>;\nexport const seen = rows.forEach(() => {});\n",
  "scripts/plain/named.ts":
    "declare const tagged: Set<number> & { tag: string };\nexport const seen = tagged.forEach(() => {});\n",
  "scripts/plain/namespace.ts":
    'import * as Arr from "./arr";\nexport const mapped = Arr.map([1], String);\n',
  "scripts/plain/arr.ts":
    "export function map(values: unknown, apply: (value: unknown) => unknown) {\n  return apply(values);\n}\n",
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
};

afterEach(() => vi.restoreAllMocks());

/** Lists the verdict of each array method receiver in the given modules as `file:line verdict`. */
const verdicts = Effect.fn("ReceiverTest.verdicts")(function* (
  project: Project,
  files: readonly string[]
) {
  const lists = yield* Effect.forEach(files, (file) =>
    Effect.gen(function* () {
      const sourceFile = yield* Effect.fromNullishOr(
        project.program.getSourceFile(`${ROOT}/${file}`)
      );
      const calls = Arr.filterMap(descendants(sourceFile), arrayCall);
      const found = yield* receiverVerdicts(
        project.checker,
        Arr.map(calls, ({ receiver }) => receiver)
      );
      return Arr.zipWith(
        calls,
        found,
        ({ node }, array) =>
          `${file}:${sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1} ${array ? "array" : "not array"}`
      );
    })
  );
  return Arr.flatten(lists);
});

describe("array receivers by declared type", () => {
  it.effect(
    "reads a receiver whose type extends Array or ReadonlyArray as an array",
    () =>
      Effect.gen(function* () {
        const files = {
          "scripts/verdicts/extends.ts":
            "export interface Rows extends Array<number> {}\ndeclare const rows: Rows;\nexport const doubled = rows.map(String);\n",
          "scripts/verdicts/readonly-extends.ts":
            "export interface Names extends ReadonlyArray<string> {}\ndeclare const names: Names;\nexport const lengths = names.map((name) => name.length);\n",
        };
        const project = yield* typedProject(withProject(files));
        assert.deepStrictEqual(yield* verdicts(project, Rec.keys(files)), [
          "scripts/verdicts/extends.ts:3 array",
          "scripts/verdicts/readonly-extends.ts:3 array",
        ]);
      })
  );

  it.effect(
    "reads an array receiver through the type the compiler gives it",
    () =>
      Effect.gen(function* () {
        const project = yield* typedProject(withProject(ARRAYS));
        assert.deepStrictEqual(yield* verdicts(project, Rec.keys(ARRAYS)), [
          "scripts/verdicts/any.ts:2 array",
          "scripts/verdicts/declared.ts:2 array",
          "scripts/verdicts/intersection.ts:2 array",
          "scripts/verdicts/nullable.ts:2 array",
          "scripts/verdicts/optional.ts:2 array",
          "scripts/verdicts/parameter.ts:2 array",
          "scripts/verdicts/readonly.ts:2 array",
          "scripts/verdicts/tuple.ts:2 array",
          "scripts/verdicts/union.ts:2 array",
          "scripts/verdicts/unresolved.ts:2 array",
        ]);
      }).pipe(Effect.scoped)
  );

  it.effect("leaves a receiver that is not an array unreported", () =>
    Effect.gen(function* () {
      const project = yield* typedProject(withProject(NOT_ARRAYS));
      assert.deepStrictEqual(yield* verdicts(project, Rec.keys(NOT_ARRAYS)), [
        "scripts/plain/map.ts:2 not array",
        "scripts/plain/mixed.ts:2 not array",
        "scripts/plain/named.ts:2 not array",
        "scripts/plain/namespace.ts:2 not array",
        "scripts/plain/nullish.ts:2 not array",
        "scripts/plain/object.ts:2 not array",
        "scripts/plain/path.ts:2 not array",
        "scripts/plain/set.ts:2 not array",
        "scripts/plain/typed.ts:1 not array",
        "scripts/plain/unconstrained.ts:2 not array",
      ]);
    }).pipe(Effect.scoped)
  );

  it.effect("counts a receiver the checker cannot give as an array", () =>
    Effect.gen(function* () {
      vi.spyOn(Checker.prototype, "getTypeAtLocation").mockReturnValueOnce([
        undefined,
      ]);
      const project = yield* typedProject(
        withProject({
          "scripts/verdicts/untyped.ts":
            "declare const rows: string;\nexport const doubled = rows.map(String);\n",
        })
      );
      assert.deepStrictEqual(
        yield* verdicts(project, ["scripts/verdicts/untyped.ts"]),
        ["scripts/verdicts/untyped.ts:2 array"]
      );
    }).pipe(Effect.scoped)
  );

  it.effect("fails with a typed error when the checker cannot answer", () =>
    Effect.gen(function* () {
      const cause = new Error("native checker disconnected");
      const project = yield* typedProject(
        withProject({
          "scripts/verdicts/declared.ts":
            ARRAYS["scripts/verdicts/declared.ts"],
        })
      );
      vi.spyOn(Checker.prototype, "isArrayLikeType").mockImplementationOnce(
        () => {
          throw cause;
        }
      );
      const failure = yield* verdicts(project, [
        "scripts/verdicts/declared.ts",
      ]).pipe(Effect.flip);
      assert.deepStrictEqual(
        [failure._tag, failure.cause, failure.message],
        ["TestCompilerError", cause, "Unable to read repository types."]
      );
    }).pipe(Effect.scoped)
  );

  it.effect(
    "reads a value a repository module exports through its declared type",
    () =>
      Effect.gen(function* () {
        const project = yield* typedProject(
          withProject({
            "scripts/data.ts":
              "export const rows: number[] = [1];\nexport const other: string[] = [];\n",
            "scripts/list.ts":
              "const list: number[] = [1];\nexport default list;\n",
            "scripts/space.ts":
              "export function map(value: unknown) {\n  return value;\n}\n",
            "scripts/use.ts": `import { rows, other as renamed } from "./data";\nimport list from "./list";\nimport * as space from "./space";\nrows.map(String);\nrenamed.filter(Boolean);\nlist.find(Boolean);\nspace.map(String);\n`,
          })
        );
        assert.deepStrictEqual(yield* verdicts(project, ["scripts/use.ts"]), [
          "scripts/use.ts:4 array",
          "scripts/use.ts:5 array",
          "scripts/use.ts:6 array",
          "scripts/use.ts:7 not array",
        ]);
      }).pipe(Effect.scoped)
  );
});
