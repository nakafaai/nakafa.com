import { Schema } from "effect";

export class ContentRuntimeCiError extends Schema.TaggedError<ContentRuntimeCiError>()(
  "ContentRuntimeCiError",
  {
    message: Schema.String,
  }
) {}

export const contentRuntimeCiError = (message: string) =>
  new ContentRuntimeCiError({ message });
