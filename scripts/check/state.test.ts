import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { effectFindings } from "#scripts/check/effect";
import { parseSources } from "#scripts/check/source";

const DOMAIN = "packages/backend/confect/example/cache.ts";

/** Lists the module-state findings of one module as line numbers. */
const stateLines = Effect.fn("StatePolicyTest.stateLines")(function* (
  sourceText: string,
  file = DOMAIN
) {
  const found = yield* effectFindings(
    yield* parseSources([{ file, sourceText }])
  );
  return Arr.map(
    Arr.filter(found, ({ rule }) => rule === "module-state"),
    ({ line }) => line
  );
}, Effect.scoped);

describe("module state", () => {
  it.effect("reports a top-level binding that a later call can see", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* stateLines(`let calls = 0;
var last;
export let current;
export const cache = MutableHashMap.empty();
const seen = MutableRef.make(0), other = 1;
`),
        [1, 2, 3, 4, 5]
      );
    })
  );

  it.effect("accepts constants and state that lives inside one call", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* stateLines(`export const limit = 10;
const answer = compute();
const named = Schema.String.pipe();
const plain = Schema.Struct({});
declare const ambient: number;
export const read = () => {
  let calls = 0;
  const cache = MutableHashMap.empty();
  return { cache, calls };
};
`),
        []
      );
    })
  );

  it.effect("stays out of tests and of code outside the domain folders", () =>
    Effect.gen(function* () {
      const source = "let calls = 0;\n";
      assert.deepStrictEqual(
        yield* stateLines(source, "packages/backend/confect/example.test.ts"),
        []
      );
      assert.deepStrictEqual(
        yield* stateLines(source, "apps/www/src/lib/example.ts"),
        []
      );
    })
  );
});
