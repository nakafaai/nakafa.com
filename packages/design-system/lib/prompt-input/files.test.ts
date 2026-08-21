import {
  convertPromptInputFiles,
  PromptInputAttachmentConversionError,
  type PromptInputFile,
  PromptInputFileConstraintError,
  validatePromptInputFiles,
} from "@repo/design-system/lib/prompt-input/files";
import { afterEach, describe, expect, it } from "@repo/testing/effect";
import { Effect, Fiber } from "effect";
import { vi } from "vitest";

const BLOB_URL = "blob:https://nakafa.test/attachment";
const DATA_URL = "data:text/plain;base64,bmFrYWZh";
const image = new File(["image"], "lesson.png", { type: "image/png" });
const text = new File(["lesson"], "lesson.txt", { type: "text/plain" });

/** Builds one existing prompt attachment with an overridable source URL. */
function createPromptFile(url = BLOB_URL): PromptInputFile {
  return {
    filename: "lesson.txt",
    id: "attachment-1",
    mediaType: "text/plain",
    type: "file",
    url,
  };
}

class SuccessfulFileReader extends EventTarget {
  result: string | ArrayBuffer | null = null;

  /** Completes a file read with a valid data URL. */
  readAsDataURL() {
    this.result = DATA_URL;
    this.dispatchEvent(new Event("loadend"));
  }
}

class InvalidResultFileReader extends EventTarget {
  result: string | ArrayBuffer | null = new ArrayBuffer(0);

  /** Completes a file read with an unsupported result shape. */
  readAsDataURL() {
    this.dispatchEvent(new Event("loadend"));
  }
}

class FailedFileReader extends EventTarget {
  error = new DOMException("Attachment could not be read.");
  result: string | ArrayBuffer | null = null;

  /** Emits the browser file-reader failure event. */
  readAsDataURL() {
    this.dispatchEvent(new Event("error"));
  }
}

class EmptyErrorFileReader extends EventTarget {
  error: DOMException | null = null;
  result: string | ArrayBuffer | null = null;

  /** Emits a failure without an accompanying browser error value. */
  readAsDataURL() {
    this.dispatchEvent(new Event("error"));
  }
}

