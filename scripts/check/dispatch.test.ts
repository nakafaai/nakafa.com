import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { effectFindings } from "#scripts/check/effect";
import { parseSources, type RepositorySource } from "#scripts/check/source";

const CODE = "apps/www/src/lib/example.ts";

/** Lists the Effect-native findings of one module as `line rule`. */
const findings = Effect.fn("DispatchPolicyTest.findings")(function* (
  sourceText: string,
  file = CODE
) {
  const found = yield* effectFindings(
    yield* parseSources([{ file, sourceText }])
  );
  return Arr.map(found, ({ line, rule }) => `${line} ${rule}`);
}, Effect.scoped);

/** Lists the Effect-native findings of several modules as `file:line rule`. */
const fileFindings = Effect.fn("DispatchPolicyTest.fileFindings")(function* (
  sources: readonly (typeof RepositorySource.Type)[]
) {
  const found = yield* effectFindings(yield* parseSources(sources));
  return Arr.map(found, ({ file, line, rule }) => `${file}:${line} ${rule}`);
}, Effect.scoped);

describe("switch statements", () => {
  it.effect("reports each switch statement whatever its discriminant", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`export function label(value: Shape) {
  switch (value._tag) {
    case "a":
      return 1;
    default:
      return 0;
  }
}
export function typed(mode: string) {
  switch (mode) {
    default:
      return 0;
  }
}
export function flagged(ready: boolean) {
  switch (true) {
    default:
      return 0;
  }
}
export function call(value: Shape) {
  switch (kindOf(value)) {
    default:
      return 0;
  }
}
`),
        ["2 switch", "10 switch", "16 switch", "22 switch"]
      );
    })
  );

  it.effect(
    "reports a switch in a React module, a test, and configuration",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* fileFindings([
            {
              file: "apps/www/src/components/status.tsx",
              sourceText:
                "export const status = (mode: string) => { switch (mode) { default: return 0; } };\n",
            },
            {
              file: "apps/www/vite.config.ts",
              sourceText:
                "export const env = (name: string) => { switch (name) { default: return 0; } };\n",
            },
            {
              file: "scripts/tool.test.ts",
              sourceText:
                "export const run = (mode: string) => { switch (mode) { default: return 0; } };\n",
            },
          ]),
          [
            "apps/www/src/components/status.tsx:1 switch",
            "apps/www/vite.config.ts:1 switch",
            "scripts/tool.test.ts:1 switch",
          ]
        );
      })
  );

  it.effect("reports a switch on typeof once, as a switch alone", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`export function read(value: unknown) {
  switch (typeof value) {
    case "object":
      return value;
    default:
      return null;
  }
}
export function text(value: unknown) {
  switch (typeof value) {
    case "string":
      return value;
    default:
      return "";
  }
}
`),
        ["2 switch", "10 switch"]
      );
    })
  );

  it.effect(
    "reports a switch on a parenthesized or asserted typeof result once",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`export function parenthesized(value: unknown) {
  switch ((typeof value)) {
    case "object":
      return value;
    default:
      return null;
  }
}
export function asserted(value: unknown) {
  switch ((typeof value) as string) {
    case "object":
      return value;
    default:
      return null;
  }
}
`),
          ["2 switch", "10 assertion", "10 switch"]
        );
      })
  );

  it.effect("reports a switch on typeof with a parenthesized object case", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`export function read(value: unknown) {
  switch (typeof value) {
    case ("object"):
      return value;
    default:
      return null;
  }
}
`),
        ["2 switch"]
      );
    })
  );

  it.effect("reports a switch inside a browser page function", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(
          `import { type Page } from "@playwright/test";
export function mode(page: Page) {
  return page.evaluate(() => {
    switch (document.title) {
      default:
        return 0;
    }
  });
}
`,
          "apps/www/e2e/support/mode.browser.ts"
        ),
        ["4 switch"]
      );
    })
  );

  it.effect("never reports if chains, lookup tables, Match, or text", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`import { Match } from "effect";
export const label = Match.value(value).pipe(Match.tag("a", () => 1), Match.orElse(() => 0));
export function pick(mode: string) {
  if (mode === "a") {
    return 1;
  } else if (mode === "b") {
    return 2;
  }
  // switch (mode) would be a switch statement
  return "switch (mode)";
}
const labels = { a: 1, b: 2 };
export const picked = labels[mode];
`),
        []
      );
    })
  );
});

describe("if chains over a tag", () => {
  it.effect(
    "reports a chain once, at its first if, through else and through the next statement",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`export function nested(value: Shape) {
  if (value._tag === "a") {
    return 1;
  } else if (value._tag === "b") {
    return 2;
  } else if (value._tag === "c") {
    return 3;
  }
  return 0;
}
export function sibling(value: Shape) {
  if (value._tag === "a") {
    return 1;
  }
  if ("b" !== value._tag) {
    return 2;
  }
  if (value._tag == \`c\`) {
    return 3;
  }
  return 0;
}
export function negated(state: { readonly result: Shape }) {
  if (!(state.result._tag === "a" || state.result._tag === "b")) {
    return 0;
  }
  if ((state.result._tag) != "c") {
    return 1;
  }
  return 2;
}
`),
          ["2 tag-chain", "12 tag-chain", "24 tag-chain"]
        );
      })
  );

  it.effect(
    "reports a chain inside a case clause, a default clause and a namespace",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`namespace Shapes {
  if (value._tag === "a") {
  }
  if (value._tag === "b") {
  }
}
export function cases(value: Shape, kind: string) {
  switch (kind) {
    case "one":
      if (value._tag === "a") {
        return 1;
      }
      if (value._tag === "b") {
        return 2;
      }
      return 0;
    default:
      if (value._tag === "a") {
        return 1;
      }
      if (value._tag === "b") {
        return 2;
      }
      return 0;
  }
}
`),
          ["2 tag-chain", "8 switch", "10 tag-chain", "18 tag-chain"]
        );
      })
  );

  it.effect(
    "leaves one if over a tag, ifs over other subjects or properties, and conditions that are not a tag comparison",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`export function single(value: Shape) {
  if (value._tag === "a") {
    return 1;
  }
  return value.size;
}
export function others(left: Shape, right: Shape) {
  if (left._tag === "a") {
    return 1;
  } else if (right._tag === "a") {
    return 2;
  }
  if (right._tag === "b") {
    return 3;
  }
  if (left.kind === "a") {
    return 4;
  }
  if (left.kind === "b") {
    return 5;
  }
  if (left._tag === "c" && ready) {
    return 6;
  }
  if (left._tag === kind) {
    return 7;
  }
  if (left._tag > "d") {
    return 8;
  }
  if (left["_tag"] === "e") {
    return 9;
  }
  if (ready) {
    return 10;
  }
  return 0;
}
const value = check() ? (() => {
  if (shape._tag === "a") {
    return 1;
  }
  return 0;
})() : 0;
for (const shape of shapes) if (shape._tag === "a") break;
`),
          []
        );
      })
  );
});
