import {
  convertPromptInputFiles,
  PromptInputAttachmentConversionError,
  type PromptInputFile,
  PromptInputFileConstraintError,
  validatePromptInputFiles,
} from "@repo/design-system/lib/prompt-input/files";
import { Effect, Fiber } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const BLOB_URL = "blob:https://nakafa.test/attachment";
const DATA_URL = "data:text/plain;base64,bmFrYWZh";
const image = new File(["image"], "lesson.png", { type: "image/png" });
const text = new File(["lesson"], "lesson.txt", { type: "text/plain" });
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
  readAsDataURL() {
    this.result = DATA_URL;
    this.dispatchEvent(new Event("loadend"));
  }
}

class InvalidResultFileReader extends EventTarget {
  result: string | ArrayBuffer | null = new ArrayBuffer(0);
  readAsDataURL() {
    this.dispatchEvent(new Event("loadend"));
  }
}

class FailedFileReader extends EventTarget {
  error = new DOMException("Attachment could not be read.");
  result: string | ArrayBuffer | null = null;
  readAsDataURL() {
    this.dispatchEvent(new Event("error"));
  }
}

class EmptyErrorFileReader extends EventTarget {
  error: DOMException | null = null;
  result: string | ArrayBuffer | null = null;
  readAsDataURL() {
    this.dispatchEvent(new Event("error"));
  }
}

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
  it("keeps unconstrained and MIME-matched selections", () => {
    const result = Effect.runSync(
      validatePromptInputFiles({ currentFileCount: 0, files: [image, text] })
    );
    const explicitlyAccepted = Effect.runSync(
      validatePromptInputFiles({
        accept: "text/plain",
        currentFileCount: 0,
        files: [text],
      })
    );

    expect(result).toEqual({ files: [image, text] });
    expect(explicitlyAccepted).toEqual({ files: [text] });
  });

  it("matches wildcard media types and filename extensions", () => {
    const result = Effect.runSync(
      validatePromptInputFiles({
        accept: "image/*, .txt",
        currentFileCount: 0,
        files: [image, text],
      })
    );

    expect(result).toEqual({ files: [image, text] });
  });

  it("rejects a selection without an accepted file type", () => {
    const error = Effect.runSync(
      validatePromptInputFiles({
        accept: "image/*",
        currentFileCount: 0,
        files: [text],
      }).pipe(Effect.flip)
    );

    expect(error).toBeInstanceOf(PromptInputFileConstraintError);
    expect(error.code).toBe("accept");
  });

  it("rejects a selection whose accepted files are all oversized", () => {
    const error = Effect.runSync(
      validatePromptInputFiles({
        currentFileCount: 0,
        files: [image],
        maxFileSize: 1,
      }).pipe(Effect.flip)
    );

    expect(error.code).toBe("max_file_size");
  });

  it("retains valid files when only part of a selection is oversized", () => {
    const small = new File(["a"], "small.txt", { type: "text/plain" });
    const result = Effect.runSync(
      validatePromptInputFiles({
        currentFileCount: 0,
        files: [small, text],
        maxFileSize: 2,
      })
    );

    expect(result).toEqual({ files: [small] });
  });

  it("caps available capacity and returns a typed warning", () => {
    const result = Effect.runSync(
      validatePromptInputFiles({
        currentFileCount: 1,
        files: [image, text],
        maxFiles: 2,
      })
    );

    expect(result.files).toEqual([image]);
    expect(result.warning).toBeInstanceOf(PromptInputFileConstraintError);
    expect(result.warning?.code).toBe("max_files");
  });
});

