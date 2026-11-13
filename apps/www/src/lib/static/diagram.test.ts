// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type { ContentTreeChild } from "@nakafa/aksara-contracts/tree";
import { Array as Arr, Effect } from "effect";
import { checkDiagrams, readCharts } from "@/lib/static/diagram";

/** The chart of the lesson that once failed in production, as Aksara signed it. */
const SHIFTING = `flowchart LR
  A["C with E(C) = 28"] -->|"times 1.8"| B["1.8C with E = 50.4"]
  B -->|"plus 32"| C["F = 1.8C + 32 with E(F) = 82.4"]`;

/** How long a test that loads Mermaid may take: the first parse loads Mermaid and jsdom. */
const LOAD_TIMEOUT = 60_000;

/** One element of a content tree. */
function element(
  name: string,
  props: Record<string, string | number>,
  children: readonly ContentTreeChild[] = []
): ContentTreeChild {
  return { $node: "element", children, name, props };
}

describe("diagrams of the release", () => {
  it("lists every Mermaid chart in the order the page draws them", () => {
    const tree = [
      "Intro",
      element("h2", {}, ["Linearity"]),
      element("Mermaid", { chart: SHIFTING, title: "Shift" }),
      element("div", {}, [element("Mermaid", { chart: 1 })]),
    ];

    expect(readCharts(tree)).toEqual([SHIFTING, ""]);
  });

  it.effect(
    "passes every chart Mermaid parses",
    () =>
      checkDiagrams([
        { chart: SHIFTING, page: "/en/subject/high-school/12/mathematics" },
        { chart: 'pie title Share\n  "a": 1', page: "/en/articles/politics" },
      ]),
    // The first parse loads Mermaid and jsdom, which takes seconds in Node.
    LOAD_TIMEOUT
  );

  it.effect(
    "fails the build with the page and Mermaid's words for each chart it cannot parse",
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          checkDiagrams([
            { chart: SHIFTING, page: "/en/a" },
            {
              chart: 'flowchart LR\n  A["C with E("C") = 28"] --> B',
              page: "/en/b",
            },
            { chart: "", page: "/en/c" },
          ])
        );

        expect(error._tag).toBe("DiagramParseError");
        expect(Arr.map(error.failures, ({ page }) => page)).toEqual([
          "/en/b",
          "/en/c",
        ]);
        expect(error.message).toContain("/en/b: Error: Parse error on line 2");
        expect(error.message).toContain("/en/c: UnknownDiagramError");
        expect(Reflect.has(globalThis, "window")).toBe(false);
      }),
    LOAD_TIMEOUT
  );
});
