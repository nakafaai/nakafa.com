import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { effectFindings } from "#scripts/check/effect";
import { parseSources, type RepositorySource } from "#scripts/check/source";

const CODE = "apps/www/lib/example.ts";

/** Lists the Effect-native findings of one module as `line rule`. */
const findings = Effect.fn("AssertionPolicyTest.findings")(function* (
  sourceText: string,
  file = CODE
) {
  const found = yield* effectFindings(
    yield* parseSources([{ file, sourceText }])
  );
  return Arr.map(found, ({ line, rule }) => `${line} ${rule}`);
}, Effect.scoped);

/** Lists the Effect-native findings of several modules as `file:line rule`. */
const fileFindings = Effect.fn("AssertionPolicyTest.fileFindings")(function* (
  sources: readonly (typeof RepositorySource.Type)[]
) {
  const found = yield* effectFindings(yield* parseSources(sources));
  return Arr.map(found, ({ file, line, rule }) => `${file}:${line} ${rule}`);
}, Effect.scoped);

describe("type assertions", () => {
  it.effect("reports each assertion form in a value position", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`export const user = response as User;
export const anything = value as any;
export const nothing = value as never;
export const forced = value as unknown as Target;
export const angle = <User>response;
export const present = value!;
export const checked = value satisfies Shape;
`),
        [
          "1 assertion",
          "2 assertion",
          "3 assertion",
          "4 assertion",
          "4 assertion",
          "5 assertion",
          "6 assertion",
        ]
      );
    })
  );

  it.effect(
    "reports an assertion at the line where its expression starts",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`export const label = value
  .name!;
export const checked = (
  response
) as Shape;
`),
          ["1 assertion", "3 assertion"]
        );
      })
  );

  it.effect("never reports const assertions, aliases, or key remapping", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`import { value as renamed } from "./values";
import * as values from "./values";
export { renamed as exported };
export * as namespace from "./values";
export const palette = ["red", "blue"] as const;
export const literal = <const>"blue";
type Keys<T> = { [K in keyof T as Exclude<K, "hidden">]: T[K] };
`),
        []
      );
    })
  );

  it.effect("never reports a definite assignment declaration", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* findings("let cache!: string;\n"), []);
    })
  );

  it.effect(
    "never reports a satisfies expression, alone or after a const",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(
            'export const shape = ["a"] as const satisfies readonly string[];\nexport const defaults = { mode: "dark" } satisfies Settings;\n'
          ),
          []
        );
      })
  );

  it.effect(
    "reports assertions in tests and components, never in configuration",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* fileFindings([
            {
              file: "apps/www/next.config.ts",
              sourceText: "export default config as NextConfig;\n",
            },
            {
              file: "apps/www/source.config.ts",
              sourceText: "export default {} satisfies NextConfig;\n",
            },
            {
              file: "scripts/tool.test.ts",
              sourceText:
                "export const expected = value!;\nexport const label = value as Label;\n",
            },
            {
              file: "apps/www/components/card.tsx",
              sourceText: "export const node = ref.current!;\n",
            },
          ]),
          [
            "apps/www/components/card.tsx:1 assertion",
            "scripts/tool.test.ts:1 assertion",
            "scripts/tool.test.ts:2 assertion",
          ]
        );
      })
  );
});
