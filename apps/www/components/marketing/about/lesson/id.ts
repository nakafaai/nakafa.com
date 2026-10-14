import { Schema } from "effect";

/** The four lessons of the home page window, in the order they open. */
export const LessonSchema = Schema.Literals([
  "projectile",
  "quadratic",
  "mole",
  "cell",
]);

/** One lesson of the home page window. */
export type Lesson = typeof LessonSchema.Type;
