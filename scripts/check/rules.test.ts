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

  it.effect(
    "leaves functions that Playwright runs in the browser page alone",
    () =>
      Effect.gen(function* () {
        const page = `page.evaluate(() => Object.keys(window.localStorage));
page.addInitScript(function () {
  const read = () => Object.values(window.state);
  return Array.isArray(read());
});
links.evaluateAll((nodes) => Object.entries(nodes));
page.$eval("main", (node) => Object.keys(node.dataset));
page.waitForFunction((limit) => Object.keys(window.state).length > limit, 1);
Object.keys(routes);
run(() => Object.keys(routes));
evaluate(() => Object.keys(routes));
page.locator(() => Object.keys(routes));
`;
        assert.deepStrictEqual(
          yield* findings([
            {
              file: "apps/www/e2e/page.browser.ts",
              sourceText: `import { test } from "@playwright/test";\n${page}`,
            },
            { file: "apps/www/lib/page.ts", sourceText: page },
          ]),
          [
            "apps/www/e2e/page.browser.ts object-helper",
            "apps/www/e2e/page.browser.ts object-helper",
            "apps/www/e2e/page.browser.ts object-helper",
            "apps/www/e2e/page.browser.ts object-helper",
            "apps/www/lib/page.ts object-helper",
            "apps/www/lib/page.ts object-helper",
            "apps/www/lib/page.ts array-check",
            "apps/www/lib/page.ts object-helper",
            "apps/www/lib/page.ts object-helper",
            "apps/www/lib/page.ts object-helper",
            "apps/www/lib/page.ts object-helper",
            "apps/www/lib/page.ts object-helper",
            "apps/www/lib/page.ts object-helper",
            "apps/www/lib/page.ts object-helper",
          ]
        );
      })
  );
});
