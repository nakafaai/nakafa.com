import { describe, expect, it } from "@effect/vitest";
import {
  PromptInputFileConstraintError,
  validatePromptInputFiles,
} from "@repo/design-system/lib/prompt-input/files";
import { Effect } from "effect";

const image = new File(["image"], "lesson.png", { type: "image/png" });
const text = new File(["lesson"], "lesson.txt", { type: "text/plain" });

describe("prompt input file selection", () => {
  it.effect("keeps unconstrained and MIME-matched selections", () =>
    Effect.gen(function* () {
      const result = yield* validatePromptInputFiles({
        currentFileCount: 0,
        files: [image, text],
      });
      const explicitlyAccepted = yield* validatePromptInputFiles({
        accept: "text/plain",
        currentFileCount: 0,
        files: [text],
      });

      expect(result).toEqual({ files: [image, text] });
      expect(explicitlyAccepted).toEqual({ files: [text] });
    })
  );

  it.effect("matches wildcard media types and filename extensions", () =>
    Effect.gen(function* () {
      const result = yield* validatePromptInputFiles({
        accept: "image/*, .txt",
        currentFileCount: 0,
        files: [image, text],
      });

      expect(result).toEqual({ files: [image, text] });
    })
  );

  it.effect("rejects a selection without an accepted file type", () =>
    Effect.gen(function* () {
      const error = yield* validatePromptInputFiles({
        accept: "image/*",
        currentFileCount: 0,
        files: [text],
      }).pipe(Effect.flip);

      expect(error).toBeInstanceOf(PromptInputFileConstraintError);
      expect(error.code).toBe("accept");
    })
  );

  it.effect("rejects a selection whose accepted files are all oversized", () =>
    Effect.gen(function* () {
      const error = yield* validatePromptInputFiles({
        currentFileCount: 0,
        files: [image],
        maxFileSize: 1,
      }).pipe(Effect.flip);

      expect(error.code).toBe("max_file_size");
    })
  );

  it.effect(
    "retains valid files when only part of a selection is oversized",
    () =>
      Effect.gen(function* () {
        const small = new File(["a"], "small.txt", { type: "text/plain" });
        const result = yield* validatePromptInputFiles({
          currentFileCount: 0,
          files: [small, text],
          maxFileSize: 2,
        });

        expect(result).toEqual({ files: [small] });
      })
  );

  it.effect("caps available capacity and returns a typed warning", () =>
    Effect.gen(function* () {
      const result = yield* validatePromptInputFiles({
        currentFileCount: 1,
        files: [image, text],
        maxFiles: 2,
      });

      expect(result.files).toEqual([image]);
      expect(result.warning).toBeInstanceOf(PromptInputFileConstraintError);
      expect(result.warning?.code).toBe("max_files");
    })
  );
});
