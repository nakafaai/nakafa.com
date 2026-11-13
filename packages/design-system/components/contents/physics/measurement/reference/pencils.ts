import { Schema } from "effect";

/**
 * One desk measured with three friends' pencils and with a metre rule. Each
 * pencil is a different length, so the friends count different numbers of
 * pencils for the same desk and cannot compare their results. The metre rule
 * is the same everywhere, so everyone who uses it gets the same number.
 */

/** The desk's true length, in metres. */
export const DESK_LENGTH = 1.2;

/** The references, each with its length in metres. */
export const ReferenceSchema = Schema.Literals(["short", "medium", "long", "rule"]);
export const REFERENCES = { long: 0.22, medium: 0.19, rule: 1, short: 0.15 } as const satisfies Record<
  typeof ReferenceSchema.Type,
  number
>;

/** How many references fit along the desk, and the whole ones laid down. */
export function referenceCount(reference: typeof ReferenceSchema.Type) {
  const count = DESK_LENGTH / REFERENCES[reference];
  return { count, whole: Math.floor(count + 1e-9) };
}
