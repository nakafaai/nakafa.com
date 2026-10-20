import { Effect, Schema } from "effect";

/**
 * One optional text search parameter of an entry page. A value of another shape,
 * such as a repeated key, is dropped, so a malformed link shows the page without
 * that parameter instead of failing the page.
 */
export const TextSearchParam = Schema.optionalKey(
  Schema.String.pipe(Schema.catchDecoding(() => Effect.succeedNone))
);
