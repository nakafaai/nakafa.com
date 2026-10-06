import { assert, describe, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  inspectCompilerConfigs,
  isCompilerConfig,
} from "#scripts/check/compiler";

/** Renders one compiler configuration with the given plugins. */
function config(plugins: readonly Readonly<Record<string, unknown>>[]) {
  return JSON.stringify({ compilerOptions: { plugins } });
}

const RULES = {
  diagnosticSeverity: { instanceOfSchema: "error" },
  name: "@effect/language-service",
};

describe("compiler configuration policy", () => {
  it("names the shared and workspace compiler configurations", () => {
    assert.deepStrictEqual(
      Arr.map(
        [
          "packages/typescript-config/base.json",
          "apps/www/tsconfig.json",
          "apps/www/tsconfig.build.json",
          "tsconfig.json",
          "apps/www/package.json",
          "apps/www/tsconfig.ts",
        ],
        isCompilerConfig
      ),
      [true, true, true, true, false, false]
    );
  });

  it("accepts shared configurations that declare the same rules", () => {
    assert.deepStrictEqual(
      inspectCompilerConfigs([
        { file: "apps/www/tsconfig.json", sourceText: '{"extends":"base"}' },
        {
          file: "apps/api/tsconfig.json",
          sourceText: config([{ name: "next" }]),
        },
        { file: "apps/mcp/tsconfig.json", sourceText: "{ // comment\n}" },
        {
          file: "packages/typescript-config/base.json",
          sourceText: config([RULES]),
        },
        {
          file: "packages/typescript-config/library.json",
          sourceText: '{"compilerOptions":{"strict":true}}',
        },
        {
          file: "packages/typescript-config/nextjs.json",
          sourceText: config([
            { name: "next" },
            {
              name: "@effect/language-service",
              diagnosticSeverity: { instanceOfSchema: "error" },
            },
          ]),
        },
      ]),
      []
    );
  });

  it("rejects a shared configuration whose rules differ", () => {
    assert.deepStrictEqual(
      inspectCompilerConfigs([
        {
          file: "packages/typescript-config/base.json",
          sourceText: config([RULES]),
        },
        {
          file: "packages/typescript-config/nextjs.json",
          sourceText: config([
            { ...RULES, diagnosticSeverity: { instanceOfSchema: "off" } },
          ]),
        },
      ]),
      [
        "packages/typescript-config/nextjs.json: its @effect/language-service block differs from packages/typescript-config/base.json; keep them identical so every workspace enforces the same rules.",
      ]
    );
  });

  it("rejects a workspace configuration that declares its own rules", () => {
    assert.deepStrictEqual(
      inspectCompilerConfigs([
        {
          file: "packages/design-system/tsconfig.json",
          sourceText: config([RULES]),
        },
      ]),
      [
        "packages/design-system/tsconfig.json: remove the @effect/language-service block and inherit it from the shared configuration, because a plugins array replaces the one it extends.",
      ]
    );
  });
});
