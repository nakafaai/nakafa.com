import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { effectFindings } from "#scripts/check/effect";
import { parseSources } from "#scripts/check/source";

const CODE = "apps/www/lib/example.ts";

/** Lists the Effect-native findings of one module as `line rule`. */
const findings = Effect.fn("GlobalPolicyTest.findings")(function* (
  sourceText: string,
  file = CODE
) {
  const found = yield* effectFindings(
    yield* parseSources([{ file, sourceText }])
  );
  return Arr.map(found, ({ line, rule }) => `${line} ${rule}`);
}, Effect.scoped);

describe("platform globals", () => {
  it.effect("reports each platform global an Effect module replaces", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`Object.keys(value);
Object.entries(value);
Object.values(value);
Object.fromEntries(value);
Array.isArray(value);
globalThis.Object.keys(value);
window.Array.isArray(value);
self.Object.values(value);
Object["keys"](value);
Array['isArray'](value);
globalThis.Object["values"](value);
globalThis["Object"].entries(value);
(Object).keys(value);
(globalThis.Object).values(value);
Object!.keys(value);
(Array as typeof Array).isArray(value);
(globalThis).Object.keys(value);
(Object satisfies unknown).keys(value);
global.Object.keys(value);
global.Array.isArray(value);
`),
        [
          "1 object-helper",
          "2 object-helper",
          "3 object-helper",
          "4 object-helper",
          "5 array-check",
          "6 object-helper",
          "7 array-check",
          "8 object-helper",
          "9 object-helper",
          "10 array-check",
          "11 object-helper",
          "12 object-helper",
          "13 object-helper",
          "14 object-helper",
          "15 object-helper",
          "16 array-check",
          "17 object-helper",
          "18 object-helper",
          "19 object-helper",
          "20 array-check",
        ]
      );
    })
  );

  it.effect("ignores other members, shadowed names, and lookalikes", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`import { Array as Arr, Record } from "effect";
const Object = Record;
Object.keys(value);
Arr.isArray(value);
Array.from(items);
Array;
Math.max(1, 2);
client.Object.keys(value);
globalThis.Math.max(1, 2);
globalThis.Array.from(items);
globalThis.Array;
Object[name](value);
globalThis[name].keys(value);
globalThis["Math"].max(1, 2);
client["Object"].keys(value);
function read(Array: Source) {
  return Array.isArray(value);
}
`),
        []
      );
    })
  );
});
