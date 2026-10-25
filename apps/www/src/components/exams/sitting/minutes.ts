import { Minutes } from "@repo/backend/confect/exams/sittings/schema";
import { Option, pipe, Schema } from "effect";

/**
 * Reads the minutes that a proctor types: a whole number from one to 120, as the server
 * accepts them. Any other text names no minutes, so the form keeps its own input.
 */
export function parseMinutes(
  input: string
): Option.Option<typeof Minutes.Type> {
  return pipe(
    Schema.decodeOption(Schema.FiniteFromString)(input),
    Option.flatMap(Schema.decodeOption(Minutes))
  );
}
