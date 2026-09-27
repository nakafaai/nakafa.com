import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { effectTestViolations } from "#scripts/check/effect";

const file = "packages/backend/example.test.ts";
const imports =
  'import { Effect } from "effect"; import { convexTest, type TestConvex } from "convex-test";';

describe("Convex transaction test boundaries", () => {
  it.effect(
    "accepts only SDK-owned Promise callbacks that consume their context",
    () =>
      Effect.gen(function* () {
        const programs = [
          "const t = convexTest(schema); t.query(ctx => Effect.runPromise(read(ctx)));",
          "const t = convexTest(schema).withIdentity(identity); t.mutation(ctx => Effect.runPromiseWith(services)(write(ctx)));",
          "function setup() { const t = convexTest(schema); return { t }; } const { t } = await setup(); t.action(ctx => Effect.runPromise(read(ctx)));",
          "const setup = () => convexTest(schema); const t = setup(); t.run(ctx => Effect.runPromise(read(ctx)));",
          "type Test = ReturnType<typeof convexTest>; function readTest(t: Test) { return t.query(ctx => Effect.runPromise(read(ctx))); }",
          "function readTest(t: TestConvex<typeof schema>) { return t.query(ctx => Effect.runPromise(read(ctx))); }",
          'import { createPendingUpload } from "@repo/backend/test/forum/upload"; Effect.gen(function* () { const { t } = yield* createPendingUpload(now); return yield* Effect.promise(() => t.action(ctx => Effect.runPromise(read(ctx)))); });',
        ];
        assert.deepStrictEqual(
          yield* effectTestViolations(
            programs.map((source) => ({
              file,
              sourceText: `${imports}\n${source}`,
            }))
          ),
          []
        );
      })
  );

  it.effect(
    "rejects fake clients, shadowed contexts, helpers and non-Promise runners",
    () =>
      Effect.gen(function* () {
        const programs = [
          "const t = fakeClient; t.mutation(ctx => Effect.runPromise(write(ctx)));",
          "const t = convexTest(schema); t.query(ctx => Effect.runPromise(read()));",
          "const t = convexTest(schema); t.query(ctx => { const helper = () => Effect.runPromise(read(ctx)); return helper(); });",
          "const t = convexTest(schema); t.query(ctx => Effect.runSync(read(ctx)));",
          "const t = convexTest(schema); t.query(ctx => Effect.runFork(read(ctx)));",
          "const t = convexTest(schema); Effect.runPromise(read(t));",
          "function setup() { if (flag) return convexTest(schema); return fakeClient; } const t = setup(); t.query(ctx => Effect.runPromise(read(ctx)));",
          "const t = convexTest(schema); t.query(ctx => { const read = (ctx) => Effect.runPromise(program(ctx)); return read(fakeContext); });",
        ];
        const violations = yield* effectTestViolations(
          programs.map((source) => ({
            file,
            sourceText: `${imports}\n${source}`,
          }))
        );
        assert.strictEqual(violations.length, programs.length);
      })
  );
});
