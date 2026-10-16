// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { Effect } from "effect";
import {
  HOME_LESSON_PATHS,
  HomeLessonReadError,
  type HomeLessonReader,
  readHomeLessons,
} from "@/components/marketing/about/lesson/published";
import { PublishedProjectionError } from "@/lib/content/published/errors";

/** One lesson's counterpart in one locale, as the publication's alternates hold it. */
function counterpart(
  locale: "de" | "en" | "id",
  publicPath: string,
  title: string,
  description: string | undefined
) {
  return {
    appLocale: AppLocaleSchema.make(locale),
    metadata: {
      authors: [],
      datePublished: "2026-05-01",
      description,
      title,
    },
    publicPath,
  };
}

/** A published lesson as the material reader returns it: its alternates in every active locale. */
function lessonRoute(...alternates: ReturnType<typeof counterpart>[]) {
  return { model: { alternates } };
}

/**
 * The four home lessons, each read at its anchor path in English. The Indonesian
 * and German paths are the ones the publication gives each lesson, and they
 * differ from the anchor path, so a link that repeats the anchor path fails.
 */
const LESSONS: Readonly<Record<string, ReturnType<typeof lessonRoute>>> = {
  [HOME_LESSON_PATHS.atom]: lessonRoute(
    counterpart(
      "en",
      HOME_LESSON_PATHS.atom,
      "Atom Shell",
      "Electron energy levels in an atom."
    ),
    counterpart(
      "id",
      "materi/kimia/struktur-atom/kulit-atom",
      "Kulit Atom",
      "Kulit atom adalah tingkat energi elektron."
    ),
    counterpart(
      "de",
      "faecher/chemie/atombau/elektronenhuelle",
      "Elektronenhülle",
      "Elektronenhüllen sind Energiestufen der Elektronen."
    )
  ),
  [HOME_LESSON_PATHS.cell]: lessonRoute(
    counterpart(
      "en",
      HOME_LESSON_PATHS.cell,
      "Bacteria",
      "Bacteria are prokaryotic cells."
    ),
    counterpart(
      "id",
      "materi/biologi/keanekaragaman-makhluk-hidup/bakteri",
      "Bakteri",
      "Bakteri adalah sel prokariotik."
    ),
    counterpart(
      "de",
      "faecher/biologie/vielfalt-der-lebewesen/bakterien",
      "Bakterien",
      "Bakterien sind prokaryotische Zellen."
    )
  ),
  [HOME_LESSON_PATHS.circle]: lessonRoute(
    counterpart(
      "en",
      HOME_LESSON_PATHS.circle,
      "Three Basic Trigonometric Ratios",
      "Relate the sine, cosine and tangent to the unit circle."
    ),
    counterpart(
      "id",
      "materi/matematika/trigonometri/tiga-serangkai-perbandingan-trigonometri",
      "Tiga Perbandingan Trigonometri Dasar",
      "Hubungkan rasio sinus, kosinus, dan tangen pada segitiga siku-siku dengan koordinat pada lingkaran satuan."
    ),
    counterpart(
      "de",
      "faecher/mathematik/trigonometrie/sinus-kosinus-und-tangens-vergleichen",
      "Sinus, Kosinus und Tangens",
      "Verbinde Sinus, Kosinus und Tangens mit dem Einheitskreis."
    )
  ),
  [HOME_LESSON_PATHS.projectile]: lessonRoute(
    counterpart(
      "en",
      HOME_LESSON_PATHS.projectile,
      "Parabolic Movement",
      "Parabolic movement combines two motions."
    ),
    counterpart(
      "id",
      "materi/fisika/kinematika/gerak-parabola",
      "Gerak Parabola",
      "Gerak parabola menggabungkan dua gerak."
    ),
    counterpart(
      "de",
      "faecher/physik/kinematik/parabelfoermige-bewegung",
      "Parabelförmige Bewegung",
      "Parabelförmige Bewegung verbindet zwei Bewegungen."
    )
  ),
};

/** A reader that holds only the lessons at the paths it is given, and finds nothing else. */
function readerOf(
  lessons: Readonly<Record<string, ReturnType<typeof lessonRoute> | undefined>>
): HomeLessonReader {
  return async (_locale, publicPath) => lessons[publicPath] ?? null;
}

/** A reader that rejects the read of one path with the cause, and reads every other path normally. */
function readerRejectingAt(
  rejectedPath: string,
  cause: unknown
): HomeLessonReader {
  const reader = readerOf(LESSONS);
  return (locale, publicPath) =>
    publicPath === rejectedPath
      ? Promise.reject(cause)
      : reader(locale, publicPath);
}

