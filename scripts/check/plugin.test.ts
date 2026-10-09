import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Path, Result } from "effect";
import {
  divergentRules,
  pluginRuleNames,
  undecidedRules,
} from "#scripts/check/plugin";

const FILE = "packages/typescript-config/base.json";
const SCHEMA = "node_modules/@effect/tsgo/schema.json";
const UNREADABLE = `${SCHEMA} is missing or does not list the plugin's rules, so the compiler configuration policy cannot tell which rules need a decision.`;

/** Creates a repository root whose installed plugin has the given schema text. */
const rootWithSchema = Effect.fn("PluginTest.rootWithSchema")(function* (
  text: string
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fileSystem.makeTempDirectoryScoped({
    prefix: "plugin-rules-",
  });
  yield* fileSystem.makeDirectory(path.dirname(path.join(root, SCHEMA)), {
    recursive: true,
  });
  yield* fileSystem.writeFileString(path.join(root, SCHEMA), text);
  return root;
});

describe("compiler plugin rules", () => {
  it.effect("reads every rule name the installed plugin defines", () =>
    Effect.gen(function* () {
      const root = yield* rootWithSchema(
        '{"definitions":{"effectLanguageServicePluginDiagnosticSeverityDefinition":{"properties":{"floatingEffect":{},"schemaSync":{}}}}}'
      );

      assert.deepStrictEqual(yield* pluginRuleNames(root), [
        "floatingEffect",
        "schemaSync",
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("fails with a typed error when the plugin is not installed", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const root = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "plugin-rules-missing-",
      });

      const result = yield* Effect.result(pluginRuleNames(root));

      assert(Result.isFailure(result));
      assert.deepStrictEqual(
        [result.failure._tag, result.failure.message],
        ["PluginRulesError", UNREADABLE]
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("fails with a typed error when the schema lists no rules", () =>
    Effect.gen(function* () {
      const root = yield* rootWithSchema('{"definitions":{}}');

      const result = yield* Effect.result(pluginRuleNames(root));

      assert(Result.isFailure(result));
      assert.deepStrictEqual(
        [result.failure._tag, result.failure.message],
        ["PluginRulesError", UNREADABLE]
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it("reports a rule the block decides another way than the owning repository", () => {
    assert.deepStrictEqual(
      divergentRules(
        FILE,
        {
          diagnosticSeverity: {
            floatingEffect: "error",
            globalDate: "off",
            ownOnly: "error",
          },
        },
        {
          diagnosticSeverity: {
            floatingEffect: "error",
            globalDate: "error",
            schemaSync: "off",
          },
        }
      ),
      [
        `${FILE}: set globalDate to "error" in diagnosticSeverity, as the repository that owns this check decides it, so both repositories enforce the same rules.`,
        `${FILE}: set schemaSync to "off" in diagnosticSeverity, as the repository that owns this check decides it, so both repositories enforce the same rules.`,
      ]
    );
    assert.deepStrictEqual(
      divergentRules(FILE, {}, { diagnosticSeverity: { globalDate: "error" } }),
      [
        `${FILE}: set globalDate to "error" in diagnosticSeverity, as the repository that owns this check decides it, so both repositories enforce the same rules.`,
      ]
    );
    assert.deepStrictEqual(
      divergentRules(FILE, { diagnosticSeverity: { globalDate: "off" } }, {}),
      []
    );
  });

  it("accepts a block that decides every rule as an error or as off", () => {
    assert.deepStrictEqual(
      undecidedRules(
        FILE,
        { diagnosticSeverity: { floatingEffect: "error", schemaSync: "off" } },
        ["floatingEffect", "schemaSync"]
      ),
      []
    );
  });

  it("reports a rule the block does not list", () => {
    assert.deepStrictEqual(
      undecidedRules(
        FILE,
        { diagnosticSeverity: { floatingEffect: "error" } },
        ["floatingEffect", "schemaSync"]
      ),
      [
        `${FILE}: decide the plugin rule schemaSync: list it in diagnosticSeverity as "error", or as "off" with its reason in docs/adr/0021-rules.md.`,
      ]
    );
  });

  it("reports a name the installed plugin does not define", () => {
    assert.deepStrictEqual(
      undecidedRules(
        FILE,
        { diagnosticSeverity: { floatingEffect: "error", removedRule: "off" } },
        ["floatingEffect"]
      ),
      [
        `${FILE}: remove removedRule from diagnosticSeverity, because the installed plugin defines no such rule.`,
      ]
    );
  });

  it("reports a severity that is neither an error nor off", () => {
    assert.deepStrictEqual(
      undecidedRules(
        FILE,
        { diagnosticSeverity: { floatingEffect: "warning" } },
        ["floatingEffect"]
      ),
      [
        `${FILE}: set floatingEffect to "error" or "off" in diagnosticSeverity, so every rule either fails the typecheck or is off for a recorded reason.`,
      ]
    );
  });

  it("reports every rule for a block that carries no severities", () => {
    assert.deepStrictEqual(
      undecidedRules(FILE, { name: "@effect/language-service" }, [
        "floatingEffect",
      ]),
      [
        `${FILE}: decide the plugin rule floatingEffect: list it in diagnosticSeverity as "error", or as "off" with its reason in docs/adr/0021-rules.md.`,
      ]
    );
  });
});
