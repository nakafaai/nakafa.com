import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { effectFindings } from "#scripts/check/effect";
import { parseSources, type RepositorySource } from "#scripts/check/source";

const CODE = "apps/www/lib/example.ts";
const STRICT_LOAD = `export const load = async () => {
  await run();
};
`;

/** Lists the Effect-native findings of one module as `line rule`. */
const findings = Effect.fn("AsyncPolicyTest.findings")(function* (
  sourceText: string,
  file = CODE
) {
  const found = yield* effectFindings(
    yield* parseSources([{ file, sourceText }])
  );
  return Arr.map(found, ({ line, rule }) => `${line} ${rule}`);
}, Effect.scoped);

/** Lists the Effect-native findings of several modules as `file:line rule`. */
const fileFindings = Effect.fn("AsyncPolicyTest.fileFindings")(function* (
  sources: readonly (typeof RepositorySource.Type)[]
) {
  const found = yield* effectFindings(yield* parseSources(sources));
  return Arr.map(found, ({ file, line, rule }) => `${file}:${line} ${rule}`);
}, Effect.scoped);

describe("async code outside the promise scope", () => {
  it.effect(
    "reports async functions, await, and for await in application code",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* findings(`export async function load() {
  await run();
}
for await (const chunk of stream) {
  use(chunk);
}
export const handler = { async run() {} };
export const arrow = async () => 1;
`),
          ["1 async", "2 async", "4 async", "7 async", "8 async"]
        );
      })
  );

  it.effect("reports async code in tests of strict folders", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* fileFindings([
          {
            file: "packages/backend/confect/users.test.ts",
            sourceText: STRICT_LOAD,
          },
          { file: "scripts/tool.test.ts", sourceText: STRICT_LOAD },
        ]),
        [
          "packages/backend/confect/users.test.ts:1 async",
          "packages/backend/confect/users.test.ts:2 async",
          "scripts/tool.test.ts:1 async",
          "scripts/tool.test.ts:2 async",
        ]
      );
    })
  );

  it.effect("leaves strict domain modules to the promise rule", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* fileFindings([
          { file: "scripts/tool.ts", sourceText: STRICT_LOAD },
          {
            file: "packages/backend/confect/proof/workflow.ts",
            sourceText: `import { workflow } from "@repo/backend/confect/workflow";
export const verify = workflow.define({
  handler: async (step) => {
    await step.runAction(run);
  },
});
`,
          },
        ]),
        ["scripts/tool.ts:1 promise", "scripts/tool.ts:2 promise"]
      );
    })
  );

  it.effect("never reports Promise chains, constructors, or Effect code", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(`import { Effect } from "effect";
export const loaded = Promise.all([read()]).then(run);
export const later = new Promise(start);
export const program = Effect.gen(function* () {
  const value = yield* Effect.tryPromise(() => read());
  return value;
});
`),
        []
      );
    })
  );
});
