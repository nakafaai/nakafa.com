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

  it.effect(
    "follows clients through Effect constructors, fields, and spreads",
    () =>
      Effect.gen(function* () {
        const programs = [
          "Effect.gen(function* () { const t = yield* Effect.sync(() => convexTest(schema)); return yield* Effect.promise(() => t.query(ctx => Effect.runPromise(read(ctx)))); });",
          "Effect.gen(function* () { const t = yield* Effect.promise(async () => { const client = convexTest(schema); return client; }); return yield* Effect.promise(() => t.run(ctx => Effect.runPromise(read(ctx)))); });",
          'const setup = Effect.fn("setup")(function* () { return convexTest(schema); }); Effect.gen(function* () { const t = yield* setup(); return yield* Effect.promise(() => t.mutation(ctx => Effect.runPromise(write(ctx)))); });',
          "const fixture = { t: convexTest(schema) }; fixture.t.query(ctx => Effect.runPromise(read(ctx)));",
          'function setup() { return { t: convexTest(schema) }; } const fixture = { ...setup(), label: "fixture" }; fixture.t.action(ctx => Effect.runPromise(read(ctx)));',
          "function setup() { const reset = () => { return fakeClient; }; return convexTest(schema); } const t = setup(); t.query(ctx => Effect.runPromise(read(ctx)));",
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

  it.effect("rejects clients whose provenance the resolver cannot prove", () =>
    Effect.gen(function* () {
      const programs = [
        "const Local = { sync: (make) => make() }; const t = Local.sync(() => convexTest(schema)); t.query(ctx => Effect.runPromise(read(ctx)));",
        "import { convexTest as makeTest } from convexModule; const t = makeTest(schema); t.query(ctx => Effect.runPromise(read(ctx)));",
        "const { t } = fakeSetup(); t.query(ctx => Effect.runPromise(read(ctx)));",
        "function setup() { return setup(); } const t = setup(); t.query(ctx => Effect.runPromise(read(ctx)));",
        "const t = new FakeClient(); t.query(ctx => Effect.runPromise(read(ctx)));",
        "function readTest({ t }: Fixture) { return t.query(ctx => Effect.runPromise(read(ctx))); }",
        "const t = await Promise.resolve(convexTest(schema)); t.query(ctx => Effect.runPromise(read(ctx)));",
        "const t = fakeClient.withIdentity(identity); t.query(ctx => Effect.runPromise(read(ctx)));",
        "const fixture = { ...unknownFixture }; fixture.t.query(ctx => Effect.runPromise(read(ctx)));",
        'const fixture = { ["t"]: convexTest(schema), u() { return convexTest(schema); } }; fixture.t.query(ctx => Effect.runPromise(read(ctx)));',
        "declare function setup(): TestConvex<typeof schema>; const t = setup(); t.query(ctx => Effect.runPromise(read(ctx)));",
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

  it.effect("rejects runners outside a direct transaction callback", () =>
    Effect.gen(function* () {
      const programs = [
        "const t = convexTest(schema); t.query(ctx => { const run = Effect.runPromise; return run(read(ctx)); });",
        "const t = convexTest(schema); t.mutation(ctx => { const run = Effect.runPromiseWith(services); return run(write(ctx)); });",
        "const t = convexTest(schema); t.query(() => Effect.runPromise(read()));",
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
