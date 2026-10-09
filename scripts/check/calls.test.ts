import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect, Order } from "effect";
import { arrayCall } from "#scripts/check/calls";
import { descendants, parseSources } from "#scripts/check/source";

/**
 * Lists the array method calls of one module as `line rule receiver`. A call
 * counts by its method name alone, so the receiver's type is judged later.
 */
const calls = Effect.fn("CallsTest.calls")(function* (sourceText: string) {
  const parsed = yield* parseSources([
    { file: "scripts/calls.ts", sourceText },
  ]);
  const [{ sourceFile }] = parsed.modules;
  return Arr.sort(
    Arr.map(
      Arr.filterMap(descendants(sourceFile), arrayCall),
      ({ node, receiver, rule }) =>
        `${sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1} ${rule} ${sourceFile.text.slice(receiver.getStart(sourceFile), receiver.end)}`
    ),
    Order.String
  );
}, Effect.scoped);

describe("array method calls", () => {
  it.effect("recognizes a call by the array method its property names", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* calls(`items.map(String);
items.push(2);
items.find(Boolean);
items.join(", ");
items.join();
items.join(",", extra);
items.slice(1);
`),
        [
          "1 array-method items",
          "2 array-mutation items",
          "3 array-search items",
          "4 array-method items",
          "5 array-method items",
          "6 array-method items",
          "7 array-method items",
        ]
      );
    })
  );

  it.effect(
    "recognizes the array methods that Effect replaces by the rule each breaks",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* calls(`items.at(-1);
items.indexOf(value);
items.lastIndexOf(value);
items.includes(value);
items.concat(more);
items.entries();
`),
          [
            "1 array-search items",
            "2 array-search items",
            "3 array-search items",
            "4 array-method items",
            "5 array-method items",
            "6 array-method items",
          ]
        );
      })
  );

  it.effect("recognizes an element access written with a string literal", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* calls(`items["map"](String);
items[name](String);
`),
        ["1 array-method items"]
      );
    })
  );

  it.effect("sees a method through parentheses around its callee", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* calls(`(items.map)(String);
(items["filter"])(Boolean);
`),
        ["1 array-method items", "2 array-method items"]
      );
    })
  );

  it.effect("sees a method through each wrapper around its callee", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* calls(`(items.map as typeof items.map)(String);
(items.filter satisfies unknown)(Boolean);
items.push!(2);
`),
        [
          "1 array-method items",
          "2 array-method items",
          "3 array-mutation items",
        ]
      );
    })
  );

  it.effect(
    "recognizes a method on a call result and a namespace receiver",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* calls(`make().filter(Boolean);
Arr.sort(items, order);
run();
`),
          ["1 array-method make()", "2 array-mutation Arr"]
        );
      })
  );
});
