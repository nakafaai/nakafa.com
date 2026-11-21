import { Schema } from "effect";
import type { ReactNode } from "react";
import { createContext, use } from "react";

/** One place where a prompt puts an interaction: the interaction it names, inside a line of text or as a block of its own. */
const AssessmentPlace = Schema.Struct({
  inline: Schema.Boolean,
  interaction: Schema.String,
});
export type AssessmentPlace = typeof AssessmentPlace.Type;

/**
 * Draws the field of an interaction at the place its prompt puts it. A document that draws no field there,
 * a reading, an explanation, or a prompt whose fields stand below it, has none.
 */
export const AssessmentPlaceContext = createContext<
  ((place: AssessmentPlace) => ReactNode) | null
>(null);

/** The field of one interaction at its place in a prompt, when the prompt's reader draws fields there, and nothing otherwise. */
export function AssessmentInteraction({
  inline,
  interaction,
}: AssessmentPlace) {
  const draw = use(AssessmentPlaceContext);

  return draw === null ? null : draw({ inline, interaction });
}
