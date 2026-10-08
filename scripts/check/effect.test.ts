import { afterEach, assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { API, Checker, Snapshot } from "typescript/unstable/sync";
import { effectFindings, effectTestViolations } from "#scripts/check/effect";
import { parseSources, type RepositorySource } from "#scripts/check/source";

const FILE = "packages/example/src/program.test.ts";
const VIOLATION =
  "packages/example/src/program.test.ts: return the Effect to @effect/vitest instead of running it.";

/** Lists the Effect-native findings of sources as `file:line rule`. */
const findings = Effect.fn("EffectPolicyTest.findings")(function* (
  sources: readonly (typeof RepositorySource.Type)[]
) {
  const found = yield* effectFindings(yield* parseSources(sources));
  return Arr.map(found, ({ file, line, rule }) => `${file}:${line} ${rule}`);
}, Effect.scoped);

afterEach(() => vi.restoreAllMocks());

describe("Effect test policy", () => {
  it.effect("closes the compiler after an isolated batch", () =>
    Effect.gen(function* () {
      const close = vi.spyOn(API.prototype, "close");
      const violations = yield* effectTestViolations([
        { file: FILE, sourceText: "const Effect = client;" },
        {
          file: FILE,
          sourceText:
            'import { Effect } from "effect"; Effect.runPromise(program);',
        },
        { file: FILE, sourceText: "Effect.runPromise(program);" },
      ]);
      assert.deepStrictEqual(violations, [VIOLATION]);
      assert.strictEqual(close.mock.calls.length, 1);
    })
  );

  it.effect("ignores sources that are not TypeScript tests", () =>
    Effect.gen(function* () {
      const violations = yield* effectTestViolations([
        {
          file: "packages/example/src/program.ts",
          sourceText:
            'import { Effect } from "effect"; Effect.runSync(program);',
        },
      ]);
      assert.deepStrictEqual(violations, []);
    })
  );

  it.effect("closes the compiler and preserves native failures", () =>
    Effect.gen(function* () {
      const cause = new Error("native compiler disconnected");
      const close = vi.spyOn(API.prototype, "close");
      vi.spyOn(Checker.prototype, "getSymbolAtLocation").mockImplementationOnce(
        () => {
          throw cause;
        }
      );
      const failure = yield* effectTestViolations([
        {
          file: FILE,
          sourceText: 'import { Effect } from "effect"; Effect.void;',
        },
      ]).pipe(Effect.flip);
      assert.strictEqual(failure._tag, "TestCompilerError");
      assert.strictEqual(failure.cause, cause);
      assert.strictEqual(failure.message, `Unable to inspect ${FILE}.`);
      assert.strictEqual(close.mock.calls.length, 1);
    })
  );

  it.effect("fails when the native compiler omits the test project", () =>
    Effect.gen(function* () {
      vi.spyOn(Snapshot.prototype, "getProject").mockReturnValueOnce(undefined);
      const failure = yield* effectTestViolations([
        { file: FILE, sourceText: "export {};" },
      ]).pipe(Effect.flip);
      assert.strictEqual(failure._tag, "TestCompilerError");
      assert.strictEqual(failure.cause, "The native test project is missing.");
      assert.strictEqual(failure.message, `Unable to inspect ${FILE}.`);
    })
  );
});

describe("native compiler startup", () => {
  it.effect(
    "fails the test policy with a typed error when it cannot start",
    () =>
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
          () => import("#scripts/check/effect")
        );
        const failure = yield* policy
          .effectTestViolations([{ file: FILE, sourceText: "export {};" }])
          .pipe(Effect.flip);
        assert.deepStrictEqual(
          [failure._tag, failure.cause, failure.message],
          [
            "TestCompilerError",
            cause,
            "Unable to start the native test compiler.",
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
});

describe("Effect-native findings", () => {
  it.effect("counts a platform global only where nothing shadows it", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings([
          {
            file: "apps/www/lib/cache.ts",
            sourceText: `import { Array } from "effect";
export function read(text: string, Object: { keys: (text: string) => unknown }) {
  return [Array.isArray(text), Object.keys(text)];
}
export const names = Object.keys(text);
`,
          },
        ]),
        ["apps/www/lib/cache.ts:5 object-helper"]
      );
    })
  );

  it.effect("skips modules that a tool marks as generated", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings([
          {
            file: "packages/backend/components/auth/schema.ts",
            sourceText:
              "/**\n * This file is auto-generated. Do not edit this file manually.\n */\nexport const tables = Object.keys(value);\n",
          },
          {
            file: "packages/backend/components/auth/tagged.ts",
            sourceText:
              "// @generated by the auth CLI\nexport const tables = Object.keys(value);\n",
          },
          {
            file: "packages/backend/components/auth/empty.ts",
            sourceText: "// @generated by the auth CLI\n",
          },
        ]),
        []
      );
    })
  );

  it.effect("orders findings by file, line, and rule", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings([
          {
            file: "packages/example/b.ts",
            sourceText: "Object.keys(Array.isArray(value));\n",
          },
          {
            file: "packages/example/a.ts",
            sourceText:
              "export const list = Array.isArray(value);\nObject.values(list);\n",
          },
        ]),
        [
          "packages/example/a.ts:1 array-check",
          "packages/example/a.ts:2 object-helper",
          "packages/example/b.ts:1 array-check",
          "packages/example/b.ts:1 object-helper",
        ]
      );
    })
  );
});
