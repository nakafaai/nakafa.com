import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { effectFindings } from "#scripts/check/effect";
import { parseSources, type RepositorySource } from "#scripts/check/source";

/** Lists the Effect-native findings of one module as `line rule`. */
const findings = Effect.fn("ErrorPolicyTest.findings")(function* (
  sourceText: string,
  file: string
) {
  const found = yield* effectFindings(
    yield* parseSources([{ file, sourceText }])
  );
  return Arr.map(found, ({ line, rule }) => `${line} ${rule}`);
}, Effect.scoped);

/** Lists the Effect-native findings of several modules as `file:line rule`. */
const fileFindings = Effect.fn("ErrorPolicyTest.fileFindings")(function* (
  sources: readonly (typeof RepositorySource.Type)[]
) {
  const found = yield* effectFindings(yield* parseSources(sources));
  return Arr.map(found, ({ file, line, rule }) => `${file}:${line} ${rule}`);
}, Effect.scoped);

describe("platform errors in React modules", () => {
  it.effect("reports a platform error that a React module throws", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(
          `import { use } from "react";
import { OutsideProvider } from "@repo/design-system/hooks/required";
export function useReader() {
  const value = use(ReaderContext);
  if (value === null) {
    throw new Error("missing");
  }
  if (value.closed) {
    throw Error("closed");
  }
  if (value.broken) {
    throw (new TypeError("broken"));
  }
  if (value.gone) {
    throw new OutsideProvider({ part: "useReader" });
  }
  throw value.cause;
}
`,
          "apps/www/src/components/reader.tsx"
        ),
        ["6 raw-error", "9 raw-error", "12 raw-error"]
      );
    })
  );

  it.effect("leaves an error constructor that the module declares", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(
          `function Error(part: string) {
  return new OutsideProvider({ part });
}
export function Reader() {
  throw Error("Reader");
}
`,
          "apps/www/src/components/reader.tsx"
        ),
        []
      );
    })
  );

  it.effect(
    "keeps configuration, tests, the registry's component sets, and other modules to their own scope",
    () =>
      Effect.gen(function* () {
        const thrown = `import { use } from "react";
export function useReader() {
  throw new Error("missing");
}
`;
        assert.deepStrictEqual(
          yield* fileFindings([
            {
              file: "apps/www/src/components/reader.test.ts",
              sourceText: thrown,
            },
            { file: "apps/www/vite.config.ts", sourceText: thrown },
            {
              file: "packages/design-system/components/ui/reader.tsx",
              sourceText: thrown,
            },
            {
              file: "packages/design-system/components/evilcharts/reader.tsx",
              sourceText: thrown,
            },
            {
              file: "apps/www/src/lib/reader.ts",
              sourceText:
                'export function read() {\n  throw new Error("missing");\n}\n',
            },
          ]),
          ["apps/www/src/lib/reader.ts:2 throw"]
        );
      })
  );
});
