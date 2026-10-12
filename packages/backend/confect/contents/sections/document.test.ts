import { describe, expect, it } from "@effect/vitest";
import { lessonDocument } from "@repo/backend/confect/contents/sections/document";
import { SECTIONS_PER_DOCUMENT } from "@repo/backend/confect/contents/sections/limits";
import type { lessonValidator } from "@repo/backend/confect/contents/sections/schema";
import { Array as Arr, Effect } from "effect";

/** A lesson of the Indonesian curriculum with the given source. */
function lessonOf(rawMdx: string): typeof lessonValidator.Type {
  return {
    appLocale: "id",
    contentKey: "material/lesson/matematika/matriks",
    publicPath: "materi/matematika/matriks",
    rawMdx,
    section: "material",
    title: "Matriks",
    version: "1:model:abc",
  };
}

describe("section document of a lesson", () => {
  it.effect(
    "splits a lesson into the sections of a document, at the version it was read at",
    () =>
      Effect.gen(function* () {
        const document = yield* lessonDocument(
          lessonOf(
            "Pengantar.\n\n## Bentuk Matriks\n\nSusunan bilangan.\n\n### Contoh\n\nDua kali dua."
          )
        );
        expect(document).toMatchObject({
          appLocale: "id",
          contentKey: "material/lesson/matematika/matriks",
          section: "material",
          version: "1:model:abc",
        });
        expect(
          Arr.map(
            document.sections,
            ({ anchor, count, ordinal, publicPath }) => [
              anchor,
              ordinal,
              count,
              publicPath,
            ]
          )
        ).toEqual([
          ["top", 0, 3, "materi/matematika/matriks"],
          ["bentuk-matriks", 1, 3, "materi/matematika/matriks"],
          ["contoh", 2, 3, "materi/matematika/matriks"],
        ]);
      })
  );

  it.effect("fails with the lesson named when its source cannot be split", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(lessonDocument(lessonOf("<Broken")));
      expect(failure).toMatchObject({
        _tag: "ReleaseError",
        code: "CONTENT_RELEASE_INTEGRITY",
      });
      expect(failure.message).toContain(
        "Lesson material/lesson/matematika/matriks/id cannot be split into sections"
      );
    })
  );

  it.effect(
    "fails with the lesson named when it has more sections than a document may have",
    () =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(
          lessonDocument(
            lessonOf(
              Arr.join(
                Arr.flatMap(
                  Arr.range(1, SECTIONS_PER_DOCUMENT + 1),
                  (number) => [`## Bagian ${number}`, `Isi bagian ${number}.`]
                ),
                "\n\n"
              )
            )
          )
        );
        expect(failure).toMatchObject({
          _tag: "ReleaseError",
          code: "CONTENT_RELEASE_LIMIT",
        });
        expect(failure.message).toContain(
          `material/lesson/matematika/matriks/id has more than ${SECTIONS_PER_DOCUMENT} sections`
        );
      })
  );

  it.effect(
    "accepts a lesson with exactly as many sections as a document may have",
    () =>
      Effect.gen(function* () {
        const document = yield* lessonDocument(
          lessonOf(
            Arr.join(
              Arr.flatMap(Arr.range(1, SECTIONS_PER_DOCUMENT), (number) => [
                `## Bagian ${number}`,
                `Isi bagian ${number}.`,
              ]),
              "\n\n"
            )
          )
        );
        expect(document.sections).toHaveLength(SECTIONS_PER_DOCUMENT);
      })
  );
});
