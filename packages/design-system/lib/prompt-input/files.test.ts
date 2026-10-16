import { describe, expect, it } from "@effect/vitest";
import {
  PromptInputFileConstraintError,
  PromptInputFileSchema,
  validatePromptInputFiles,
} from "@repo/design-system/lib/prompt-input/files";
import { Effect, Schema } from "effect";

const image = new File(["image"], "lesson.png", { type: "image/png" });
const text = new File(["lesson"], "lesson.txt", { type: "text/plain" });
const empty = new File([], "empty.txt", { type: "text/plain" });
const large = new File(["larger"], "large.txt", { type: "text/plain" });
const essay = new File(["essay"], "essay.docx", {
  type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
});

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

      expect(result).toEqual({ files: [image, text], rejections: [] });
      expect(explicitlyAccepted).toEqual({ files: [text], rejections: [] });
    })
  );

  it.effect("matches wildcard media types and filename extensions", () =>
    Effect.gen(function* () {
      const result = yield* validatePromptInputFiles({
        accept: "image/*, .txt",
        currentFileCount: 0,
        files: [image, text],
      });

      expect(result).toEqual({ files: [image, text], rejections: [] });
    })
  );

  it.effect("names a file whose type is not accepted", () =>
    Effect.gen(function* () {
      const result = yield* validatePromptInputFiles({
        accept: "image/*",
        currentFileCount: 0,
        files: [text],
      });

      expect(result.files).toEqual([]);
      expect(result.rejections).toHaveLength(1);
      expect(result.rejections[0]).toBeInstanceOf(
        PromptInputFileConstraintError
      );
      expect(result.rejections[0]).toMatchObject({
        code: "accept",
        files: ["lesson.txt"],
      });
    })
  );

  it.effect("names an empty file as empty, not as too large", () =>
    Effect.gen(function* () {
      const result = yield* validatePromptInputFiles({
        currentFileCount: 0,
        files: [empty],
        maxFileSize: 8,
      });

      expect(result.files).toEqual([]);
      expect(result.rejections).toMatchObject([
        { code: "empty", files: ["empty.txt"] },
      ]);
    })
  );

  it.effect("names a file that is larger than the size limit", () =>
    Effect.gen(function* () {
      const result = yield* validatePromptInputFiles({
        currentFileCount: 0,
        files: [image],
        maxFileSize: 1,
      });

      expect(result.files).toEqual([]);
      expect(result.rejections).toMatchObject([
        { code: "max_file_size", files: ["lesson.png"] },
      ]);
    })
  );

  it.effect(
    "keeps the files that fit and names each file it drops with its own reason",
    () =>
      Effect.gen(function* () {
        const result = yield* validatePromptInputFiles({
          accept: "image/*, text/plain",
          currentFileCount: 0,
          files: [image, essay, large, empty],
          maxFileSize: 5,
        });

        expect(result.files).toEqual([image]);
        expect(result.rejections).toMatchObject([
          { code: "accept", files: ["essay.docx"] },
          { code: "empty", files: ["empty.txt"] },
          { code: "max_file_size", files: ["large.txt"] },
        ]);
      })
  );

  it.effect("reports an empty file of an unaccepted type by its type", () =>
    Effect.gen(function* () {
      const result = yield* validatePromptInputFiles({
        accept: "image/*",
        currentFileCount: 0,
        files: [empty],
      });

      expect(result.rejections).toMatchObject([
        { code: "accept", files: ["empty.txt"] },
      ]);
    })
  );

  it.effect(
    "keeps the room that is left and names the files that did not fit",
    () =>
      Effect.gen(function* () {
        const result = yield* validatePromptInputFiles({
          currentFileCount: 1,
          files: [image, text, large],
          maxFiles: 2,
        });

        expect(result.files).toEqual([image]);
        expect(result.rejections).toMatchObject([
          { code: "max_files", files: ["lesson.txt", "large.txt"] },
        ]);
      })
  );

  it.effect("attaches nothing when no room is left", () =>
    Effect.gen(function* () {
      const result = yield* validatePromptInputFiles({
        currentFileCount: 2,
        files: [image],
        maxFiles: 2,
      });

      expect(result.files).toEqual([]);
      expect(result.rejections).toMatchObject([
        { code: "max_files", files: ["lesson.png"] },
      ]);
    })
  );
});

describe("prompt input file schema", () => {
  const attachment = {
    file: image,
    id: "attachment-1",
    mediaType: "image/png",
    type: "file",
    url: "blob:lesson",
  };

  it.effect("keeps provider metadata that is plain JSON", () =>
    Effect.gen(function* () {
      const providerMetadata = {
        openai: { detail: ["high", null, 1, true] },
      };
      const decoded = yield* Schema.decodeUnknownEffect(PromptInputFileSchema)({
        ...attachment,
        providerMetadata,
      });

      expect(decoded.providerMetadata).toEqual(providerMetadata);
    })
  );

  it.effect("rejects provider metadata that is not JSON", () =>
    Effect.gen(function* () {
      const error = yield* Schema.decodeUnknownEffect(PromptInputFileSchema)({
        ...attachment,
        providerMetadata: { openai: { detail: () => "not json" } },
      }).pipe(Effect.flip);

      expect(error).toBeInstanceOf(Schema.SchemaError);
    })
  );
});
