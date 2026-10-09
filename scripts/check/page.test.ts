import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect, HashSet, Order } from "effect";
import {
  type Identifier,
  isIdentifier,
  type Node,
  type SourceFile,
} from "typescript/unstable/ast";
import { outsidePage, pageFunctionKeys } from "#scripts/check/page";
import {
  descendants,
  parseSources,
  type RepositorySource,
} from "#scripts/check/source";

/** The platform globals whose uses the Effect-native rules replace. */
const GLOBALS = HashSet.make("Array", "Object");

/** Returns the one-based line where a node starts. */
function lineOf(sourceFile: SourceFile, node: Node) {
  return (
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
  );
}

/** Lists the function keys that the modules among `sources` pass to the browser page, sorted. */
const passedKeys = Effect.fn("PageTest.passedKeys")(function* (
  sources: readonly (typeof RepositorySource.Type)[]
) {
  const { modules } = yield* parseSources(sources);
  return Arr.sort(
    Arr.flatMap(modules, ({ file, sourceFile }) =>
      pageFunctionKeys(file, sourceFile, descendants(sourceFile))
    ),
    Order.String
  );
}, Effect.scoped);

/**
 * Lists the `Array` and `Object` globals that the module at `target` runs
 * outside the browser page, as `line name`, in source order. Functions that any module in
 * `sources` passes to the page by name are keyed across all of them.
 */
const outsideGlobals = Effect.fn("PageTest.outsideGlobals")(function* (
  sources: readonly (typeof RepositorySource.Type)[],
  target: string
) {
  const { modules } = yield* parseSources(sources);
  const keys = HashSet.fromIterable(
    Arr.flatMap(modules, ({ file, sourceFile }) =>
      pageFunctionKeys(file, sourceFile, descendants(sourceFile))
    )
  );
  return Arr.flatMap(modules, ({ file, sourceFile }) => {
    if (file !== target) {
      return [];
    }
    const globals = Arr.filter(
      outsidePage(file, sourceFile, descendants(sourceFile), keys),
      (node): node is Identifier =>
        isIdentifier(node) && HashSet.has(GLOBALS, node.text)
    );
    return Arr.map(
      Arr.sort(
        globals,
        Order.mapInput(Order.Number, (node: Node) => node.getStart(sourceFile))
      ),
      (node) => `${lineOf(sourceFile, node)} ${node.text}`
    );
  });
}, Effect.scoped);

/** The same page calls, without the Playwright import that makes them Playwright calls. */
const PAGE_CALLS = `page.evaluate(() => Object.keys(window.localStorage));
page.addInitScript(function () {
  const read = () => Object.values(window.state);
  return Array.isArray(read());
});
links.evaluateAll((nodes) => Object.entries(nodes));
page.$eval("main", (node) => Object.keys(node.dataset));
page.waitForFunction((limit) => Object.keys(window.state).length > limit, 1);
Object.keys(routes);
run(() => Object.keys(routes));
evaluate(() => Object.keys(routes));
page.locator(() => Object.keys(routes));
Array.from(routes);
`;

/** A helper module that exports functions Playwright modules may pass to the page. */
const SHARED_FUNCTIONS = `export function countShared() {
  return Object.keys(window.frames);
}
export function nodeHelper() {
  return Object.keys(routes);
}
export function upShared() {
  return Array.isArray(window.frames);
}
export const dotShared = () => Object.values(window.frames);
`;

describe("browser page functions", () => {
  it.effect(
    "keys the functions a Playwright module passes to the page by reference",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* passedKeys([
            {
              file: "apps/www/e2e/named.browser.ts",
              sourceText: `import { test } from "@playwright/test";
import { countShared as count } from "@/e2e/support/frames";
import { upShared } from "../e2e/./support/frames";
import { external } from "some-package";
import fallback from "./support/frames";
import * as everything from "./support/frames";
import "./setup";
function countFrames() {}
page.addInitScript(count);
page.evaluate(upShared);
page.evaluate(countFrames);
page.evaluate(external);
page.evaluate(() => 1);
page.$eval("main", countMain);
`,
            },
            {
              file: "apps/www/lib/page.ts",
              sourceText: "page.evaluate(countFrames);\n",
            },
          ]),
          [
            "apps/www/e2e/named.browser#countFrames",
            "apps/www/e2e/named.browser#countMain",
            "apps/www/e2e/support/frames#countShared",
            "apps/www/e2e/support/frames#upShared",
          ]
        );
      })
  );

  it.effect(
    "leaves inline page functions outside the runtime only in a Playwright module",
    () =>
      Effect.gen(function* () {
        const e2e = `import { test } from "@playwright/test";\n${PAGE_CALLS}`;
        assert.deepStrictEqual(
          yield* outsideGlobals(
            [{ file: "apps/www/e2e/page.browser.ts", sourceText: e2e }],
            "apps/www/e2e/page.browser.ts"
          ),
          ["10 Object", "11 Object", "12 Object", "13 Object", "14 Array"]
        );
        assert.deepStrictEqual(
          yield* outsideGlobals(
            [{ file: "apps/www/lib/page.ts", sourceText: PAGE_CALLS }],
            "apps/www/lib/page.ts"
          ),
          [
            "1 Object",
            "3 Object",
            "4 Array",
            "6 Object",
            "7 Object",
            "8 Object",
            "9 Object",
            "10 Object",
            "11 Object",
            "12 Object",
            "13 Array",
          ]
        );
      })
  );

  it.effect(
    "leaves a declared function alone only when a Playwright module passes it by name",
    () =>
      Effect.gen(function* () {
        const sources = [
          {
            file: "apps/www/e2e/named.browser.ts",
            sourceText: `import { test } from "@playwright/test";
import { countShared as count } from "@/e2e/support/frames";
import { upShared } from "../e2e/./support/frames";
function countFrames() {
  return Object.keys(window.frames);
}
page.addInitScript(count);
page.evaluate(upShared);
page.evaluate(countFrames);
Object.keys(routes);
`,
          },
          {
            file: "apps/www/e2e/support/frames.ts",
            sourceText: SHARED_FUNCTIONS,
          },
          { file: "apps/www/lib/frames.ts", sourceText: SHARED_FUNCTIONS },
        ];
        assert.deepStrictEqual(
          yield* outsideGlobals(sources, "apps/www/e2e/named.browser.ts"),
          ["10 Object"]
        );
        assert.deepStrictEqual(
          yield* outsideGlobals(sources, "apps/www/e2e/support/frames.ts"),
          ["5 Object", "10 Object"]
        );
        assert.deepStrictEqual(
          yield* outsideGlobals(sources, "apps/www/lib/frames.ts"),
          ["2 Object", "5 Object", "8 Array", "10 Object"]
        );
      })
  );
});
