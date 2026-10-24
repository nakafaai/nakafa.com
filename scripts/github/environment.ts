import { randomUuid } from "@repo/utilities/uuid";
import {
  Array as Arr,
  Config,
  Effect,
  FileSystem,
  Record as Rec,
  Schema,
} from "effect";
import { runEntry } from "#scripts/entry";

/** The automatic token in `toJSON(secrets)`, which no later step reads from the job environment. */
const AUTOMATIC_TOKEN = "github_token";

const TextValuesSchema = Schema.fromJsonString(
  Schema.Record(Schema.String, Schema.String)
);

/** A GitHub context could not be read as a JSON object of text values. Its message names no value. */
export class EnvironmentContextError extends Schema.TaggedError<EnvironmentContextError>()(
  "EnvironmentContextError",
  { context: Schema.String }
) {
  get message() {
    return `The ${this.context} of the deploy environment are not a JSON object of text values.`;
  }
}

/**
 * The GITHUB_ENV entries of one environment's values. GitHub Actions reads each
 * `NAME<<DELIMITER` entry as the whole value, so a multi-line value keeps every
 * line. An empty value is an unset one, so it is not exported, and the
 * automatic token never is.
 */
export function environmentEntries(
  values: Readonly<Record<string, string>>,
  delimiter: string
) {
  return Arr.map(
    Arr.filter(
      Rec.toEntries(values),
      ([name, value]) => name !== AUTOMATIC_TOKEN && value !== ""
    ),
    ([name, value]) => `${name}<<${delimiter}\n${value}\n${delimiter}\n`
  );
}

const decodeContext = Effect.fn("github.decodeEnvironmentContext")(function* (
  context: string,
  json: string
) {
  return yield* Schema.decodeEffect(TextValuesSchema)(json).pipe(
    Effect.mapError(() => new EnvironmentContextError({ context }))
  );
});

/**
 * Appends the secrets and the variables of the job's GitHub environment to the
 * GITHUB_ENV file, so every later step of the job reads them as environment values.
 */
export const appendEnvironmentValues = Effect.fn(
  "github.appendEnvironmentValues"
)(function* (
  githubEnvPath: string,
  secretsJson: string,
  variablesJson: string
) {
  const secrets = yield* decodeContext("secrets", secretsJson);
  const variables = yield* decodeContext("variables", variablesJson);
  const delimiter = `NAKAFA_ENV_${yield* randomUuid}`;
  const entries = environmentEntries({ ...secrets, ...variables }, delimiter);
  const fileSystem = yield* FileSystem.FileSystem;
  yield* fileSystem.writeFileString(githubEnvPath, Arr.join(entries, ""), {
    flag: "a",
  });
});

/** Reads the job's context values from the environment that GitHub Actions sets, and appends them to GITHUB_ENV. */
export const loadDeployEnvironment = Effect.gen(function* () {
  const githubEnvPath = yield* Config.String("GITHUB_ENV");
  const secretsJson = yield* Config.String("ENVIRONMENT_SECRETS");
  const variablesJson = yield* Config.String("ENVIRONMENT_VARIABLES");
  yield* appendEnvironmentValues(githubEnvPath, secretsJson, variablesJson);
  return 0;
});

runEntry(import.meta.main, loadDeployEnvironment);
