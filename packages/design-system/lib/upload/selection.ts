import { Array as Arr, Effect, Schema } from "effect";

/** Rejects an entire selection that exceeds the multiple-file limit. */
export class FileCountError extends Schema.TaggedError<FileCountError>()(
  "FileCountError",
  { maxFiles: Schema.Finite }
) {}

/** Rejects one file whose byte size exceeds the configured limit. */
export class FileSizeError extends Schema.TaggedError<FileSizeError>()(
  "FileSizeError",
  { maxSize: Schema.Finite }
) {}

/** Rejects one file whose extension and MIME type do not match the input. */
export class FileTypeError extends Schema.TaggedError<FileTypeError>()(
  "FileTypeError",
  { fileName: Schema.String }
) {}

/** Matches the input accept contract against a file's name and MIME type. */
function acceptsFile(file: File, accept: string) {
  if (accept === "*") {
    return true;
  }

  const nameParts = file.name.split(".");
  const lastPart = nameParts.at(-1);
  const extension =
    nameParts.length > 1 && lastPart ? `.${lastPart.toLowerCase()}` : "";

  return Arr.some(accept.split(","), (entry) => {
    const type = entry.trim();
    if (type.startsWith(".")) {
      return extension === type.toLowerCase();
    }
    if (!file.type) {
      return false;
    }
    if (type.endsWith("/*")) {
      return file.type.startsWith(`${type.split("/")[0]}/`);
    }
    return file.type === type;
  });
}

const validateFile = Effect.fn("fileUpload.validateFile")(function* (
  file: File,
  accept: string,
  maxSize: number
) {
  if (file.size > maxSize) {
    return yield* FileSizeError.make({ maxSize });
  }
  if (!acceptsFile(file, accept)) {
    return yield* FileTypeError.make({ fileName: file.name });
  }
  return file;
});

/** Checks batch limits first, skips existing duplicates, and preserves per-file failures. */
export const selectFileBatch = Effect.fn("fileUpload.selectBatch")(function* ({
  accept,
  currentFiles,
  files,
  maxFiles,
  maxSize,
  multiple,
}: {
  accept: string;
  currentFiles: readonly Pick<File, "name" | "size">[];
  files: readonly File[];
  maxFiles: number;
  maxSize: number;
  multiple: boolean;
}) {
  if (multiple && currentFiles.length + files.length > maxFiles) {
    return yield* FileCountError.make({ maxFiles });
  }

  const candidates = Arr.filter(
    files,
    (file) =>
      !(
        multiple &&
        Arr.some(
          currentFiles,
          (existing) =>
            existing.name === file.name && existing.size === file.size
        )
      )
  );
  const outcomes = yield* Effect.forEach(candidates, (file) =>
    Effect.result(validateFile(file, accept, maxSize))
  );
  const [accepted, errors] = Arr.separate(outcomes);
  return { files: accepted, errors };
});
