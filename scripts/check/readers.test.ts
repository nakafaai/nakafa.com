import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect, HashSet } from "effect";
import {
  exportReader,
  fileStems,
  namespaceStems,
} from "#scripts/check/readers";
import { parseSources } from "#scripts/check/source";

const CART = "packages/shop/cart.ts";

/**
 * Whether the authored module `sourceText` reads the export `name` of the
 * module at `file`, judged from its own syntax tree.
 */
function reads(
  sourceText: string,
  file = CART,
  name = "total",
  namespaces = HashSet.empty<string>()
) {
  return Effect.scoped(
    Effect.map(
      parseSources([{ file: "packages/shop/checkout.ts", sourceText }]),
      ({ modules }) =>
        Arr.some(modules, ({ sourceFile }) =>
          exportReader(
            sourceFile,
            HashSet.make(name),
            namespaces
          )(fileStems(file), name)
        )
    )
  );
}

describe("Module reads for the export policy", () => {
  it.effect(
    "keeps a name that a module reads through each kind of specifier",
    () =>
      Effect.gen(function* () {
        const readers = [
          'import { total } from "@repo/shop/cart";\nexport const price = total;\n',
          'import { total } from "@/shop/cart";\nexport const price = total;\n',
          'import { total } from "./cart.js";\nexport const price = total;\n',
          'export const load = () => import("./cart").then(({ total }) => total);\n',
          'import * as cart from "./cart";\nexport const price = cart.total;\n',
          'export { total } from "./cart";\n',
          'export type Total = typeof import("./cart").total;\n',
          'const { total } = require("./cart");\nexport const price = total;\n',
          'import cart = require("./cart");\nexport const price = cart.total;\n',
          'vi.mock("./cart", () => ({ total: 2 }));\n',
          'vi.mock(import("./cart"), async () => ({ total: 2 }));\n',
          'vi.doMock("./cart", () => ({ total: 2 }));\n',
        ];
        yield* Effect.forEach(
          readers,
          (reader) =>
            Effect.map(reads(reader), (kept) => assert.isTrue(kept, reader)),
          { discard: true }
        );
      })
  );

  it.effect(
    "keeps a name that a module forwards or loads by a computed path",
    () =>
      Effect.gen(function* () {
        assert.isTrue(yield* reads('export * from "./cart";\n'), "export star");
        assert.isTrue(
          yield* reads('export * as shop from "./cart";\n'),
          "export star as"
        );
        assert.isTrue(
          yield* reads(
            "export const load = (name: string) => import(name).then((module) => module.total);\n"
          ),
          "computed import"
        );
      })
  );

  it.effect("names an index module by its folder and by index", () =>
    Effect.gen(function* () {
      const shop = "packages/shop/index.ts";
      assert.isTrue(
        yield* reads(
          'import { total } from "@repo/shop";\nexport const price = total;\n',
          shop
        )
      );
      assert.isTrue(
        yield* reads(
          'import { total } from "./shop/index";\nexport const price = total;\n',
          shop
        )
      );
      assert.deepStrictEqual(fileStems(shop), ["shop", "index"]);
      assert.deepStrictEqual(fileStems("packages/shop/cart.test.tsx"), [
        "cart.test",
      ]);
    })
  );

  it.effect(
    "does not read a name from another module, another name, or a comment",
    () =>
      Effect.gen(function* () {
        assert.isFalse(
          yield* reads(
            'import { total } from "./price";\nexport const price = total;\n'
          ),
          "another module"
        );
        assert.isFalse(
          yield* reads(
            'import { tax } from "./cart";\nexport const rate = tax;\n'
          ),
          "another name"
        );
        assert.isFalse(
          yield* reads(
            'vi.mock(import("./price"), async () => ({ total: 2 }));\n'
          ),
          "a nested import of another module"
        );
        assert.isFalse(
          yield* reads(
            '// import { total } from "./cart";\n/** Uses {@link total}. */\nexport const price = 1;\n'
          ),
          "a comment"
        );
      })
  );

  it.effect("reads by word a module that a computed import may load", () =>
    Effect.gen(function* () {
      assert.isTrue(
        yield* reads(
          "const total = 2;\nexport default total;\n",
          CART,
          "total",
          HashSet.make("*")
        ),
        "computed namespace"
      );
    })
  );

  it.effect("names the modules that a runtime import loads", () =>
    Effect.gen(function* () {
      const { modules } = yield* parseSources([
        {
          file: "packages/shop/checkout.ts",
          sourceText:
            'export const a = import("./cart");\nexport const b = import(name);\nexport const c = require("./price");\n',
        },
      ]);
      assert.deepStrictEqual(
        Arr.flatMap(modules, ({ sourceFile }) => namespaceStems(sourceFile)),
        ["cart", "*"]
      );
    }).pipe(Effect.scoped)
  );
});
