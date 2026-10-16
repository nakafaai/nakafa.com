import "server-only";

import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { Array as Arr, Effect, Option, Schema } from "effect";
import type { Lesson } from "@/components/marketing/about/lesson/id";
import { PublishedProjectionError } from "@/lib/content/published/errors";

/** The locale whose published path names each home lesson. */
const ANCHOR_LOCALE: AppLocaleCode = "en";

/**
 * The published path of each home lesson in the anchor locale. These four paths
 * are the only ones written by hand. The other locales come from each lesson's
 * own alternates, so a renamed Indonesian or German lesson can never leave a
 * stale link here. An English rename is the exception: change its path here in
 * the same change. Until then, every locale's window fails with
 * PublishedProjectionError, which names that path, because every locale reads
 * its lessons through these paths.
 */
export const HOME_LESSON_PATHS = {
  atom: "subjects/chemistry/structure-matter/atom-shell",
  cell: "subjects/biology/biodiversity/bacteria",
  circle:
    "subjects/mathematics/trigonometry/trigonometric-comparison-three-primary",
  projectile: "subjects/physics/kinematics/parabolic-movement",
} satisfies Record<Lesson, string>;

/** The three things the window shows of one lesson, in the page's locale. */
const HomeLessonSchema = Schema.Struct({
  description: Schema.String,
  href: Schema.String,
  title: Schema.String,
});

/** One home lesson as the window shows it. */
export type HomeLesson = typeof HomeLessonSchema.Type;

/**
 * Reads the verified model of the lesson at one public path. Its alternates are
 * the lesson in every active locale, the one at the path included. It resolves
 * to null when no lesson is published at that path.
 */
export type HomeLessonReader = (
  locale: AppLocaleCode,
  publicPath: string
) => Promise<{
  readonly model: {
    readonly alternates: readonly Pick<
      MaterialLessonProjection,
      "appLocale" | "metadata" | "publicPath"
    >[];
  };
} | null>;

/** The reader rejected while it read one home lesson. Its own error stays the cause. */
export class HomeLessonReadError extends Schema.TaggedError<HomeLessonReadError>()(
  "HomeLessonReadError",
  {
    appLocale: AppLocaleSchema,
    cause: Schema.Unknown,
    publicPath: Schema.String,
  }
) {}

/**
 * Reads one home lesson's title, description and link for the page's locale.
 * The lesson is read once, at its anchor path, and its counterpart in the page's
 * locale gives the title, the description and the path. The errors name the
 * page's locale and the anchor path of the lesson.
 */
const readHomeLesson = Effect.fn("www.home.readLesson")(function* (
  locale: AppLocaleCode,
  lesson: Lesson,
  readLesson: HomeLessonReader
) {
  const appLocale = AppLocaleSchema.make(locale);
  const anchorPath = HOME_LESSON_PATHS[lesson];
  const found = yield* Effect.tryPromise({
    try: () => readLesson(ANCHOR_LOCALE, anchorPath),
    catch: (cause) =>
      new HomeLessonReadError({ appLocale, cause, publicPath: anchorPath }),
  });
  if (!found) {
    return yield* new PublishedProjectionError({
      appLocale,
      publicPath: anchorPath,
    });
  }
  const counterpart = Arr.findFirst(
    found.model.alternates,
    (alternate) => alternate.appLocale === locale
  );
  if (Option.isNone(counterpart)) {
    return yield* new PublishedProjectionError({
      appLocale,
      publicPath: anchorPath,
    });
  }
  const { description, title } = counterpart.value.metadata;
  if (description === undefined) {
    return yield* new PublishedProjectionError({
      appLocale,
      publicPath: anchorPath,
    });
  }

  return {
    description,
    href: `/${locale}/${counterpart.value.publicPath}`,
    title,
  } satisfies HomeLesson;
});

/**
 * Reads the four lessons of the home window for one locale. A lesson that has
 * no counterpart in that locale fails with PublishedProjectionError, and a read
 * that the reader rejects fails with HomeLessonReadError, so the page cannot be
 * built with a hole where a lesson belongs.
 */
export const readHomeLessons = Effect.fn("www.home.readLessons")(function* (
  locale: AppLocaleCode,
  readLesson: HomeLessonReader
) {
  return yield* Effect.all(
    {
      atom: readHomeLesson(locale, "atom", readLesson),
      cell: readHomeLesson(locale, "cell", readLesson),
      circle: readHomeLesson(locale, "circle", readLesson),
      projectile: readHomeLesson(locale, "projectile", readLesson),
    },
    { concurrency: "unbounded" }
  );
});
