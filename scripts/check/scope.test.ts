import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect, Order } from "effect";
import {
  type Identifier,
  isCallExpression,
  isIdentifier,
  type Node,
  type SourceFile,
} from "typescript/unstable/ast";
import { boundFunctions } from "#scripts/check/scope";
import { descendants, parseSources } from "#scripts/check/source";

/** Returns the one-based line where a node starts. */
function lineOf(sourceFile: SourceFile, node: Node) {
  return (
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
  );
}

/**
 * Lists, for each reference to `name` that is an argument of a call in the
 * module, in source order, the lines of the functions that the reference binds.
 */
const boundLines = Effect.fn("ScopeTest.boundLines")(function* (
  sourceText: string,
  name: string
) {
  const { modules } = yield* parseSources([
    { file: "scripts/example.ts", sourceText },
  ]);
  const [{ sourceFile }] = modules;
  const references = Arr.sort(
    Arr.filter(
      descendants(sourceFile),
      (node): node is Identifier =>
        isIdentifier(node) &&
        node.text === name &&
        isCallExpression(node.parent)
    ),
    Order.mapInput(Order.Number, (node: Node) => node.getStart(sourceFile))
  );
  return Arr.map(references, (reference) =>
    Arr.map(boundFunctions(reference), (declaration) =>
      lineOf(sourceFile, declaration)
    )
  );
}, Effect.scoped);

describe("lexical function bindings", () => {
  it.effect("binds a reference to the function of the module scope", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* boundLines(
          `function handler() {}
export function build() {
  return use(handler);
}
`,
          "handler"
        ),
        [[1]]
      );
    })
  );

  it.effect("lets a nested declaration shadow an outer function", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* boundLines(
          `function handler() {}
export function build() {
  const handler = async () => {};
  return use(handler);
}
`,
          "handler"
        ),
        [[3]]
      );
    })
  );

  it.effect("binds a function expression held by a nested variable", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* boundLines(
          `export const build = () => {
  const handler = function () {};
  return use(handler);
};
`,
          "handler"
        ),
        [[2]]
      );
    })
  );

  it.effect("binds a function expression's own name inside its body", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* boundLines(
          `function handler() {}
export const build = () => {
  return function handler(step) {
    return use(handler);
  };
};
`,
          "handler"
        ),
        [[3]]
      );
      assert.deepStrictEqual(
        yield* boundLines(
          `function handler() {}
export const build = () => function handler(handler) {
  return use(handler);
};
`,
          "handler"
        ),
        [[]]
      );
    })
  );

  it.effect("stops at a class expression's own name inside its body", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* boundLines(
          `function handler() {}
export const Build = class handler {
  run() {
    return use(handler);
  }
};
`,
          "handler"
        ),
        [[]]
      );
    })
  );

  it.effect("passes through anonymous function and class expressions", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* boundLines(
          `function handler() {}
export const build = function () {
  return use(handler);
};
`,
          "handler"
        ),
        [[1]]
      );
      assert.deepStrictEqual(
        yield* boundLines(
          `function handler() {}
export const Build = class {
  run() {
    return use(handler);
  }
};
`,
          "handler"
        ),
        [[1]]
      );
    })
  );

  it.effect("binds a hoisted function declaration of the same block", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* boundLines(
          `export function build() {
  return use(handler);
  function handler() {}
}
`,
          "handler"
        ),
        [[3]]
      );
    })
  );

  it.effect("stops at a parameter that shadows an outer function", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* boundLines(
          `function handler() {}
export const build = (handler) => use(handler);
`,
          "handler"
        ),
        [[]]
      );
    })
  );

  it.effect("stops at a destructured name that shadows an outer function", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* boundLines(
          `function handler() {}
export function build(source) {
  const { handler } = source;
  return use(handler);
}
`,
          "handler"
        ),
        [[]]
      );
    })
  );

  it.effect("stops at a loop head or a catch clause that shadows", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* boundLines(
          `function handler() {}
export function build(list) {
  for (const handler of list) {
    use(handler);
  }
}
`,
          "handler"
        ),
        [[]]
      );
      assert.deepStrictEqual(
        yield* boundLines(
          `function handler() {}
try {
  run();
} catch (handler) {
  use(handler);
}
`,
          "handler"
        ),
        [[]]
      );
    })
  );

  it.effect("ends a nested declaration at the close of its block", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* boundLines(
          `function handler() {}
export function build() {
  {
    const handler = () => {};
    use(handler);
  }
  return use(handler);
}
`,
          "handler"
        ),
        [[4], [1]]
      );
    })
  );

  it.effect("stops at a class that shadows an outer function", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* boundLines(
          `function handler() {}
export function build() {
  class handler {}
  return use(handler);
}
`,
          "handler"
        ),
        [[]]
      );
    })
  );

  it.effect("binds no function to a variable that a call initializes", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* boundLines(
          `const handler = wrap(() => {});
export const value = use(handler);
`,
          "handler"
        ),
        [[]]
      );
    })
  );

  it.effect("binds no function to a name that no scope declares", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* boundLines("export const value = use(missing);\n", "missing"),
        [[]]
      );
    })
  );

  it.effect("binds a case clause declaration to the clauses after it", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* boundLines(
          `export function build(kind) {
  switch (kind) {
    case 1:
      const handler = () => {};
      break;
    default:
      use(handler);
  }
}
`,
          "handler"
        ),
        [[4]]
      );
    })
  );

  it.effect("skips a loop head that assigns instead of declaring", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* boundLines(
          `function handler() {}
export function build(list) {
  for (handler of list) {
    use(handler);
  }
}
`,
          "handler"
        ),
        [[1]]
      );
    })
  );

  it.effect("skips a catch clause that binds another name", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* boundLines(
          `function handler() {}
try {
  run();
} catch (error) {
  use(handler);
}
`,
          "handler"
        ),
        [[1]]
      );
    })
  );

  it.effect("binds no function to a name without a function value", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* boundLines(
          `function handler() {}
export function build(other) {
  let handler;
  return use(handler);
}
`,
          "handler"
        ),
        [[]]
      );
      assert.deepStrictEqual(
        yield* boundLines(
          `export const build = (other) => {
  const handler = other;
  return use(handler);
};
`,
          "handler"
        ),
        [[]]
      );
    })
  );

  it.effect("binds a function that a variable holds through each wrapper", () =>
    Effect.gen(function* () {
      const source = `export function build() {
  const parenthesized = (() => {});
  const asserted = (() => {}) as Handler;
  const satisfied = (() => {}) satisfies Handler;
  const negated = (() => {})!;
  use(parenthesized);
  use(asserted);
  use(satisfied);
  use(negated);
}
`;
      assert.deepStrictEqual(yield* boundLines(source, "parenthesized"), [[2]]);
      assert.deepStrictEqual(yield* boundLines(source, "asserted"), [[3]]);
      assert.deepStrictEqual(yield* boundLines(source, "satisfied"), [[4]]);
      assert.deepStrictEqual(yield* boundLines(source, "negated"), [[5]]);
    })
  );

  it.effect("binds a name inside an array destructuring pattern", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* boundLines(
          `function handler() {}
export function build(list) {
  const [, handler] = list;
  return use(handler);
}
`,
          "handler"
        ),
        [[]]
      );
    })
  );
});
