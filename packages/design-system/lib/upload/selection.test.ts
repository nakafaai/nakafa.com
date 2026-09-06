import { describe, expect, it } from "@effect/vitest";
import {
  FileCountError,
  FileSizeError,
  FileTypeError,
  selectFileBatch,
} from "@repo/design-system/lib/upload/selection";
import { Effect } from "effect";

const OPTIONS = {
  accept: "image/*",
  currentFiles: [],
  maxFiles: 4,
  maxSize: 3,
  multiple: true,
};
const PHOTO = new File(["abc"], "photo.png", { type: "image/png" });

describe("file batch selection", () => {
  it.effect.each([
    { name: "notes", type: "", accept: "*", expected: true },
    { name: "PHOTO.JPEG", type: "", accept: ".jpeg", expected: true },
    {
      name: "photo.jpeg",
      type: "image/jpeg",
      accept: " .PNG, image/* ",
      expected: true,
    },
    {
      name: "notes.pdf",
      type: "application/pdf",
      accept: ".txt, application/pdf",
      expected: true,
    },
    {
      name: "notes.txt",
      type: "text/plain",
      accept: "image/*",
      expected: false,
    },
    { name: "notes", type: "", accept: ".txt", expected: false },
    { name: "notes.", type: "", accept: ".txt", expected: false },
    { name: "notes.txt", type: "", accept: "text/plain", expected: false },
    { name: "notes.txt", type: "", accept: "", expected: false },
    {
      name: "photo.jpeg",
      type: "image/jpeg",
      accept: "image/",
      expected: false,
    },
    {
      name: "photo.jpeg",
      type: "image/jpeg",
      accept: "IMAGE/JPEG",
      expected: false,
    },
    {
      name: "photo.png.exe",
      type: "application/octet-stream",
      accept: ".png",
      expected: false,
    },
  ])(
    "matches $name ($type) against $accept",
    ({ name, type, accept, expected }) =>
      Effect.gen(function* () {
        const file = new File(["a"], name, { type });
        const result = yield* selectFileBatch({
          ...OPTIONS,
          accept,
          files: [file],
        });
        expect(result).toEqual(
          expected
            ? { files: [file], errors: [] }
            : { files: [], errors: [new FileTypeError({ fileName: name })] }
        );
      })
  );

  it.effect(
    "accepts files at the size limit and reports per-file failures in order",
    () =>
      Effect.gen(function* () {
        const result = yield* selectFileBatch({
          ...OPTIONS,
          files: [
            PHOTO,
            new File(["abcd"], "large.txt", { type: "text/plain" }),
            new File(["a"], "notes.txt", { type: "text/plain" }),
          ],
        });
        expect(result.files).toEqual([PHOTO]);
        expect(result.errors).toEqual([
          new FileSizeError({ maxSize: 3 }),
          new FileTypeError({ fileName: "notes.txt" }),
        ]);
      })
  );

  it.effect(
    "checks the batch count before duplicate and per-file validation",
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          selectFileBatch({
            ...OPTIONS,
            currentFiles: [PHOTO],
            files: [PHOTO],
            maxFiles: 1,
            maxSize: 0,
          })
        );
        expect(error).toEqual(new FileCountError({ maxFiles: 1 }));
      })
  );

  it.effect("skips matching existing names and sizes before revalidation", () =>
    Effect.gen(function* () {
      const larger = new File(["abcd"], "photo.png", { type: "image/png" });
      const renamed = new File(["abc"], "renamed.png", { type: "image/png" });
      const result = yield* selectFileBatch({
        ...OPTIONS,
        currentFiles: [PHOTO],
        files: [PHOTO, larger, renamed],
      });
      expect(result.files).toEqual([renamed]);
      expect(result.errors).toEqual([new FileSizeError({ maxSize: 3 })]);
    })
  );

  it.effect(
    "allows a single-mode replacement regardless of the multiple-file cap",
    () =>
      Effect.gen(function* () {
        const result = yield* selectFileBatch({
          ...OPTIONS,
          currentFiles: [PHOTO],
          files: [PHOTO],
          maxFiles: 0,
          multiple: false,
        });
        expect(result).toEqual({ files: [PHOTO], errors: [] });
      })
  );

  it.effect(
    "preserves order and same-batch entries with unbounded limits",
    () =>
      Effect.gen(function* () {
        const result = yield* selectFileBatch({
          ...OPTIONS,
          files: [PHOTO, PHOTO],
          maxFiles: Number.POSITIVE_INFINITY,
          maxSize: Number.POSITIVE_INFINITY,
        });
        expect(result).toEqual({ files: [PHOTO, PHOTO], errors: [] });
      })
  );
});