/** Installs successful fetch and FileReader boundaries for conversion tests. */
function stubSuccessfulConversion() {
  const blob = new Blob(["nakafa"], { type: "text/plain" });
  const readBlob = vi.fn().mockResolvedValue(blob);
  const fetchAttachment = vi.fn().mockResolvedValue({ blob: readBlob });
  vi.stubGlobal("FileReader", SuccessfulFileReader);
  vi.stubGlobal("fetch", fetchAttachment);
  return { fetchAttachment, readBlob };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("prompt input file selection", () => {
  it.live("keeps unconstrained and MIME-matched selections", () =>
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

  it.live("matches wildcard media types and filename extensions", () =>
    Effect.gen(function* () {
      const result = yield* validatePromptInputFiles({
        accept: "image/*, .txt",
        currentFileCount: 0,
        files: [image, text],
      });

      expect(result).toEqual({ files: [image, text] });
    })
  );

  it.live("rejects a selection without an accepted file type", () =>
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

  it.live("rejects a selection whose accepted files are all oversized", () =>
    Effect.gen(function* () {
      const error = yield* validatePromptInputFiles({
        currentFileCount: 0,
        files: [image],
        maxFileSize: 1,
      }).pipe(Effect.flip);

      expect(error.code).toBe("max_file_size");
    })
  );

  it.live(
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

  it.live("caps available capacity and returns a typed warning", () =>
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

describe("prompt input attachment conversion", () => {
  it.live("keeps remote attachments unchanged", () =>
    Effect.gen(function* () {
      const file = createPromptFile("https://nakafa.test/lesson.txt");
      const converted = yield* convertPromptInputFiles([file]);

      expect(converted).toEqual([
        {
          filename: file.filename,
          mediaType: file.mediaType,
          type: "file",
          url: file.url,
        },
      ]);
    })
  );

  it.live("converts blob attachments into data URLs", () =>
    Effect.gen(function* () {
      const { fetchAttachment, readBlob } = stubSuccessfulConversion();
      const converted = yield* convertPromptInputFiles([createPromptFile()]);

      expect(fetchAttachment).toHaveBeenCalledWith(
        BLOB_URL,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(readBlob).toHaveBeenCalledOnce();
      expect(converted[0]?.url).toBe(DATA_URL);
    })
  );

  it.live("types attachment fetch failures", () =>
    Effect.gen(function* () {
      const cause = new Error("Network unavailable.");
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(cause));

      const error = yield* convertPromptInputFiles([createPromptFile()]).pipe(
        Effect.flip
      );

      expect(error).toBeInstanceOf(PromptInputAttachmentConversionError);
      expect(error).toMatchObject({ cause, operation: "fetch" });
    })
  );

  it.live("types response blob failures", () =>
    Effect.gen(function* () {
      const cause = new Error("Response body unavailable.");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ blob: vi.fn().mockRejectedValue(cause) })
      );

      const error = yield* convertPromptInputFiles([createPromptFile()]).pipe(
        Effect.flip
      );

      expect(error).toMatchObject({ cause, operation: "read-blob" });
    })
  );

  it.live(
    "aborts the attachment request when blob reading is interrupted",
    () =>
      Effect.gen(function* () {
        let requestSignal: AbortSignal | undefined;
        const readBlob = vi.fn(() => new Promise<Blob>(() => undefined));
        vi.stubGlobal(
          "fetch",
          vi.fn((_url, init) => {
            requestSignal = init?.signal;
            return Promise.resolve({ blob: readBlob });
          })
        );
        const fiber = yield* Effect.forkChild(
          convertPromptInputFiles([createPromptFile()])
        );
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(readBlob).toHaveBeenCalledOnce())
        );
        yield* Fiber.interrupt(fiber);
        expect(requestSignal?.aborted).toBe(true);
      })
  );

  it.live("types FileReader construction failures", () =>
    Effect.gen(function* () {
      const cause = new Error("FileReader unavailable.");
      stubSuccessfulConversion();
      vi.stubGlobal(
        "FileReader",
        class {
          /** Simulates a browser that cannot construct a FileReader. */
          constructor() {
            throw cause;
          }
        }
      );

      const error = yield* convertPromptInputFiles([createPromptFile()]).pipe(
        Effect.flip
      );

      expect(error).toMatchObject({ cause, operation: "read-data-url" });
    })
  );

  it.live.each([
    [InvalidResultFileReader, ArrayBuffer],
    [FailedFileReader, DOMException],
  ])("types invalid FileReader results from %s", ([Reader, Cause]) =>
    Effect.gen(function* () {
      stubSuccessfulConversion();
      vi.stubGlobal("FileReader", Reader);

      const error = yield* convertPromptInputFiles([createPromptFile()]).pipe(
        Effect.flip
      );

      expect(error.operation).toBe("read-data-url");
      expect(error.cause).toBeInstanceOf(Cause);
    })
  );

  it.live("provides a cause when FileReader omits its error", () =>
    Effect.gen(function* () {
      stubSuccessfulConversion();
      vi.stubGlobal("FileReader", EmptyErrorFileReader);

      const error = yield* convertPromptInputFiles([createPromptFile()]).pipe(
        Effect.flip
      );

      expect(error).toMatchObject({
        cause: "FileReader failed without an error value.",
        operation: "read-data-url",
      });
    })
  );

  it.live.each([
    [1, 1],
    [2, 0],
  ])(
    "cleans up FileReader state %s when interrupted",
    ([readyState, expectedAbortCalls]) =>
      Effect.gen(function* () {
        let reader: PendingFileReader | undefined;
        class PendingFileReader extends EventTarget {
          static LOADING = 1;
          error: DOMException | null = null;
          result: string | ArrayBuffer | null = null;
          readyState = readyState;
          abort = vi.fn();

          /** Exposes the pending reader instance to the interruption assertion. */
          constructor() {
            super();
            reader = this;
          }

          /** Keeps the read pending until the Effect fiber is interrupted. */
          readAsDataURL() {
            return;
          }
        }

        stubSuccessfulConversion();
        vi.stubGlobal("FileReader", PendingFileReader);
        const fiber = yield* Effect.forkChild(
          convertPromptInputFiles([createPromptFile()])
        );
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(reader).toBeDefined())
        );
        yield* Fiber.interrupt(fiber);

        expect(reader?.abort).toHaveBeenCalledTimes(expectedAbortCalls);
      })
  );
});
