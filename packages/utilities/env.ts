import {
  Array as Arr,
  Record as Rec,
  Result,
  Schema,
  SchemaIssue,
  String as Str,
} from "effect";

declare global {
  /** Vite inlines every `VITE_` variable into browser code, so each one reads as a string or nothing. */
  interface ImportMetaEnv {
    readonly [name: `VITE_${string}`]: string | undefined;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

/** The prefix of the variables that Vite inlines into browser code. */
const PUBLIC_PREFIX = "VITE_";
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
 * This is the seam for code that Vite bundles. The bundler inlines a public
 * value only where the source reads `import.meta.env.NAME` literally, so each
 * caller writes that read as the value of its key. The record type requires a
 * value for every key, and the source check accepts only `NAME:
 * import.meta.env.NAME` in this record. Server code runs the same record with
 * `process.env.NAME` reads, because Node and Convex have no `import.meta.env`.
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
                  `${Arr.join(Arr.map(Arr.flatten(Arr.fromNullishOr(path)), String), ".")}: ${message}`
              ),
              "; "
            )
        );
  return Result.getOrThrowWith(
    decoded,
    (details) => new InvalidEnvironmentError({ details })
  );
};
