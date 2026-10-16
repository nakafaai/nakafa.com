import { Schema } from "effect";

/** The four lessons of the home page window, in the order of its tabs. */
export const LessonSchema = Schema.Literals([
  "projectile",
  "circle",
  "atom",
  "cell",
]);

/** One lesson of the home page window. */
export type Lesson = typeof LessonSchema.Type;
