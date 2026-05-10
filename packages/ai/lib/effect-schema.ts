import { jsonSchema } from "ai";
import { Either, JSONSchema, Schema } from "effect";

/**
 * Converts an Effect schema into an AI SDK schema.
 *
 * AI SDK 6 can consume JSON Schema for tool inputs and outputs. Effect's
 * StandardSchema bridge validates values, but Effect 3.21 does not expose the
 * `~standard.jsonSchema` field that this repo's installed AI SDK reads for
 * model-facing tool metadata.
 *
 * References:
 * - https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
 * - https://effect.website/docs/schema/json-schema/
 */
export const createEffectSchema = <A, I>(schema: Schema.Schema<A, I, never>) =>
  jsonSchema<A>(JSONSchema.make(schema), {
    validate: (value) => {
      const decoded = Schema.decodeUnknownEither(schema)(value);

      if (Either.isRight(decoded)) {
        return { success: true, value: decoded.right };
      }

      return {
        error: new Error(decoded.left.message),
        success: false,
      };
    },
  });
