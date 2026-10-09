import {
  Array as Arr,
  Record as Rec,
  Result,
  Schema,
  SchemaIssue,
  String as Str,
} from "effect";

/** The prefix of the variables that Next.js inlines into browser code. */
const PUBLIC_PREFIX = "NEXT_PUBLIC_";
const formatIssues = SchemaIssue.makeFormatterStandardSchemaV1();

/** One or more environment values failed the Schema of their key. */
export class InvalidEnvironmentError extends Schema.TaggedError<InvalidEnvironmentError>()(
  "InvalidEnvironmentError",
  { details: Schema.String }
) {
  get message() {
    return `Invalid environment variables: ${this.details}`;
  }
}

/**
 * Decodes one literal record of environment values with the Schema of each key.
 *
 * This is the seam for code that Next.js bundles. The bundler inlines a public
 * value only where the source reads `process.env.NAME` literally, so each
 * caller writes that read as the value of its key. The record type requires a
 * value for every key, and the source check accepts only `NAME:
 * process.env.NAME` in this record.
 *
 * An empty string stays a set value: only the Schema of the key decides whether
 * it is valid. Decoding is synchronous. A failure throws while the module
 * loads, which stops the build or the boot, and its one-line message names
 * every invalid variable and never a value. In the browser a record with a key
 * that is not public fails too, because that value exists only on the server.
 */
export const readEnvironment = <
  const Fields extends {
    readonly [name: PropertyKey]: Schema.ConstraintDecoder<unknown>;
  },
>(
  fields: Fields,
  values: { readonly [Name in keyof Fields]: string | undefined }
) => {
  const serverNames = Arr.filter(
    Rec.keys(values),
    (name) => !Str.startsWith(PUBLIC_PREFIX)(name)
  );
  const decoded =
    "window" in globalThis && Arr.isReadonlyArrayNonEmpty(serverNames)
      ? Result.fail(
          `${Arr.join(serverNames, ", ")}: a server variable was read in the browser`
        )
      : Result.mapError(
          Schema.decodeUnknownResult(Schema.Struct(fields), {
            errors: "all",
          })(values),
          ({ issue }) =>
            Arr.join(
              Arr.map(
                formatIssues(issue).issues,
                ({ message, path }) =>
                  `${Arr.join(Arr.map(path ?? [], String), ".")}: ${message}`
              ),
              "; "
            )
        );
  return Result.getOrThrowWith(
    decoded,
    (details) => new InvalidEnvironmentError({ details })
  );
};
