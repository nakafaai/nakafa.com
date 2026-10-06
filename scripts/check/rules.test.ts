import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { effectFindings } from "#scripts/check/effect";
import { parseSources, type RepositorySource } from "#scripts/check/source";

/** Lists the Effect-native findings of sources as `file rule`. */
const findings = Effect.fn("RulePolicyTest.findings")(function* (
  sources: readonly (typeof RepositorySource.Type)[]
) {
  const found = yield* effectFindings(yield* parseSources(sources));
  return Arr.map(found, ({ file, rule }) => `${file} ${rule}`);
}, Effect.scoped);

describe("Effect-native rule scopes", () => {
  it.effect("leaves framework configuration to the framework", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings([
          {
            file: "apps/www/next.config.ts",
            sourceText:
              "export const config = Object.keys(value);\ntry {\n  load();\n} catch {\n  skip();\n}\n",
          },
          {
            file: "packages/testing/base.ts",
            sourceText:
              'import { defineConfig } from "vitest/config";\nexport default defineConfig(Object.keys(value));\n',
          },
        ]),
        ["apps/www/next.config.ts try-catch"]
      );
    })
  );

  it.effect(
    "treats a default export that satisfies a framework configuration type as configuration",
    () =>
      Effect.gen(function* () {
        const config = "{ jwks: Object.keys(source) }";
        assert.deepStrictEqual(
          yield* findings([
            {
              file: "packages/backend/confect/auth.ts",
              sourceText: `import type { AuthConfig } from "convex/server";\nexport default ${config} satisfies AuthConfig;\n`,
            },
            {
              file: "packages/a/local.ts",
              sourceText: `import type { AuthConfig } from "./types";\nexport default ${config} satisfies AuthConfig;\n`,
            },
            {
              file: "packages/a/options.ts",
              sourceText: `import type { Options } from "convex/server";\nexport default ${config} satisfies Options;\n`,
            },
            {
              file: "packages/a/qualified.ts",
              sourceText: `import type * as server from "convex/server";\nexport default ${config} satisfies server.AuthConfig;\n`,
            },
            {
              file: "packages/a/default.ts",
              sourceText: `import AuthConfig from "convex/server";\nexport default ${config} satisfies AuthConfig;\n`,
            },
            {
              file: "packages/a/namespace.ts",
              sourceText: `import * as AuthConfig from "convex/server";\nexport default ${config} satisfies AuthConfig;\n`,
            },
            {
              file: "packages/a/missing.ts",
              sourceText: `import { other } from "convex/server";\nexport default ${config} satisfies AuthConfig;\n`,
            },
            {
              file: "packages/a/plain.ts",
              sourceText: `export default ${config};\n`,
            },
            {
              file: "packages/a/literal.ts",
              sourceText: `export default ${config} satisfies { jwks?: string };\n`,
            },
          ]),
          [
            "packages/a/default.ts object-helper",
            "packages/a/literal.ts object-helper",
            "packages/a/local.ts object-helper",
            "packages/a/missing.ts object-helper",
            "packages/a/namespace.ts object-helper",
            "packages/a/options.ts object-helper",
            "packages/a/plain.ts object-helper",
            "packages/a/qualified.ts object-helper",
          ]
        );
      })
  );
});
