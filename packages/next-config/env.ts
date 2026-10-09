import { Schema } from "effect";

/**
 * One environment value failed its schema while a Config or Schema reader ran.
 * The message keeps the phrase every owner has printed and names the variable
 * through the failure detail. This package keeps its own copy because it has no
 * `@repo` dependency, and `keys.ts` is loaded by Next's config transpiler.
 */
export class InvalidEnvironmentError extends Schema.TaggedError<InvalidEnvironmentError>()(
  "InvalidEnvironmentError",
  { details: Schema.String }
) {
  get message() {
    return `Invalid environment variables: ${this.details}`;
  }
}
