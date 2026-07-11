import type { SchoolClassImage } from "@repo/backend/convex/classes/schema";

interface ClassImageState {
  class: {
    image: SchoolClassImage;
  };
}

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
