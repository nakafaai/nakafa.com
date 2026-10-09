import { Result, Schema } from "effect";

/** One environment value failed the Schema of its key. */
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
 * caller writes that read as the value of its key, and the record type rejects
 * a key without its read. Decoding is synchronous and starts no Effect runtime,
 * so a browser module, a prerendered Server Component, and a Convex module can
 * all call it while they load.
 *
 * An empty string stays a set value: only the Schema of the key decides whether
 * it is valid. An invalid value throws while the module loads, which stops the
 * build or the boot with the name of the variable.
 */
export const readEnvironment = <const Fields extends Schema.Struct.Fields>(
  fields: Fields,
  values: { readonly [Name in keyof Fields]: string | undefined }
) =>
  Result.getOrThrowWith(
    Schema.decodeUnknownResult(Schema.Struct(fields))(values),
    (error) => new InvalidEnvironmentError({ details: error.message })
  );
