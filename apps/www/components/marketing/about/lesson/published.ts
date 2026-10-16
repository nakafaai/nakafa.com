import "server-only";

import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { Effect, Schema } from "effect";
import type { Lesson } from "@/components/marketing/about/lesson/id";
import { PublishedProjectionError } from "@/lib/content/published/errors";

/**
 * The published path of each home lesson in each locale. Each path names the
 * lesson section that Aksara publishes, so each tab shows that lesson's own
 * title and description and links to it.
 */
export const HOME_LESSON_PATHS = {
  atom: {
    de: "faecher/chemie/atombau/elektronenhuelle",
    en: "subjects/chemistry/structure-matter/atom-shell",
    id: "materi/kimia/struktur-atom/kulit-atom",
  },
  cell: {
    de: "faecher/biologie/vielfalt-der-lebewesen/bakterien",
    en: "subjects/biology/biodiversity/bacteria",
    id: "materi/biologi/keanekaragaman-makhluk-hidup/bakteri",
  },
  projectile: {
    de: "faecher/physik/kinematik/parabelfoermige-bewegung",
    en: "subjects/physics/kinematics/parabolic-movement",
    id: "materi/fisika/kinematika/gerak-parabola",
  },
  quadratic: {
    de: "faecher/mathematik/quadratische-funktionen/eigenschaften-quadratischer-funktionen",
    en: "subjects/mathematics/quadratic-function/quadratic-function-characteristics",
    id: "materi/matematika/persamaan-dan-fungsi-kuadrat/karakteristik-fungsi-kuadrat",
  },
} satisfies Record<Lesson, Record<AppLocaleCode, string>>;

/** The three things the window shows of one lesson, in the page's locale. */
const HomeLessonSchema = Schema.Struct({
  description: Schema.String,
  href: Schema.String,
  title: Schema.String,
});

/** One home lesson as the window shows it. */
export type HomeLesson = typeof HomeLessonSchema.Type;

/**
 * Reads the verified model of the lesson at one public path. It resolves to
 * null when no lesson is published at that path.
 */
export type HomeLessonReader = (
  locale: AppLocaleCode,
  publicPath: string
) => Promise<{
  readonly model: {
    readonly projection: Pick<MaterialLessonProjection, "metadata"> | null;
  };
} | null>;

/** Reads one published lesson's title, description and link for the page's locale. */
const readHomeLesson = Effect.fn("www.home.readLesson")(function* (
  locale: AppLocaleCode,
  lesson: Lesson,
  readLesson: HomeLessonReader
) {
  const appLocale = AppLocaleSchema.make(locale);
  const publicPath = HOME_LESSON_PATHS[lesson][locale];
  const found = yield* Effect.promise(() => readLesson(locale, publicPath));
  const projection = found?.model.projection;
  if (!projection) {
    return yield* new PublishedProjectionError({ appLocale, publicPath });
  }
  const { description, title } = projection.metadata;
  if (description === undefined) {
    return yield* new PublishedProjectionError({ appLocale, publicPath });
  }

  return {
    description,
    href: `/${locale}/${publicPath}`,
    title,
  } satisfies HomeLesson;
});

/**
 * Reads the four lessons of the home window for one locale. A lesson that is
 * not published in that locale fails the read, so the page cannot be built
 * with a hole where a lesson belongs.
 */
export const readHomeLessons = Effect.fn("www.home.readLessons")(function* (
  locale: AppLocaleCode,
  readLesson: HomeLessonReader
) {
  return yield* Effect.all(
    {
      atom: readHomeLesson(locale, "atom", readLesson),
      cell: readHomeLesson(locale, "cell", readLesson),
      projectile: readHomeLesson(locale, "projectile", readLesson),
      quadratic: readHomeLesson(locale, "quadratic", readLesson),
    },
    { concurrency: "unbounded" }
  );
});
