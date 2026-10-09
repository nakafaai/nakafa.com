import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect, Order } from "effect";
import {
  isCallExpression,
  isObjectLiteralExpression,
  isThrowStatement,
  type Node,
  type SourceFile,
} from "typescript/unstable/ast";
import { handlerFunctions, insideHandler } from "#scripts/check/handler";
import { descendants, parseSources } from "#scripts/check/source";

const CODE = "apps/www/lib/example.ts";

/** Returns the one-based line where a node starts. */
function lineOf(sourceFile: SourceFile, node: Node) {
  return (
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
  );
}

/** Returns the handler functions that the options object of each call among `nodes` names. */
function handlersIn(nodes: readonly Node[]) {
  return Arr.flatMap(nodes, (node) => {
    if (!isCallExpression(node)) {
      return [];
    }
    const [options] = node.arguments;
    return options !== undefined && isObjectLiteralExpression(options)
      ? handlerFunctions(options)
      : [];
  });
}

/** Lists the start lines of the handler functions that a module's calls name. */
const handlerLines = Effect.fn("HandlerTest.handlerLines")(function* (
  sourceText: string
) {
  const { modules } = yield* parseSources([{ file: CODE, sourceText }]);
  return Arr.sort(
    Arr.flatMap(modules, ({ sourceFile }) =>
      Arr.map(handlersIn(descendants(sourceFile)), (handler) =>
        lineOf(sourceFile, handler)
      )
    ),
    Order.Number
  );
}, Effect.scoped);

/** Lists each throw statement of a module as `line`, with `inside` or `outside` its handler functions. */
const throwPlacement = Effect.fn("HandlerTest.throwPlacement")(function* (
  sourceText: string
) {
  const { modules } = yield* parseSources([{ file: CODE, sourceText }]);
  return Arr.sort(
    Arr.flatMap(modules, ({ sourceFile }) => {
      const nodes = descendants(sourceFile);
      const handlers = handlersIn(nodes);
      return Arr.flatMap(nodes, (node) =>
        isThrowStatement(node)
          ? [
              `${lineOf(sourceFile, node)} ${insideHandler(node, handlers) ? "inside" : "outside"}`,
            ]
          : []
      );
    }),
    Order.String
  );
}, Effect.scoped);

describe("handler functions", () => {
  it.effect(
    "names the handler of each options object in every spelling of its key",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* handlerLines(`const retry = () => 1;
export const a = build({ handler: (ctx) => ctx });
export const b = build({ handler(ctx) { return ctx; } });
export const c = build({ "handler": (ctx) => ctx });
export const d = build({ ["handler"]: (ctx) => ctx });
export const e = build({ handler: retry });
export const f = build({ retries: 2, handler: retry });
`),
          [1, 1, 2, 3, 4, 5]
        );
      })
  );

  it.effect(
    "names no function for a handler that is neither a function nor a name",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* handlerLines(`export const a = build({ handler: wrap(run) });
export const b = build(options);
export const c = build({ retries: 2 });
`),
          []
        );
      })
  );

  it.effect("places each throw inside or outside the handler it sits in", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* throwPlacement(`export const a = build({
  handler: (ctx) => {
    ctx.run(() => {
      throw new Error("nested");
    });
  },
});
export const b = build({ retries: 2 });
throw new Error("outside");
`),
        ["4 inside", "9 outside"]
      );
    })
  );
});
