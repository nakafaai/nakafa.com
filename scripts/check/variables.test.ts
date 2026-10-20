import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect, Order, Result } from "effect";
import { isIdentifier, type Node } from "typescript/unstable/ast";
import { descendants, parseSources } from "#scripts/check/source";
import { isVariable, variableValues } from "#scripts/check/variables";

const VIEW = "apps/www/src/components/example.tsx";
const NAME = "ON";
const BY_POSITION = Order.mapInput(
  Order.Number,
  ({ node }: { readonly node: Node }) => node.pos
);

/** Joins the lines of one module. */
function lines(...rows: readonly string[]) {
  return Arr.join(rows, "\n");
}

/**
 * Parses one module and resolves every identifier named `ON` in it, whether it
 * declares, reads, or writes the name. Returns each declaration they reach
 * once, in the order the module declares them.
 */
const resolve = Effect.fn("VariablesTest.resolve")(function* (
  sourceText: string
) {
  const { declare, modules } = yield* parseSources([
    { file: VIEW, sourceText },
  ]);
  const references = Arr.flatMap(modules, (module) =>
    Arr.filterMap(descendants(module.sourceFile), (node) =>
      isIdentifier(node) && node.text === NAME
        ? Result.succeed({ module, reference: node })
        : Result.failVoid
    )
  );
  const nodes = yield* declare(
    Arr.map(references, ({ reference }) => reference)
  );
  const declarations = Arr.filterMap(
    Arr.zip(references, nodes),
    ([{ module }, node]) =>
      node === undefined
        ? Result.failVoid
        : Result.succeed({ module, name: NAME, node })
  );
  return {
    declarations: Arr.sort(
      Arr.dedupeWith(
        declarations,
        (left, right) => left.node.pos === right.node.pos
      ),
      BY_POSITION
    ),
    declare,
  };
});

/** Tells whether each declaration that `ON` reaches in a module is a variable. */
const kinds = Effect.fn("VariablesTest.kinds")(function* (sourceText: string) {
  const { declarations } = yield* resolve(sourceText);
  return Arr.map(declarations, ({ node }) => isVariable(node));
}, Effect.scoped);

/** Returns the text of every value a module gives each variable named `ON`. */
const given = Effect.fn("VariablesTest.given")(function* (sourceText: string) {
  const { declarations, declare } = yield* resolve(sourceText);
  const variables = Arr.filterMap(declarations, ({ module, name, node }) =>
    isVariable(node) ? Result.succeed({ module, name, node }) : Result.failVoid
  );
  const values = yield* variableValues(declare, variables);
  return Arr.zipWith(variables, values, ({ module }, row) =>
    Arr.map(row, (value) => value.getText(module.sourceFile))
  );
}, Effect.scoped);

describe("declarations that are variables", () => {
  it.effect.each([
    { declaration: "const ON = 1;", variable: true },
    { declaration: "let ON;", variable: true },
    { declaration: "var ON = 1;", variable: true },
    { declaration: "const { ON } = source;", variable: true },
    { declaration: "const [ON] = source;", variable: true },
    { declaration: "const { card: [{ ON }] } = source;", variable: true },
    { declaration: "for (const ON of source) {}", variable: true },
    { declaration: "for (const { ON } of source) {}", variable: true },
    { declaration: "try {} catch (ON) {}", variable: true },
    { declaration: "function run(ON) {}", variable: false },
    { declaration: "const run = (ON) => ON;", variable: false },
    { declaration: "function run({ ON }) {}", variable: false },
    { declaration: "function run([{ card: [ON] }]) {}", variable: false },
    { declaration: "function ON() {}", variable: false },
    { declaration: "class ON {}", variable: false },
  ])(
    "tells whether $declaration declares a variable",
    ({ declaration, variable }) =>
      Effect.gen(function* () {
        assert.deepStrictEqual(yield* kinds(declaration), [variable]);
      })
  );
});

