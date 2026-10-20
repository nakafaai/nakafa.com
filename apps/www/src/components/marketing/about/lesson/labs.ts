import { DecimalSeparatorSchema } from "@repo/design-system/components/contents/physics/kinematics/number";
import { Schema } from "effect";
import { type ComponentType, type LazyExoticComponent, lazy } from "react";
import type { Lesson } from "@/components/marketing/about/lesson/id";

/** The props of every lesson lab, which the lesson window passes. */
const LessonLabPropsSchema = Schema.Struct({
  /** The decimal separator of the page's locale, which the physics lab writes its numbers with. */
  decimalSeparator: DecimalSeparatorSchema,
});

/** The props of every lesson lab. */
export type LessonLabProps = typeof LessonLabPropsSchema.Type;

/**
 * Each lab's module, imported only when the window asks for it. Every lab is a
 * module of its own, so one lab's code never loads with another's, and none of
 * them is in the home's first JavaScript.
 */
const LAB_LOADERS = {
  atom: () =>
    import("@/components/marketing/about/lesson/atom.client").then(
      ({ AtomLesson }) => ({ default: AtomLesson })
    ),
  cell: () =>
    import("@/components/marketing/about/lesson/cell.client").then(
      ({ CellLesson }) => ({ default: CellLesson })
    ),
  circle: () =>
    import("@/components/marketing/about/lesson/circle.client").then(
      ({ CircleLesson }) => ({ default: CircleLesson })
    ),
  projectile: () =>
    import("@/components/marketing/about/lesson/projectile.client").then(
      ({ ProjectileLesson }) => ({ default: ProjectileLesson })
    ),
};

/** The lab of each lesson. Rendering one starts its import, and the window renders it only once it reveals the window. */
export const LESSON_LABS: Record<
  Lesson,
  LazyExoticComponent<ComponentType<LessonLabProps>>
> = {
  atom: lazy(LAB_LOADERS.atom),
  cell: lazy(LAB_LOADERS.cell),
  circle: lazy(LAB_LOADERS.circle),
  projectile: lazy(LAB_LOADERS.projectile),
};

/** Starts the import of one lesson's lab, so its tab shows the lab without a wait. */
export function preloadLessonLab(lesson: Lesson) {
  LAB_LOADERS[lesson]();
}
