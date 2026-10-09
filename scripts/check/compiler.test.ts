import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Schema } from "effect";
import {
  inspectCompilerConfigs,
  isCompilerConfig,
} from "#scripts/check/compiler";

const PACKAGE = "@repo/typescript-config";
const BASE = "packages/typescript-config/base.json";
const LIBRARY = "packages/typescript-config/library.json";
const NEXT = "packages/typescript-config/nextjs.json";
const RULES = {
  diagnosticSeverity: { instanceOfSchema: "error" },
  name: "@effect/language-service",
};
/** The rules the fixture plugin defines: the one the fixture block decides. */
const PLUGIN_RULES = ["instanceOfSchema"];

/** Renders one compiler configuration with the given parent and plugins. */
function config(
  parent: unknown,
  plugins?: readonly Readonly<Record<string, unknown>>[]
) {
  return Schema.encodeSync(Schema.fromJsonString(Schema.Unknown))({
    ...(plugins === undefined ? {} : { compilerOptions: { plugins } }),
    ...(parent === undefined ? {} : { extends: parent }),
  });
}

/** Renders the report line for a configuration that reaches no Effect block. */
function unreached(file: string) {
  return `${file}: extend a shared configuration that declares the @effect/language-service block, by its @repo/typescript-config/ name or by a relative path, or declare the block in a shared configuration that extends nothing.`;
}

describe("compiler configuration policy", () => {
  it("names the shared and workspace compiler configurations", () => {
    assert.deepStrictEqual(
      Arr.map(
        [
          BASE,
          "apps/www/tsconfig.json",
          "apps/www/tsconfig.build.json",
          "tsconfig.json",
          "packages/typescript-config/package.json",
          "apps/www/package.json",
          "apps/www/tsconfig.ts",
        ],
        isCompilerConfig
      ),
      [true, true, true, true, false, false, false]
    );
  });

  it("accepts configurations that reach the same shared rules", () => {
    assert.deepStrictEqual(
      inspectCompilerConfigs(
        PACKAGE,
        [
          {
            file: "apps/www/tsconfig.json",
            sourceText: config("@repo/typescript-config/nextjs.json"),
          },
          {
            file: "packages/backend/convex/tsconfig.json",
            sourceText: config("../tsconfig.json"),
          },
          {
            file: "packages/backend/tsconfig.json",
            sourceText: config("../typescript-config/./library.json"),
          },
          { file: BASE, sourceText: config(undefined, [RULES]) },
          { file: LIBRARY, sourceText: config("./base.json") },
          {
            file: NEXT,
            sourceText: config("./base.json", [
              { name: "next" },
              {
                name: "@effect/language-service",
                diagnosticSeverity: { instanceOfSchema: "error" },
              },
            ]),
          },
          {
            file: "scripts/tsconfig.json",
            sourceText: config("../packages/typescript-config/base.json"),
          },
        ],
        PLUGIN_RULES
      ),
      []
    );
  });

  it("rejects a shared configuration whose rules differ", () => {
    assert.deepStrictEqual(
      inspectCompilerConfigs(
        PACKAGE,
        [
          { file: BASE, sourceText: config(undefined, [RULES]) },
          {
            file: NEXT,
            sourceText: config("./base.json", [
              { ...RULES, diagnosticSeverity: { instanceOfSchema: "off" } },
            ]),
          },
        ],
        PLUGIN_RULES
      ),
      [
        `${NEXT}: its @effect/language-service block differs from ${BASE}; keep them identical so every workspace enforces the same rules.`,
      ]
    );
  });

  it("rejects every configuration a dropped block leaves without rules", () => {
    assert.deepStrictEqual(
      inspectCompilerConfigs(
        PACKAGE,
        [
          {
            file: "apps/api/tsconfig.json",
            sourceText: config("@repo/typescript-config/library.json"),
          },
          {
            file: "apps/www/tsconfig.json",
            sourceText: config("@repo/typescript-config/nextjs.json"),
          },
          { file: BASE, sourceText: config(undefined) },
          { file: LIBRARY, sourceText: config("./base.json") },
          { file: NEXT, sourceText: config("./base.json", [{ name: "next" }]) },
        ],
        PLUGIN_RULES
      ),
      [
        unreached("apps/api/tsconfig.json"),
        unreached("apps/www/tsconfig.json"),
        unreached(BASE),
        unreached(LIBRARY),
        `${NEXT}: add the @effect/language-service block to its plugins array, because a plugins array replaces the one it extends.`,
      ]
    );
  });

  it("rejects a workspace configuration that declares plugins", () => {
    assert.deepStrictEqual(
      inspectCompilerConfigs(
        PACKAGE,
        [
          {
            file: "apps/www/tsconfig.json",
            sourceText: config("@repo/typescript-config/base.json", [
              { name: "next" },
            ]),
          },
          { file: BASE, sourceText: config(undefined, [RULES]) },
          {
            file: "packages/design-system/tsconfig.json",
            sourceText: config("@repo/typescript-config/base.json", [RULES]),
          },
        ],
        PLUGIN_RULES
      ),
      [
        "apps/www/tsconfig.json: remove its plugins array and inherit the shared one, because a plugins array replaces the one it extends.",
        "packages/design-system/tsconfig.json: remove its plugins array and inherit the shared one, because a plugins array replaces the one it extends.",
      ]
    );
  });

  it("reports a rule the shared block leaves undecided", () => {
    assert.deepStrictEqual(
      inspectCompilerConfigs(
        PACKAGE,
        [{ file: BASE, sourceText: config(undefined, [RULES]) }],
        ["floatingEffect", "instanceOfSchema"]
      ),
      [
        `${BASE}: decide the plugin rule floatingEffect: list it in diagnosticSeverity as "error", or as "off" with its reason in docs/adr/0021-rules.md.`,
      ]
    );
  });

  it("rejects a configuration it cannot read or follow", () => {
    assert.deepStrictEqual(
      inspectCompilerConfigs(
        PACKAGE,
        [
          { file: "apps/api/tsconfig.json", sourceText: config(undefined) },
          {
            file: "apps/cycle/tsconfig.json",
            sourceText: config("./tsconfig.json"),
          },
          {
            file: "apps/email/tsconfig.json",
            sourceText: config(["@repo/typescript-config/base.json"]),
          },
          {
            file: "apps/mcp/tsconfig.json",
            sourceText: config("@tsconfig/node24/tsconfig.json"),
          },
          {
            file: "apps/www/tsconfig.json",
            sourceText: config("@repo/typescript-config/nextjs.json"),
          },
          { file: BASE, sourceText: config(undefined, [RULES]) },
          {
            file: NEXT,
            sourceText: '{ // Next.js\n  "extends": "./base.json",\n}',
          },
          {
            file: "packages/seo/tsconfig.json",
            sourceText: config("@repo/typescript-config/missing.json"),
          },
        ],
        PLUGIN_RULES
      ),
      [
        unreached("apps/api/tsconfig.json"),
        unreached("apps/cycle/tsconfig.json"),
        unreached("apps/email/tsconfig.json"),
        unreached("apps/mcp/tsconfig.json"),
        unreached("apps/www/tsconfig.json"),
        `${NEXT}: write this compiler configuration as plain JSON, without comments or trailing commas, so the check can read its plugins.`,
        unreached("packages/seo/tsconfig.json"),
      ]
    );
  });
});
