import { Schema } from "effect";

/**
 * One environment value failed its schema while a Config reader ran. The
 * message keeps the phrase every owner has always printed and the variable
 * name that Effect Config records in its cause.
 */
export class InvalidEnvironmentError extends Schema.TaggedError<InvalidEnvironmentError>()(
  "InvalidEnvironmentError",
  { details: Schema.String }
) {
  get message() {
    return `Invalid environment variables: ${this.details}`;
  }
}
