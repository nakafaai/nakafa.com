import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { effectFindings } from "#scripts/check/effect";
import { parseSources, type RepositorySource } from "#scripts/check/source";

const CODE = "apps/www/lib/example.ts";

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
              file: "apps/www/components/status.tsx",
              sourceText:
                "export const status = (mode: string) => { switch (mode) { default: return 0; } };\n",
            },
            {
              file: "apps/www/next.config.ts",
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
            "apps/www/components/status.tsx:1 switch",
            "apps/www/next.config.ts:1 switch",
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
