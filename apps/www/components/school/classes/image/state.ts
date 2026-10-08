import {
  type SchoolClassImage,
  schoolClassImageValidator,
} from "@repo/backend/confect/classes/schema";
import { Schema } from "effect";

const ClassImageStateSchema = Schema.Struct({
  class: Schema.Struct({
    image: schoolClassImageValidator,
  }),
});

type ClassImageState = typeof ClassImageStateSchema.Type;

/** Replace the selected class image while preserving the route state. */
export function updateClassImageState<T extends ClassImageState>(
  state: T,
  image: SchoolClassImage
): T {
  return {
    ...state,
    class: { ...state.class, image },
  };
}