describe("values given to a variable", () => {
  it.effect.each([
    {
      form: "a variable with an initializer",
      sourceText: 'const ON = "flex";',
      values: [['"flex"']],
    },
    {
      form: "a variable without an initializer",
      sourceText: "let ON: string;",
      values: [[]],
    },
    {
      form: "a name taken out of an object pattern",
      sourceText: "const { ON } = SIZES;",
      values: [["SIZES"]],
    },
    {
      form: "a renamed name",
      sourceText: "const { sm: ON } = SIZES;",
      values: [["SIZES"]],
    },
    {
      form: "a name in a nested pattern",
      sourceText: "const { card: { ON } } = SIZES;",
      values: [["SIZES"]],
    },
    {
      form: "a name taken out of an array pattern",
      sourceText: "const [ON] = LIST;",
      values: [["LIST"]],
    },
    {
      form: "a name with a default",
      sourceText: 'const { ON = "flex" } = options;',
      values: [["options", '"flex"']],
    },
    {
      form: "a name with defaults in nested patterns",
      sourceText: 'const { card: { ON = "font-medium" } = {} } = options;',
      values: [["options", "{}", '"font-medium"']],
    },
    {
      form: "a loop variable",
      sourceText: "for (const ON of items) {}",
      values: [[]],
    },
    {
      form: "a name with a default in a loop pattern",
      sourceText: 'for (const { ON = "flex" } of items) {}',
      values: [['"flex"']],
    },
  ])("lists the values given to $form", ({ sourceText, values }) =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* given(sourceText), values);
    })
  );

  it.effect.each([
    {
      form: "a variable that has no initializer",
      sourceText: lines("let ON: string;", 'ON = "flex";'),
      values: [['"flex"']],
    },
    {
      form: "a variable that is assigned twice",
      sourceText: lines('let ON = "";', 'ON = "a";', 'ON += "b";'),
      values: [['""', '"a"', '"b"']],
    },
    {
      form: "a variable that a function assigns",
      sourceText: lines('let ON = "";', "function set() {", '  ON = "a";', "}"),
      values: [['""', '"a"']],
    },
    {
      form: "a loop variable that is assigned",
      sourceText: lines("for (let { ON } of items) {", '  ON = "a";', "}"),
      values: [['"a"']],
    },
    {
      form: "a name that an array pattern writes",
      sourceText: lines("let ON: string;", "[ON] = LIST;"),
      values: [["LIST"]],
    },
    {
      form: "a name that an object pattern writes",
      sourceText: lines("let ON: string;", "({ ON } = SOURCE);"),
      values: [["SOURCE"]],
    },
    {
      form: "a renamed name that an object pattern writes",
      sourceText: lines("let ON: string;", "({ card: ON } = SOURCE);"),
      values: [["SOURCE"]],
    },
    {
      form: "a name that a pattern writes with a default",
      sourceText: lines("let ON: string;", '({ ON = "flex" } = SOURCE);'),
      values: [["SOURCE", '"flex"']],
    },
    {
      form: "a variable that a member write starts from",
      sourceText: lines("const ON = {};", 'ON.card = "flex";'),
      values: [["{}", '"flex"']],
    },
    {
      form: "a variable that a loop head writes",
      sourceText: lines(
        "let ON: string;",
        "for (ON of ITEMS) {}",
        "for (ON in ITEMS) {}",
        "for ([ON] of ITEMS) {}"
      ),
      values: [[]],
    },
  ])("lists the values given to $form", ({ sourceText, values }) =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* given(sourceText), values);
    })
  );
});

describe("assignments to a name that another scope declares", () => {
  it.effect("gives the outer variable what is written to it", () =>
    Effect.gen(function* () {
      const values = yield* given(
        lines(
          'let ON = cn("p-1");',
          'ON = "flex";',
          "function inner() {",
          '  let ON = cn("m-1");',
          "  return ON;",
          "}"
        )
      );
      assert.deepStrictEqual(values, [['cn("p-1")', '"flex"'], ['cn("m-1")']]);
    })
  );

  it.effect("gives the inner variable what is written to it", () =>
    Effect.gen(function* () {
      const values = yield* given(
        lines(
          'let ON = cn("p-1");',
          "function inner() {",
          '  let ON = cn("m-1");',
          '  ON = "flex";',
          "  return ON;",
          "}"
        )
      );
      assert.deepStrictEqual(values, [['cn("p-1")'], ['cn("m-1")', '"flex"']]);
    })
  );

  it.effect.each([
    {
      form: "the outer variable",
      sourceText: lines(
        'let ON = cn("p-1");',
        "({ ON } = SOURCE);",
        "function inner() {",
        '  let ON = cn("m-1");',
        "  return ON;",
        "}"
      ),
      values: [['cn("p-1")', "SOURCE"], ['cn("m-1")']],
    },
    {
      form: "the inner variable",
      sourceText: lines(
        'let ON = cn("p-1");',
        "function inner() {",
        '  let ON = cn("m-1");',
        "  ({ ON } = SOURCE);",
        "  return ON;",
        "}"
      ),
      values: [['cn("p-1")'], ['cn("m-1")', "SOURCE"]],
    },
  ])("gives $form what a pattern writes to it", ({ sourceText, values }) =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* given(sourceText), values);
    })
  );

  it.effect("ignores a write to a name that no declaration owns", () =>
    Effect.gen(function* () {
      const values = yield* given(
        lines(
          "function inner() {",
          '  let ON = cn("m-1");',
          "  return ON;",
          "}",
          "function outer() {",
          '  ON = "flex";',
          "}"
        )
      );
      assert.deepStrictEqual(values, [['cn("m-1")']]);
    })
  );
});
