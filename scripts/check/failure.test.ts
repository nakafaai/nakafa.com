import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { effectFindings } from "#scripts/check/effect";
import { parseSources, type RepositorySource } from "#scripts/check/source";

const CODE = "apps/www/lib/example.ts";

/** Lists the Effect-native findings of one module as `line rule`. */
const findings = Effect.fn("FailurePolicyTest.findings")(function* (
  sourceText: string,
  file = CODE
) {
  const found = yield* effectFindings(
    yield* parseSources([{ file, sourceText }])
  );
  return Arr.map(found, ({ line, rule }) => `${line} ${rule}`);
}, Effect.scoped);

/** Lists the Effect-native findings of several modules as `file:line rule`. */
const fileFindings = Effect.fn("FailurePolicyTest.fileFindings")(function* (
  sources: readonly (typeof RepositorySource.Type)[]
) {
  const found = yield* effectFindings(yield* parseSources(sources));
  return Arr.map(found, ({ file, line, rule }) => `${file}:${line} ${rule}`);
}, Effect.scoped);

describe("throw statements", () => {
  it.effect("reports each throw statement whatever its operand", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`export function read(value: unknown) {
  if (value === undefined) {
    throw new Error("missing");
  }
  throw new TypeError("type");
}
export function rethrow() {
  try {
    run();
  } catch (error) {
    throw error;
  }
}
export function tagged() {
  throw new ParseFailure({ message: "bad" });
}
export function parenthesized() {
  throw (new RangeError("range"));
}
export function other(cause: unknown) {
  throw cause;
}
`),
        [
          "3 throw",
          "5 throw",
          "8 try-catch",
          "11 throw",
          "15 throw",
          "18 throw",
          "21 throw",
        ]
      );
    })
  );

  it.effect(
    "reports a throw in a component, a Next.js file, a test, and a script",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* fileFindings([
            {
              file: "apps/www/components/guard.tsx",
              sourceText:
                'export function useCard() { if (!ready) throw new Error("outside provider"); return ready; }\n',
            },
            {
              file: "apps/www/app/[locale]/page.tsx",
              sourceText:
                'export default function Page() { throw new Error("no page"); }\n',
            },
            {
              file: "apps/www/app/api/route.ts",
              sourceText:
                'export function GET() { throw new Error("no route"); }\n',
            },
            {
              file: "apps/www/lib/read.ts",
              sourceText:
                'export const read = () => { throw new Error("read"); };\n',
            },
            {
              file: "scripts/tool.test.ts",
              sourceText:
                'export const test = () => { throw new Error("test"); };\n',
            },
            {
              file: "scripts/tool.ts",
              sourceText:
                'export const run = () => { throw new Error("fail"); };\n',
            },
          ]),
          [
            "apps/www/app/[locale]/page.tsx:1 throw",
            "apps/www/app/api/route.ts:1 throw",
            "apps/www/components/guard.tsx:1 throw",
            "apps/www/lib/read.ts:1 throw",
            "scripts/tool.test.ts:1 throw",
            "scripts/tool.ts:1 throw",
          ]
        );
      })
  );

  it.effect(
    "never reports Effect failures or text that only spells throw",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`import { Effect } from "effect";
export const failed = Effect.fail(new Error("x"));
export const defect = Effect.die(defectValue);
// throw new Error("comment")
export const message = "throw an error";
export const note = \`throw \${reason}\`;
`),
          []
        );
      })
  );
});