describe("the lessons of the home page window", () => {
  it.effect(
    "links each tab to the page locale's own path, named and described by that counterpart",
    () =>
      Effect.gen(function* () {
        const lessons = yield* readHomeLessons("id", readerOf(LESSONS));

        expect(lessons.atom).toEqual({
          description: "Kulit atom adalah tingkat energi elektron.",
          href: "/id/materi/kimia/struktur-atom/kulit-atom",
          title: "Kulit Atom",
        });
        expect(lessons.cell.title).toBe("Bakteri");
        expect(lessons.cell.href).toBe(
          "/id/materi/biologi/keanekaragaman-makhluk-hidup/bakteri"
        );
        expect(lessons.projectile.href).toBe(
          "/id/materi/fisika/kinematika/gerak-parabola"
        );
        expect(lessons.circle.title).toBe(
          "Tiga Perbandingan Trigonometri Dasar"
        );
        expect(lessons.circle.href).toBe(
          "/id/materi/matematika/trigonometri/tiga-serangkai-perbandingan-trigonometri"
        );
      })
  );

  it.effect(
    "reads each lesson once, at its English anchor path, whatever the page's locale",
    () =>
      Effect.gen(function* () {
        const reader = vi.fn(readerOf(LESSONS));

        yield* readHomeLessons("de", reader);

        expect(reader).toHaveBeenCalledTimes(4);
        expect(reader).toHaveBeenCalledWith("en", HOME_LESSON_PATHS.atom);
        expect(reader).toHaveBeenCalledWith("en", HOME_LESSON_PATHS.cell);
        expect(reader).toHaveBeenCalledWith("en", HOME_LESSON_PATHS.circle);
        expect(reader).toHaveBeenCalledWith("en", HOME_LESSON_PATHS.projectile);
      })
  );

  it.effect(
    "fails with the projection error of the lesson that has no counterpart in the page's locale",
    () =>
      Effect.gen(function* () {
        const withoutGermanCell = {
          ...LESSONS,
          [HOME_LESSON_PATHS.cell]: lessonRoute(
            counterpart(
              "en",
              HOME_LESSON_PATHS.cell,
              "Bacteria",
              "Bacteria are prokaryotic cells."
            ),
            counterpart(
              "id",
              "materi/biologi/keanekaragaman-makhluk-hidup/bakteri",
              "Bakteri",
              "Bakteri adalah sel prokariotik."
            )
          ),
        };

        const error = yield* readHomeLessons(
          "de",
          readerOf(withoutGermanCell)
        ).pipe(Effect.flip);

        expect(error).toBeInstanceOf(PublishedProjectionError);
        expect(error.appLocale).toBe("de");
        expect(error.publicPath).toBe(HOME_LESSON_PATHS.cell);
      })
  );

  it.effect(
    "fails with the projection error of the lesson that is not published in the anchor locale",
    () =>
      Effect.gen(function* () {
        const withoutCell = {
          ...LESSONS,
          [HOME_LESSON_PATHS.cell]: undefined,
        };

        const error = yield* readHomeLessons("id", readerOf(withoutCell)).pipe(
          Effect.flip
        );

        expect(error).toBeInstanceOf(PublishedProjectionError);
        expect(error.appLocale).toBe("id");
        expect(error.publicPath).toBe(HOME_LESSON_PATHS.cell);
      })
  );

  it.effect("does not show a lesson that has no description", () =>
    Effect.gen(function* () {
      const undescribed = {
        ...LESSONS,
        [HOME_LESSON_PATHS.projectile]: lessonRoute(
          counterpart(
            "en",
            HOME_LESSON_PATHS.projectile,
            "Parabolic Movement",
            "Parabolic movement combines two motions."
          ),
          counterpart(
            "id",
            "materi/fisika/kinematika/gerak-parabola",
            "Gerak Parabola",
            undefined
          )
        ),
      };

      const error = yield* readHomeLessons("id", readerOf(undescribed)).pipe(
        Effect.flip
      );

      expect(error).toBeInstanceOf(PublishedProjectionError);
      expect(error.publicPath).toBe(HOME_LESSON_PATHS.projectile);
    })
  );

  it.effect(
    "fails with a read error that keeps the reader's cause when the reader rejects",
    () =>
      Effect.gen(function* () {
        const cause = { reason: "the content store is unreachable" };

        const error = yield* readHomeLessons(
          "id",
          readerRejectingAt(HOME_LESSON_PATHS.cell, cause)
        ).pipe(Effect.flip);

        expect(error).toBeInstanceOf(HomeLessonReadError);
        expect(error.publicPath).toBe(HOME_LESSON_PATHS.cell);
        expect(error.cause).toBe(cause);
      })
  );
});
