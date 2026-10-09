import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { effectFindings } from "#scripts/check/effect";
import { parseSources, type RepositorySource } from "#scripts/check/source";

/** Lists the Effect-native findings of sources as `file:line rule`. */
const findings = Effect.fn("KindPolicyTest.findings")(function* (
  sources: readonly (typeof RepositorySource.Type)[]
) {
  const found = yield* effectFindings(yield* parseSources(sources));
  return Arr.map(found, ({ file, line, rule }) => `${file}:${line} ${rule}`);
}, Effect.scoped);

/** A timer and a throw, which a React module may keep and a plain module may not. */
const BODY = `export const hide = () => setTimeout(close, 1);
export const read = () => { throw new Error("hook"); };
`;

describe("React client modules", () => {
  it.effect(
    "treats a module that opens with the use client directive as a React module",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings([
            {
              file: "apps/www/lib/double.ts",
              sourceText: `"use client";\n${BODY}`,
            },
            {
              file: "apps/www/lib/single.ts",
              sourceText: `'use client';\n${BODY}`,
            },
            { file: "apps/www/lib/plain.ts", sourceText: BODY },
          ]),
          ["apps/www/lib/plain.ts:1 timer", "apps/www/lib/plain.ts:2 throw"]
        );
      })
  );

  it.effect(
    "reads the directive only as the first statement, as a string",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings([
            {
              file: "apps/www/lib/after.ts",
              sourceText: `import { hook } from "./hook";\n"use client";\n${BODY}`,
            },
            {
              file: "apps/www/lib/parenthesized.ts",
              sourceText: `("use client");\n${BODY}`,
            },
            {
              file: "apps/www/lib/template.ts",
              sourceText: `\`use client\`;\n${BODY}`,
            },
          ]),
          [
            "apps/www/lib/after.ts:3 timer",
            "apps/www/lib/after.ts:4 throw",
            "apps/www/lib/parenthesized.ts:2 timer",
            "apps/www/lib/parenthesized.ts:3 throw",
            "apps/www/lib/template.ts:2 timer",
            "apps/www/lib/template.ts:3 throw",
          ]
        );
      })
  );
});
