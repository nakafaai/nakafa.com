import { assert, describe, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  inspectCompilerConfigs,
  isCompilerConfig,
} from "#scripts/check/compiler";

const BASE = "packages/typescript-config/base.json";
const NEXT = "packages/typescript-config/nextjs.json";
const RULES = {
  diagnosticSeverity: { instanceOfSchema: "error" },
  name: "@effect/language-service",
};

/** Renders one compiler configuration with the given plugins and parent. */
function config(
  plugins: readonly Readonly<Record<string, unknown>>[],
  parent?: string
) {
  return JSON.stringify({
    compilerOptions: { plugins },
    ...(parent === undefined ? {} : { extends: parent }),
  });
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

  it("accepts shared configurations that carry the same rules", () => {
    assert.deepStrictEqual(
      inspectCompilerConfigs([
        { file: "apps/www/tsconfig.json", sourceText: '{"extends":"next"}' },
        { file: BASE, sourceText: config([RULES]) },
        {
          file: "packages/typescript-config/library.json",
          sourceText:
            '{"compilerOptions":{"strict":true},"extends":"./base.json"}',
        },
        {
          file: NEXT,
          sourceText: config(
            [
              { name: "next" },
              {
                name: "@effect/language-service",
                diagnosticSeverity: { instanceOfSchema: "error" },
              },
            ],
            "./base.json"
          ),
        },
      ]),
      []
    );
  });

  it("rejects a shared configuration whose rules differ", () => {
    assert.deepStrictEqual(
      inspectCompilerConfigs([
        { file: BASE, sourceText: config([RULES]) },
        {
          file: NEXT,
          sourceText: config(
            [{ ...RULES, diagnosticSeverity: { instanceOfSchema: "off" } }],
            "./base.json"
          ),
        },
      ]),
      [
        `${NEXT}: its @effect/language-service block differs from ${BASE}; keep them identical so every workspace enforces the same rules.`,
      ]
    );
  });

  it("rejects a shared configuration that drops the rules", () => {
    assert.deepStrictEqual(
      inspectCompilerConfigs([
        { file: BASE, sourceText: '{"compilerOptions":{"strict":true}}' },
        { file: NEXT, sourceText: config([{ name: "next" }], "./base.json") },
      ]),
      [
        `${BASE}: declare the @effect/language-service block, because it extends no configuration that provides one.`,
        `${NEXT}: add the @effect/language-service block to its plugins array, because a plugins array replaces the one it extends.`,
      ]
    );
  });

  it("rejects a workspace configuration that declares plugins", () => {
    assert.deepStrictEqual(
      inspectCompilerConfigs([
        {
          file: "packages/design-system/tsconfig.json",
          sourceText: config([RULES], "shared"),
        },
        {
          file: "apps/www/tsconfig.json",
          sourceText: config([{ name: "next" }], "shared"),
        },
      ]),
      [
        "packages/design-system/tsconfig.json: remove its plugins array and inherit the shared one, because a plugins array replaces the one it extends.",
        "apps/www/tsconfig.json: remove its plugins array and inherit the shared one, because a plugins array replaces the one it extends.",
      ]
    );
  });

  it("rejects a configuration it cannot read", () => {
    assert.deepStrictEqual(
      inspectCompilerConfigs([
        { file: BASE, sourceText: config([RULES]) },
        {
          file: NEXT,
          sourceText: '{ // Next.js\n  "extends": "./base.json",\n}',
        },
      ]),
      [
        `${NEXT}: write this compiler configuration as plain JSON, without comments or trailing commas, so the check can read its plugins.`,
      ]
    );
  });
});