describe("prompt input attachment conversion", () => {
  it("keeps remote attachments unchanged", async () => {
    const file = createPromptFile("https://nakafa.test/lesson.txt");
    const converted = await Effect.runPromise(convertPromptInputFiles([file]));

    expect(converted).toEqual([
      {
        filename: file.filename,
        mediaType: file.mediaType,
        type: "file",
        url: file.url,
      },
    ]);
  });

  it("converts blob attachments into data URLs", async () => {
    const { fetchAttachment, readBlob } = stubSuccessfulConversion();
    const converted = await Effect.runPromise(
      convertPromptInputFiles([createPromptFile()])
    );

    expect(fetchAttachment).toHaveBeenCalledWith(
      BLOB_URL,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(readBlob).toHaveBeenCalledOnce();
    expect(converted[0]?.url).toBe(DATA_URL);
  });

  it("types attachment fetch failures", async () => {
    const cause = new Error("Network unavailable.");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(cause));

    const error = await Effect.runPromise(
      convertPromptInputFiles([createPromptFile()]).pipe(Effect.flip)
    );

    expect(error).toBeInstanceOf(PromptInputAttachmentConversionError);
    expect(error).toMatchObject({ cause, operation: "fetch" });
  });

  it("types response blob failures", async () => {
    const cause = new Error("Response body unavailable.");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ blob: vi.fn().mockRejectedValue(cause) })
    );

    const error = await Effect.runPromise(
      convertPromptInputFiles([createPromptFile()]).pipe(Effect.flip)
    );

    expect(error).toMatchObject({ cause, operation: "read-blob" });
  });

  it("aborts the attachment request when blob reading is interrupted", async () => {
    let requestSignal: AbortSignal | undefined;
    const readBlob = vi.fn(() => new Promise<Blob>(() => undefined));
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, init) => {
        requestSignal = init?.signal;
        return Promise.resolve({ blob: readBlob });
      })
    );
    const fiber = Effect.runFork(convertPromptInputFiles([createPromptFile()]));
    await vi.waitFor(() => expect(readBlob).toHaveBeenCalledOnce());
    await Effect.runPromise(Fiber.interrupt(fiber));
    expect(requestSignal?.aborted).toBe(true);
  });

  it("types FileReader construction failures", async () => {
    const cause = new Error("FileReader unavailable.");
    stubSuccessfulConversion();
    vi.stubGlobal(
      "FileReader",
      class {
        constructor() {
          throw cause;
        }
      }
    );

    const error = await Effect.runPromise(
      convertPromptInputFiles([createPromptFile()]).pipe(Effect.flip)
    );

    expect(error).toMatchObject({ cause, operation: "read-data-url" });
  });

  it.each([
    [InvalidResultFileReader, ArrayBuffer],
    [FailedFileReader, DOMException],
  ])("types invalid FileReader results from %s", async (Reader, Cause) => {
    stubSuccessfulConversion();
    vi.stubGlobal("FileReader", Reader);

    const error = await Effect.runPromise(
      convertPromptInputFiles([createPromptFile()]).pipe(Effect.flip)
    );

    expect(error.operation).toBe("read-data-url");
    expect(error.cause).toBeInstanceOf(Cause);
  });

  it("provides a cause when FileReader omits its error", async () => {
    stubSuccessfulConversion();
    vi.stubGlobal("FileReader", EmptyErrorFileReader);

    const error = await Effect.runPromise(
      convertPromptInputFiles([createPromptFile()]).pipe(Effect.flip)
    );

    expect(error).toMatchObject({
      cause: "FileReader failed without an error value.",
      operation: "read-data-url",
    });
  });

  it.each([
    [1, 1],
    [2, 0],
  ])("cleans up FileReader state %s when interrupted", async (readyState, expectedAbortCalls) => {
    let reader: PendingFileReader | undefined;
    class PendingFileReader extends EventTarget {
      static LOADING = 1;
      error: DOMException | null = null;
      result: string | ArrayBuffer | null = null;
      readyState = readyState;
      abort = vi.fn();

      constructor() {
        super();
        reader = this;
      }

      readAsDataURL() {
        return;
      }
    }

    stubSuccessfulConversion();
    vi.stubGlobal("FileReader", PendingFileReader);
    const fiber = Effect.runFork(convertPromptInputFiles([createPromptFile()]));
    await vi.waitFor(() => expect(reader).toBeDefined());
    await Effect.runPromise(Fiber.interrupt(fiber));

    expect(reader?.abort).toHaveBeenCalledTimes(expectedAbortCalls);
  });
});
