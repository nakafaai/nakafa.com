import { assert, describe, it } from "@effect/vitest";
import { effectTestViolations } from "#scripts/check/effect";

const FILE = "packages/example/src/program.test.ts";
const VIOLATION =
  "packages/example/src/program.test.ts: return the Effect to @effect/vitest instead of running it.";

describe("Effect test policy", () => {
  it("rejects imported Effect and ManagedRuntime runners", () => {
    for (const source of [
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
    ]) {
      assert.deepStrictEqual(effectTestViolations(FILE, source), [VIOLATION]);
    }
  });

  it("rejects runners exposed through runtime destructuring", () => {
    for (const source of [
      'import { Effect } from "effect";\nconst { runPromise } = Effect;',
      'import { ManagedRuntime } from "effect";\nconst runtime = ManagedRuntime.make(layer);\nconst { runFork } = runtime;',
    ]) {
      assert.deepStrictEqual(effectTestViolations(FILE, source), [VIOLATION]);
    }
  });

  it("resolves runtime aliases by lexical binding", () => {
    assert.deepStrictEqual(
      effectTestViolations(
        FILE,
        'import { Effect } from "effect";\nconst runtime = client;\n{\n  const runtime = Effect;\n  runtime.runPromise(program);\n}'
      ),
      [VIOLATION]
    );
    assert.deepStrictEqual(
      effectTestViolations(
        FILE,
        'import { Effect } from "effect";\nconst runtime = Effect;\n{\n  const runtime = client;\n  runtime.runPromise(program);\n}'
      ),
      []
    );
  });

  it("allows native tests, types, and unrelated method names", () => {
    for (const source of [
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
    ]) {
      assert.deepStrictEqual(effectTestViolations(FILE, source), []);
    }
    assert.deepStrictEqual(
      effectTestViolations(
        "packages/example/src/program.ts",
        'import { Effect } from "effect";\nEffect.runSync(program);'
      ),
      []
    );
  });
});
