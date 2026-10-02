import { afterEach, assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { isIdentifier, type SourceFile } from "typescript/unstable/ast";
import { API, Checker, Program, Snapshot } from "typescript/unstable/sync";
import {
  descendants,
  parseSources,
  type RepositorySource,
} from "#scripts/check/source";

const FILE = "packages/example/src/program.ts";
const VIEW = "apps/www/components/example.tsx";

/** Returns the identifiers named `name` in one module, type positions included. */
function named(sourceFile: SourceFile, name: string) {
  return Arr.filter(
    Arr.filter(descendants(sourceFile, false), isIdentifier),
    (node) => node.text === name
  );
}

/** Parses sources and binds the last identifier of each name across all modules. */
const bindLast = Effect.fn("SourcePolicyTest.bindLast")(function* (
  sources: readonly (typeof RepositorySource.Type)[],
  names: readonly string[]
) {
  const { bind, modules } = yield* parseSources(sources);
  return yield* bind(
    Arr.flatMap(names, (name) =>
      Arr.takeRight(
        Arr.flatMap(modules, ({ sourceFile }) => named(sourceFile, name)),
        1
      )
    )
  );
}, Effect.scoped);

afterEach(() => vi.restoreAllMocks());

describe("repository source batch", () => {
  it.effect("parses every module in one batch and closes the compiler", () =>
    Effect.gen(function* () {
      const close = vi.spyOn(API.prototype, "close");
      const modules = yield* Effect.scoped(
        Effect.map(
          parseSources([
            { file: FILE, sourceText: "export {};" },
            { file: VIEW, sourceText: "export const View = () => <div />;" },
          ]),
          (parsed) =>
            Arr.map(parsed.modules, ({ file, sourceFile }) => [
              file,
              sourceFile.text,
            ])
        )
      );
      assert.deepStrictEqual(modules, [
        [FILE, "export {};"],
        [VIEW, "export const View = () => <div />;"],
      ]);
      assert.strictEqual(close.mock.calls.length, 1);
    })
  );

  it.effect(
    "binds identifiers to globals, imports, and local declarations",
    () =>
      Effect.gen(function* () {
        const bindings = yield* bindLast(
          [
            {
              file: FILE,
              sourceText:
                'import { Array } from "effect";\nconst local = 1;\nArray.isArray(local);\nObject.keys(globalThis);\n',
            },
          ],
          ["Array", "local", "Object", "globalThis"]
        );
        assert.deepStrictEqual(bindings, [
          "import",
          "local",
          "global",
          "global",
        ]);
      })
  );

  it.effect("keeps the top-level names of a script out of other modules", () =>
    Effect.gen(function* () {
      const bindings = yield* bindLast(
        [
          { file: "scripts/legacy.ts", sourceText: "const Map = 1;\n" },
          { file: FILE, sourceText: "export const cache = new Map();\n" },
        ],
        ["Map"]
      );
      assert.deepStrictEqual(bindings, ["global"]);
    })
  );

  it.effect("walks type positions only when asked", () =>
    Effect.gen(function* () {
      const counts = yield* Effect.scoped(
        Effect.map(
          parseSources([
            {
              file: FILE,
              sourceText: "export const cache: Map<string, number> = make();\n",
            },
          ]),
          ({ modules }) =>
            Arr.map(modules, ({ sourceFile }) => [
              Arr.length(
                Arr.filter(
                  descendants(sourceFile),
                  (node) => isIdentifier(node) && node.text === "Map"
                )
              ),
              Arr.length(named(sourceFile, "Map")),
            ])
        )
      );
      assert.deepStrictEqual(counts, [[0, 1]]);
    })
  );
});

describe("repository source batch failures", () => {
  it.effect("fails with a typed error when the compiler cannot start", () =>
    Effect.gen(function* () {
      const cause = new Error("native compiler unavailable");
      vi.resetModules();
      vi.doMock("typescript/unstable/sync", () => ({
        API: class {
          constructor() {
            throw cause;
          }
        },
      }));
      const policy = yield* Effect.promise(
        () => import("#scripts/check/source")
      );
      const failure = yield* Effect.scoped(
        policy.parseSources([{ file: FILE, sourceText: "" }])
      ).pipe(Effect.flip);
      assert.deepStrictEqual(
        [failure._tag, failure.cause, failure.message],
        [
          "TestCompilerError",
          cause,
          "Unable to start the native source compiler.",
        ]
      );
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          vi.doUnmock("typescript/unstable/sync");
          vi.resetModules();
        })
      )
    )
  );

  it.effect("fails when the compiler cannot open or expose the sources", () =>
    Effect.gen(function* () {
      const cause = new Error("native snapshot unavailable");
      const parse = Effect.scoped(
        parseSources([{ file: FILE, sourceText: "export {};" }])
      ).pipe(Effect.flip);
      vi.spyOn(API.prototype, "updateSnapshot").mockImplementationOnce(() => {
        throw cause;
      });
      const snapshotFailure = yield* parse;
      vi.spyOn(Snapshot.prototype, "getProject").mockReturnValueOnce(undefined);
      const projectFailure = yield* parse;
      vi.spyOn(Program.prototype, "getSourceFile").mockReturnValueOnce(
        undefined
      );
      const sourceFailure = yield* parse;

      assert.deepStrictEqual(
        Arr.map([snapshotFailure, projectFailure, sourceFailure], (failure) => [
          failure._tag,
          failure.cause,
          failure.message,
        ]),
        [
          ["TestCompilerError", cause, "Unable to inspect repository sources."],
          [
            "TestCompilerError",
            "The native source project is missing.",
            "Unable to inspect repository sources.",
          ],
          [
            "TestCompilerError",
            `The native compiler did not expose ${FILE} as a source file.`,
            "Unable to inspect repository sources.",
          ],
        ]
      );
    })
  );

  it.effect("fails binding with a typed error when the checker fails", () =>
    Effect.gen(function* () {
      const cause = new Error("native checker disconnected");
      vi.spyOn(Checker.prototype, "getSymbolAtLocation").mockImplementationOnce(
        () => {
          throw cause;
        }
      );
      const failure = yield* bindLast(
        [{ file: FILE, sourceText: "Map;\n" }],
        ["Map"]
      ).pipe(Effect.flip);
      assert.deepStrictEqual(
        [failure._tag, failure.cause, failure.message],
        ["TestCompilerError", cause, "Unable to inspect repository sources."]
      );
    })
  );
});
