import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect, Option } from "effect";
import { componentGraph, componentKey } from "#scripts/check/components";
import { parseSources } from "#scripts/check/source";

const PAGE = "apps/www/src/components/page/view.tsx";

/** The graph of some modules, and the place of the component each tag of the page names, or none. */
function graph(sources: Parameters<typeof parseSources>[0]) {
  return Effect.scoped(
    Effect.map(parseSources(sources), ({ modules }) => {
      const { components, resolve } = componentGraph(modules);
      return {
        names: Arr.map(components, componentKey),
        resolved: (tag: string) =>
          Option.getOrUndefined(Option.map(resolve(PAGE, tag), componentKey)),
      };
    })
  );
}

describe("Component graph", () => {
  it.effect("declares the components of the judged modules", () =>
    Effect.gen(function* () {
      const { names } = yield* graph([
        {
          file: PAGE,
          sourceText: `
export function View() { return null; }
export const Row = () => null;
const Cell = function () { return null; };
export default function () { return null; }
const helper = () => null;
const LABEL = "label";
let Later;
export const { Part } = parts;`,
        },
        {
          file: "packages/design-system/components/ui/button.tsx",
          sourceText: "export function Button() { return null; }",
        },
        {
          file: "apps/www/src/components/page/value.ts",
          sourceText: "export function Value() { return null; }",
        },
      ]);
      assert.deepStrictEqual(names, [
        `${PAGE}#View`,
        `${PAGE}#Row`,
        `${PAGE}#Cell`,
      ]);
    })
  );

  it.effect(
    "resolves a tag to the module's own component or to the one it imports",
    () =>
      Effect.gen(function* () {
        const { resolved } = yield* graph([
          {
            file: PAGE,
            sourceText: `import "@/components/page/styles";
import Default from "@/components/page/default";
import * as Parts from "@/components/page/parts";
import { Card } from "@/components/page/card";
import { Frame as Shell } from "./frame";
import { List } from "../shared/list";
import { Badge } from "@repo/design-system/components/badge";
import { Link } from "@tanstack/react-router";
import { Ghost } from "@/components/page/ghost";
const Sheet = lazy(() =>
  import("@/components/page/sheet").then((module) => ({ default: module.Sheet }))
);
const Later = lazy(() => import(path).then((module) => ({ default: module.Later })));
const Plain = lazy(() => import("@/components/page/plain"));
export function View() { return null; }`,
          },
          {
            file: "apps/www/src/components/page/card.tsx",
            sourceText: "export function Card() { return null; }",
          },
          {
            file: "apps/www/src/components/page/frame.tsx",
            sourceText: "export function Frame() { return null; }",
          },
          {
            file: "apps/www/src/components/shared/list.tsx",
            sourceText: "export function List() { return null; }",
          },
          {
            file: "packages/design-system/components/badge.tsx",
            sourceText: "export function Badge() { return null; }",
          },
          {
            file: "apps/www/src/components/page/sheet.tsx",
            sourceText: "export function Sheet() { return null; }",
          },
        ]);
        assert.deepStrictEqual(
          Arr.map(
            [
              "View",
              "Card",
              "Shell",
              "List",
              "Badge",
              "Sheet",
              "Link",
              "Ghost",
              "Default",
              "Later",
              "Plain",
              "Missing",
            ],
            resolved
          ),
          [
            `${PAGE}#View`,
            "apps/www/src/components/page/card.tsx#Card",
            "apps/www/src/components/page/frame.tsx#Frame",
            "apps/www/src/components/shared/list.tsx#List",
            "packages/design-system/components/badge.tsx#Badge",
            "apps/www/src/components/page/sheet.tsx#Sheet",
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
          ]
        );
      })
  );

  it.effect("reads an app alias only from an app's own module", () =>
    Effect.gen(function* () {
      const file = "packages/design-system/components/view.tsx";
      const { components, resolve } = yield* Effect.scoped(
        Effect.map(
          parseSources([
            {
              file,
              sourceText: `import { Card } from "@/components/card";
export function View() { return null; }`,
            },
            {
              file: "packages/design-system/src/components/card.tsx",
              sourceText: "export function Card() { return null; }",
            },
          ]),
          ({ modules }) => componentGraph(modules)
        )
      );
      assert.strictEqual(components.length, 2);
      assert.isTrue(Option.isNone(resolve(file, "Card")));
    })
  );
});
