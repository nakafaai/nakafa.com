import {
  Array as Arr,
  Effect,
  FileSystem,
  Option,
  Path,
  Record as Rec,
  Schema,
} from "effect";

/** The schema file of the installed Effect compiler plugin, which names every rule it defines. */
const PLUGIN_SCHEMA = "node_modules/@effect/tsgo/schema.json";

const PluginSchema = Schema.fromJsonString(
  Schema.Struct({
    definitions: Schema.Struct({
      effectLanguageServicePluginDiagnosticSeverityDefinition: Schema.Struct({
        properties: Schema.Record(Schema.String, Schema.Unknown),
      }),
    }),
  })
);
const RuleDecisions = Schema.Struct({
  diagnosticSeverity: Schema.Record(Schema.String, Schema.Unknown),
});
const decodeRuleDecisions = Schema.decodeUnknownOption(RuleDecisions);

/** The rule list of the installed Effect compiler plugin cannot be read. */
export class PluginRulesError extends Schema.TaggedError<PluginRulesError>()(
  "PluginRulesError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Builds the typed failure for a plugin schema that is missing or lists no rules. */
function unreadableRules(cause: unknown) {
  return new PluginRulesError({
    cause,
    message: `${PLUGIN_SCHEMA} is missing or does not list the plugin's rules, so the compiler configuration policy cannot tell which rules need a decision.`,
  });
}

/**
 * Reads the name of every rule the installed Effect compiler plugin defines,
 * so the policy can ask for a decision on each one.
 */
export const pluginRuleNames = Effect.fn("RepositoryPolicy.pluginRuleNames")(
  function* (root: string) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const source = yield* fileSystem
      .readFileString(path.join(root, PLUGIN_SCHEMA))
      .pipe(Effect.mapError(unreadableRules));
    const schema = yield* Schema.decodeEffect(PluginSchema)(source).pipe(
      Effect.mapError(unreadableRules)
    );
    return Rec.keys(
      schema.definitions.effectLanguageServicePluginDiagnosticSeverityDefinition
        .properties
    );
  }
);

/**
 * Reports the plugin rules that one Effect block leaves without a decision: a
 * rule it does not list, a name the plugin does not define, and a severity
 * that is neither `error` nor `off`. A rule that is off has its reason in
 * `docs/adr/0021-rules.md`.
 */
export function undecidedRules(
  file: string,
  block: Readonly<Record<string, unknown>>,
  rules: readonly string[]
) {
  const decisions = Option.match(decodeRuleDecisions(block), {
    onNone: () => Arr.empty<readonly [string, unknown]>(),
    onSome: ({ diagnosticSeverity }) => Rec.toEntries(diagnosticSeverity),
  });
  const listed = Arr.map(decisions, ([rule]) => rule);
  return Arr.appendAll(
    Arr.map(
      Arr.filter(rules, (rule) => !Arr.contains(listed, rule)),
      (rule) =>
        `${file}: decide the plugin rule ${rule}: list it in diagnosticSeverity as "error", or as "off" with its reason in docs/adr/0021-rules.md.`
    ),
    Arr.flatMap(decisions, ([rule, severity]) => {
      if (!Arr.contains(rules, rule)) {
        return [
          `${file}: remove ${rule} from diagnosticSeverity, because the installed plugin defines no such rule.`,
        ];
      }
      return severity === "error" || severity === "off"
        ? []
        : [
            `${file}: set ${rule} to "error" or "off" in diagnosticSeverity, so every rule either fails the typecheck or is off for a recorded reason.`,
          ];
    })
  );
}
