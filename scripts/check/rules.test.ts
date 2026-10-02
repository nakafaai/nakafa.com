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

/** The same module text at each path in `files`. */
function everywhere(sourceText: string, files: readonly string[]) {
  return Arr.map(files, (file) => ({ file, sourceText }));
}

describe("Effect-native rule scopes", () => {
  it.effect("leaves framework configuration to the framework", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings([
          {
            file: "apps/www/next.config.ts",
            sourceText:
              "export const config = JSON.parse(text);\ntry {\n  load();\n} catch {\n  skip();\n}\n",
          },
          {
            file: "packages/testing/base.ts",
            sourceText:
              'import { defineConfig } from "vitest/config";\nexport default defineConfig(JSON.parse(text));\n',
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
        const config = "{ jwks: process.env.JWKS }";
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
            "packages/a/default.ts env",
            "packages/a/literal.ts env",
            "packages/a/local.ts env",
            "packages/a/missing.ts env",
            "packages/a/namespace.ts env",
            "packages/a/options.ts env",
            "packages/a/plain.ts env",
            "packages/a/qualified.ts env",
          ]
        );
      })
  );

  it.effect("keeps timers in React modules and reports them elsewhere", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings([
          {
            file: "apps/www/components/toast.tsx",
            sourceText: "export const hide = () => setTimeout(close, 1);\n",
          },
          {
            file: "apps/www/hooks/delay.ts",
            sourceText:
              'import { useEffect } from "react";\nexport const hide = () => setTimeout(close, 1);\n',
          },
          {
            file: "apps/www/lib/portal.ts",
            sourceText:
              'import { createPortal } from "react-dom";\nexport const hide = () => setTimeout(close, 1);\n',
          },
          {
            file: "apps/www/lib/poll.ts",
            sourceText: "export const poll = () => setInterval(refresh, 1);\n",
          },
        ]),
        ["apps/www/lib/poll.ts timer"]
      );
    })
  );

  it.effect("holds Confect and script modules to array methods", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(
          everywhere("export const ids = rows.map(String);\n", [
            "packages/backend/confect/users/list.ts",
            "packages/backend/confect/users/list.test.ts",
            "scripts/check/list.ts",
            "packages/backend/convex/users.ts",
            "apps/www/lib/list.ts",
          ])
        ),
        [
          "packages/backend/confect/users/list.test.ts array-method",
          "packages/backend/confect/users/list.ts array-method",
          "scripts/check/list.ts array-method",
        ]
      );
    })
  );

  it.effect("holds Confect and script domain code to Effect composition", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* findings(
          everywhere("export const load = async () => 1;\n", [
            "packages/backend/confect/users/load.ts",
            "packages/backend/confect/users/load.test.ts",
            "packages/backend/confect/test.helpers.ts",
            "packages/backend/confect/test.setup.ts",
            "scripts/load.ts",
            "apps/www/lib/load.ts",
          ])
        ),
        [
          "packages/backend/confect/users/load.ts promise",
          "scripts/load.ts promise",
        ]
      );
    })
  );
});
