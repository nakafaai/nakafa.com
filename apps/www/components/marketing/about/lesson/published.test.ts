// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  HOME_LESSON_PATHS,
  HomeLessonReadError,
  type HomeLessonReader,
  readHomeLessons,
} from "@/components/marketing/about/lesson/published";
import { PublishedProjectionError } from "@/lib/content/published/errors";

/** A published lesson as the material reader returns it, with its title and description. */
function publishedLesson(title: string, description: string | undefined) {
  return {
    model: {
      projection: {
        metadata: {
          authors: [],
          datePublished: "2026-05-01",
          description,
          title,
        },
      },
    },
  };
}

/** A reader that holds only the lessons at the paths it is given, and finds nothing else. */
function readerOf(
  lessons: Readonly<
    Record<string, ReturnType<typeof publishedLesson> | undefined>
  >
): HomeLessonReader {
  return async (_locale, publicPath) => lessons[publicPath] ?? null;
}

/** A reader that rejects the read of one path with the cause, and reads every other path normally. */
function readerRejectingAt(
  rejectedPath: string,
  cause: unknown
): HomeLessonReader {
  const reader = readerOf(INDONESIAN);
  return (locale, publicPath) =>
    publicPath === rejectedPath
      ? Promise.reject(cause)
      : reader(locale, publicPath);
}

/** The four lessons of the Indonesian home page, each published under its declared path. */
const INDONESIAN = {
  [HOME_LESSON_PATHS.atom.id]: publishedLesson(
    "Kulit Atom",
    "Kulit atom adalah tingkat energi elektron."
  ),
  [HOME_LESSON_PATHS.cell.id]: publishedLesson(
    "Bakteri",
    "Bakteri adalah sel prokariotik."
  ),
  [HOME_LESSON_PATHS.circle.id]: publishedLesson(
    "Tiga Perbandingan Trigonometri Dasar",
    "Hubungkan rasio sinus, kosinus, dan tangen pada segitiga siku-siku dengan koordinat pada lingkaran satuan."
  ),
  [HOME_LESSON_PATHS.projectile.id]: publishedLesson(
    "Gerak Parabola",
    "Gerak parabola menggabungkan dua gerak."
  ),
};

describe("the lessons of the home page window", () => {
  it.effect(
    "names each tab by its published lesson, with the lesson's description and link in the page's locale",
    () =>
      Effect.gen(function* () {
        const lessons = yield* readHomeLessons("id", readerOf(INDONESIAN));

        expect(lessons.atom).toEqual({
          description: "Kulit atom adalah tingkat energi elektron.",
          href: `/id/${HOME_LESSON_PATHS.atom.id}`,
          title: "Kulit Atom",
        });
        expect(lessons.cell.title).toBe("Bakteri");
        expect(lessons.projectile.href).toBe(
          `/id/${HOME_LESSON_PATHS.projectile.id}`
        );
        expect(lessons.circle.title).toBe(
          "Tiga Perbandingan Trigonometri Dasar"
        );
        expect(lessons.circle.href).toBe(`/id/${HOME_LESSON_PATHS.circle.id}`);
      })
  );

  it.effect(
    "fails with the projection error of the lesson that is not published in the locale",
    () =>
      Effect.gen(function* () {
        const withoutCell = {
          ...INDONESIAN,
          [HOME_LESSON_PATHS.cell.id]: undefined,
        };

        const error = yield* readHomeLessons("id", readerOf(withoutCell)).pipe(
          Effect.flip
        );

        expect(error).toBeInstanceOf(PublishedProjectionError);
        expect(error.appLocale).toBe("id");
        expect(error.publicPath).toBe(HOME_LESSON_PATHS.cell.id);
      })
  );

  it.effect("does not show a lesson that has no description", () =>
    Effect.gen(function* () {
      const undescribed = {
        ...INDONESIAN,
        [HOME_LESSON_PATHS.projectile.id]: publishedLesson(
          "Gerak Parabola",
          undefined
        ),
      };

      const error = yield* readHomeLessons("id", readerOf(undescribed)).pipe(
        Effect.flip
      );

      expect(error).toBeInstanceOf(PublishedProjectionError);
      expect(error.publicPath).toBe(HOME_LESSON_PATHS.projectile.id);
    })
  );

  it.effect(
    "fails with a read error that keeps the reader's cause when the reader rejects",
    () =>
      Effect.gen(function* () {
        const cause = { reason: "the content store is unreachable" };

        const error = yield* readHomeLessons(
          "id",
          readerRejectingAt(HOME_LESSON_PATHS.cell.id, cause)
        ).pipe(Effect.flip);

        expect(error).toBeInstanceOf(HomeLessonReadError);
        expect(error.publicPath).toBe(HOME_LESSON_PATHS.cell.id);
        expect(error.cause).toBe(cause);
      })
  );
});
