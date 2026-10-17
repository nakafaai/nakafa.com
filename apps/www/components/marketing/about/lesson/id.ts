import { Schema } from "effect";

/**
 * The element id of the home page's lesson section. The header's Features link
 * and the toys beside the section find the section by this one id.
 */
export const LESSON_SECTION_ID = "lesson";

/** The four lessons of the home page window, in the order of its tabs. */
export const LessonSchema = Schema.Literals([
  "projectile",
  "circle",
  "atom",
  "cell",
]);

/** One lesson of the home page window. */
export type Lesson = typeof LessonSchema.Type;

/**
 * The subject of each lesson, which names its tab. The tabs read as the four
 * subjects of the window, each with its own icon, so no lesson's long title
 * stretches the row.
 */
export const LESSON_SUBJECTS = {
  atom: "chemistry",
  cell: "biology",
  circle: "mathematics",
  projectile: "physics",
} as const satisfies Record<Lesson, string>;
