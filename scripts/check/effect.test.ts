import { afterEach, assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { API, Checker } from "typescript/unstable/sync";
import {
  effectSourceViolations,
  effectTestViolations,
} from "#scripts/check/effect";

const FILE = "packages/example/src/program.test.ts";
const VIOLATION =
  "packages/example/src/program.test.ts: return the Effect to @effect/vitest instead of running it.";

afterEach(() => vi.restoreAllMocks());

describe("Effect test policy", () => {
  it.effect("rejects imported Effect and ManagedRuntime runners", () =>
    Effect.gen(function* () {
      const sources = [
        'import { Effect } from "effect";\nEffect.runPromise(program);',
        'import { Effect } from "effect";\nEffect["runSync"](program);',
        'import * as Runtime from "effect";\nRuntime.Effect.runFork(program);',
        'import { Effect } from "effect";\nconst Runtime = Effect;\nRuntime[key](program);',
        'import { runPromise as execute } from "effect/Effect";\nexecute(program);',
        'import { ManagedRuntime } from "effect";\nconst runtime = ManagedRuntime.make(layer);\nruntime.runSync(program);',
        'import { make } from "effect/ManagedRuntime";\nconst runtime = make(layer);\nruntime.runPromise(program);',
        'import { make as buildRuntime } from "effect/ManagedRuntime";\nconst runtime = buildRuntime(layer);\nruntime.runPromise(program);',
        'const Runtime = await import("effect");\nRuntime.Effect.runFork(program);',
        'const { make: buildRuntime } = await import("effect/ManagedRuntime");\nconst runtime = buildRuntime(layer);\nruntime.runPromise(program);',
      ];
      const violations = yield* effectTestViolations(
        sources.map((sourceText) => ({ file: FILE, sourceText }))
      );
      assert.deepStrictEqual(
        violations,
        sources.map(() => VIOLATION)
      );
    })
  );

  it.effect("rejects runners exposed through runtime destructuring", () =>
    Effect.gen(function* () {
      const sources = [
        'import { Effect } from "effect";\nconst { runPromise } = Effect;',
        'import { ManagedRuntime } from "effect";\nconst runtime = ManagedRuntime.make(layer);\nconst { runFork } = runtime;',
      ];
      const violations = yield* effectTestViolations(
        sources.map((sourceText) => ({ file: FILE, sourceText }))
      );
      assert.deepStrictEqual(
        violations,
        sources.map(() => VIOLATION)
      );
    })
  );

  it.effect("resolves runtime aliases by lexical binding", () =>
    Effect.gen(function* () {
      const violations = yield* effectTestViolations([
        {
          file: FILE,
          sourceText:
            'import { Effect } from "effect";\nconst runtime = client;\n{\n  const runtime = Effect;\n  runtime.runPromise(program);\n}',
        },
        {
          file: FILE,
          sourceText:
            'import { Effect } from "effect";\nconst runtime = Effect;\n{\n  const runtime = client;\n  runtime.runPromise(program);\n}',
        },
      ]);
      assert.deepStrictEqual(violations, [VIOLATION]);
    })
  );

  it.effect("allows native tests, types, and unrelated method names", () =>
    Effect.gen(function* () {
      const sources = [
        'import { Effect } from "effect";\nimport { it } from "@effect/vitest";\nit.effect("runs", () => Effect.succeed(1));',
        'import { it } from "@effect/vitest";\nit("pure", () => true);',
        'import type { runPromise } from "effect/Effect";\ntype Runner = typeof runPromise;',
        'import { Effect } from "effect";\ntype Runner = typeof Effect.runPromise;\nEffect.succeed(1);',
        'import { Schema } from "effect";\nSchema.runSync(program);',
        'import { Effect, Schema } from "effect";\nSchema.runSync(program);',
        'import { Effect } from "effect";\nclient.runPromise(program);',
        'import { Effect } from "effect";\nclient["runPromise"](program);',
        'import { Effect } from "effect";\nconst { runPromise } = client;',
        'import { Effect } from "effect";\nEffect["succeed"](1);',
        'const { Effect } = await import("effect");\nEffect.void;',
      ];
      const violations = yield* effectTestViolations([
        ...sources.map((sourceText) => ({ file: FILE, sourceText })),
        {
          file: "packages/example/src/program.ts",
          sourceText:
            'import { Effect } from "effect";\nEffect.runSync(program);',
        },
      ]);
      assert.deepStrictEqual(violations, []);
      const nonTests = yield* effectTestViolations([
        {
          file: "packages/example/src/program.ts",
          sourceText:
            'import { Effect } from "effect"; Effect.runSync(program);',
        },
      ]);
      assert.deepStrictEqual(nonTests, []);
    })
  );

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
});

const BACKEND_FILE = "packages/backend/convex/example/program.ts";
const TRY_VIOLATION = `${BACKEND_FILE}: model failure with Effect instead of a raw try/catch statement.`;
const NARROWING_VIOLATION = `${BACKEND_FILE}: narrow unknown input with Schema or Predicate instead of a typeof-object check.`;

describe("Effect source policy", () => {
  it.effect("rejects raw try statements and typeof-object narrowing", () =>
    Effect.gen(function* () {
      const violations = yield* effectSourceViolations([
        {
          file: BACKEND_FILE,
          sourceText:
            'export function read(value: unknown) {\n  try {\n    JSON.parse("{}");\n  } catch {\n    return null;\n  }\n  return typeof value === "object" && value !== null;\n}',
        },
      ]);
      assert.deepStrictEqual(
        [...violations].sort(),
        [TRY_VIOLATION, NARROWING_VIOLATION].sort()
      );
    })
  );

  it.effect("allows Effect-native failure and narrowing", () =>
    Effect.gen(function* () {
      const violations = yield* effectSourceViolations([
        {
          file: BACKEND_FILE,
          sourceText:
            'import { Effect, Predicate } from "effect";\nexport const read = Effect.fn("read")(function* (value: unknown) {\n  return Predicate.isObject(value) && Predicate.hasProperty(value, "code");\n});',
        },
        {
          file: BACKEND_FILE,
          sourceText:
            "export async function clean() {\n  try {\n    await write();\n  } finally {\n    await erase();\n  }\n}",
        },
      ]);
      assert.deepStrictEqual(violations, []);
    })
  );

  it.effect("covers every authored module, including JSX", () =>
    Effect.gen(function* () {
      const appFile = "apps/www/lib/example.ts";
      const viewFile = "apps/www/components/example.tsx";
      const violations = yield* effectSourceViolations([
        {
          file: appFile,
          sourceText: 'export const value = typeof input === "object";',
        },
        {
          file: viewFile,
          sourceText:
            'export const View = () => (typeof input === "object" ? null : <div />);',
        },
      ]);
      assert.deepStrictEqual(
        [...violations].sort(),
        [
          `${appFile}: narrow unknown input with Schema or Predicate instead of a typeof-object check.`,
          `${viewFile}: narrow unknown input with Schema or Predicate instead of a typeof-object check.`,
        ].sort()
      );
    })
  );

  it.effect("ignores sources that are not authored modules", () =>
    Effect.gen(function* () {
      const violations = yield* effectSourceViolations([
        {
          file: "apps/www/content/example.md",
          sourceText: 'export const value = typeof input === "object";',
        },
      ]);
      assert.deepStrictEqual(violations, []);
    })
  );
});
