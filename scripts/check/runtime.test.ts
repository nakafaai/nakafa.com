import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { effectTestViolations } from "#scripts/check/effect";

const caseFile = (index: number) => `packages/example/src/case${index}.test.ts`;
const violation = (index: number) =>
  `${caseFile(index)}: return the Effect to @effect/vitest instead of running it.`;

/** Returns the runner violations for each source in one native batch. */
const inspect = Effect.fn("RuntimePolicyTest.inspect")(function* (
  sources: readonly string[]
) {
  return yield* effectTestViolations(
    sources.map((sourceText, index) => ({ file: caseFile(index), sourceText }))
  );
});

describe("Effect runtime detection", () => {
  it.effect("rejects imported Effect and ManagedRuntime runners", () =>
    Effect.gen(function* () {
      const sources = [
        'import { Effect } from "effect";\nEffect.runPromise(program);',
        'import { Effect } from "effect";\nEffect["runSync"](program);',
        'import * as Runtime from "effect";\nRuntime.Effect.runFork(program);',
        'import * as Runtime from "effect";\nRuntime["Effect"].runPromise(program);',
        'import { Effect } from "effect";\nconst Runtime = Effect;\nRuntime[key](program);',
        'import { runPromise as execute } from "effect/Effect";\nexecute(program);',
        'import { ManagedRuntime } from "effect";\nconst runtime = ManagedRuntime.make(layer);\nruntime.runSync(program);',
        'import { make } from "effect/ManagedRuntime";\nconst runtime = make(layer);\nruntime.runPromise(program);',
        'import { make as buildRuntime } from "effect/ManagedRuntime";\nconst runtime = buildRuntime(layer);\nruntime.runPromise(program);',
        'const Runtime = await import("effect");\nRuntime.Effect.runFork(program);',
        'const { make: buildRuntime } = await import("effect/ManagedRuntime");\nconst runtime = buildRuntime(layer);\nruntime.runPromise(program);',
      ];
      assert.deepStrictEqual(
        yield* inspect(sources),
        sources.map((_, index) => violation(index))
      );
    })
  );

  it.effect("rejects destructuring that can expose a runner", () =>
    Effect.gen(function* () {
      const sources = [
        'import { Effect } from "effect";\nconst { runPromise } = Effect;',
        'import { Effect } from "effect";\nconst { "runSync": run } = Effect;',
        'import { Effect } from "effect";\nconst { [key]: run } = Effect;',
        'import { Effect } from "effect";\nconst { succeed, ...rest } = Effect;',
        'import { ManagedRuntime } from "effect";\nconst runtime = ManagedRuntime.make(layer);\nconst { runFork } = runtime;',
      ];
      assert.deepStrictEqual(
        yield* inspect(sources),
        sources.map((_, index) => violation(index))
      );
    })
  );

  it.effect("resolves runtime aliases by lexical binding", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect([
          'import { Effect } from "effect";\nconst runtime = client;\n{\n  const runtime = Effect;\n  runtime.runPromise(program);\n}',
          'import { Effect } from "effect";\nconst runtime = Effect;\n{\n  const runtime = client;\n  runtime.runPromise(program);\n}',
        ]),
        [violation(0)]
      );
    })
  );

  it.effect("allows native tests, types, and unrelated bindings", () =>
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
        'const { Effect: { succeed } } = await import("effect");\nsucceed(1);',
        'import { Effect } from "effect";\nlet pending;\nconst [first] = values;\nEffect.succeed([pending, first]);',
      ];
      assert.deepStrictEqual(yield* inspect(sources), []);
    })
  );

  it.effect("recognizes only statically named Effect modules", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect([
          "const Runtime = await import(runtimeModule);\nRuntime.Effect.runPromise(program);",
          "import { Effect } from runtimeModule;\nEffect.runPromise(program);",
        ]),
        []
      );
    })
  );
});
