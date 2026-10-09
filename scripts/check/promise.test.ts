import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { effectFindings } from "#scripts/check/effect";
import { parseSources, type RepositorySource } from "#scripts/check/source";

const CODE = "apps/www/lib/example.ts";
const SCRIPT = "scripts/tool.ts";

/** Lists the Effect-native findings of one module as `line rule`. */
const findings = Effect.fn("PromisePolicyTest.findings")(function* (
  sourceText: string,
  file = CODE
) {
  const found = yield* effectFindings(
    yield* parseSources([{ file, sourceText }])
  );
  return Arr.map(found, ({ line, rule }) => `${line} ${rule}`);
}, Effect.scoped);

/** Lists the Effect-native findings of several modules as `file:line rule`. */
const fileFindings = Effect.fn("PromisePolicyTest.fileFindings")(function* (
  sources: readonly (typeof RepositorySource.Type)[]
) {
  const found = yield* effectFindings(yield* parseSources(sources));
  return Arr.map(found, ({ file, line, rule }) => `${file}:${line} ${rule}`);
}, Effect.scoped);

describe("Promise syntax", () => {
  it.effect(
    "reports Promise syntax in strict domain modules, and new Promise everywhere",
    () =>
      Effect.gen(function* () {
        const source = `export async function load() {
  await run();
}
for await (const chunk of stream) {
  use(chunk);
}
export const later = new Promise(start);
export const handler = { async run() {} };
export const arrow = async () => 1;
`;
        assert.deepStrictEqual(yield* findings(source, SCRIPT), [
          "1 promise",
          "2 promise",
          "4 promise",
          "7 new-promise",
          "8 promise",
          "9 promise",
        ]);
        assert.deepStrictEqual(yield* findings(source), ["7 new-promise"]);
      })
  );

  it.effect(
    "reports new Promise in every module except tests, configuration, and page functions",
    () =>
      Effect.gen(function* () {
        const construct = "export const later = new Promise(start);\n";
        assert.deepStrictEqual(
          yield* fileFindings([
            { file: "apps/www/lib/load.ts", sourceText: construct },
            { file: "apps/www/components/card.tsx", sourceText: construct },
            { file: "apps/www/test/fixtures.ts", sourceText: construct },
            {
              file: "packages/backend/confect/proof/run.ts",
              sourceText: construct,
            },
            { file: "apps/www/lib/load.test.ts", sourceText: construct },
            { file: "apps/www/next.config.ts", sourceText: construct },
          ]),
          [
            "apps/www/components/card.tsx:1 new-promise",
            "apps/www/lib/load.ts:1 new-promise",
            "apps/www/test/fixtures.ts:1 new-promise",
            "packages/backend/confect/proof/run.ts:1 new-promise",
          ]
        );
      })
  );

  it.effect(
    "never reports new Promise inside a page function or through a local class named Promise",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(
            `import { type Page } from "@playwright/test";
export function wait(page: Page) {
  return page.evaluate(() => new Promise((resolve) => resolve(1)));
}
class Promise {
  constructor(run) {}
}
export const later = new Promise(start);
`,
            "apps/www/e2e/support/wait.browser.ts"
          ),
          []
        );
      })
  );

  it.effect(
    "never reports Promise chains or Effect code in strict domain modules",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(
            `import { Effect } from "effect";
export const loaded = Promise.all([read()]).then(run);
export const program = Effect.gen(function* () {
  const value = yield* Effect.tryPromise(() => read());
  return value;
});
`,
            SCRIPT
          ),
          []
        );
      })
  );
});
