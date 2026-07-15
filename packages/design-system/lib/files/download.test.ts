import {
  BrowserFileDownloadError,
  downloadFile,
} from "@repo/design-system/lib/files/download";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const DOWNLOAD = {
  content: "const answer = 42;",
  filename: "answer.ts",
  mimeType: "text/plain",
};

function installUrlBoundary() {
  const createObjectURL = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValue("blob:nakafa-download");
  const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL");

  return { createObjectURL, revokeObjectURL };
}

function expectDownloadError(error: BrowserFileDownloadError, cause: Error) {
  expect(error).toBeInstanceOf(BrowserFileDownloadError);
  expect(error._tag).toBe("BrowserFileDownloadError");
  expect(error.cause).toBeInstanceOf(Error);
  if (error.cause instanceof Error) {
    expect(error.cause.message).toBe(cause.message);
  }
  expect(error.filename).toBe(DOWNLOAD.filename);
  expect(error.message).toBe("Failed to download answer.ts.");
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("browser file download", () => {
  it("downloads string content and releases temporary resources", () => {
    const { createObjectURL, revokeObjectURL } = installUrlBoundary();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const remove = vi.spyOn(Element.prototype, "remove");

    return Effect.runPromise(
      Effect.gen(function* () {
        yield* downloadFile(DOWNLOAD);

        const blob = createObjectURL.mock.calls[0]?.[0];
        expect(blob).toBeInstanceOf(Blob);
        if (blob instanceof Blob) {
          expect(blob.type).toBe(DOWNLOAD.mimeType);
        }
        expect(click).toHaveBeenCalledOnce();
        expect(remove).toHaveBeenCalledOnce();
        expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
          "blob:nakafa-download"
        );
        expect(document.body.children).toHaveLength(0);
      })
    );
  });

  it("preserves Blob content without rebuilding it", () => {
    const { createObjectURL } = installUrlBoundary();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined
    );
    const content = new Blob(["binary"], { type: "application/octet-stream" });

    return Effect.runPromise(
      Effect.gen(function* () {
        yield* downloadFile({ ...DOWNLOAD, content });

        expect(createObjectURL).toHaveBeenCalledExactlyOnceWith(content);
      })
    );
  });

  it("maps object URL failures into the typed error channel", () => {
    const { createObjectURL, revokeObjectURL } = installUrlBoundary();
    const cause = new Error("Object URL unavailable.");
    createObjectURL.mockImplementation(() => {
      throw cause;
    });

    return Effect.runPromise(
      Effect.gen(function* () {
        const error = yield* downloadFile(DOWNLOAD).pipe(Effect.flip);

        expectDownloadError(error, cause);
        expect(revokeObjectURL).not.toHaveBeenCalled();
      })
    );
  });

  it("revokes the object URL when attaching the anchor fails", () => {
    const { revokeObjectURL } = installUrlBoundary();
    const cause = new Error("Document body unavailable.");
    vi.spyOn(document.body, "append").mockImplementation(() => {
      throw cause;
    });

    return Effect.runPromise(
      Effect.gen(function* () {
        const error = yield* downloadFile(DOWNLOAD).pipe(Effect.flip);

        expectDownloadError(error, cause);
        expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
          "blob:nakafa-download"
        );
      })
    );
  });

  it("removes the anchor and revokes the URL when activation fails", () => {
    const { revokeObjectURL } = installUrlBoundary();
    const cause = new Error("Download activation blocked.");
    const remove = vi.spyOn(Element.prototype, "remove");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw cause;
    });

    return Effect.runPromise(
      Effect.gen(function* () {
        const error = yield* downloadFile(DOWNLOAD).pipe(Effect.flip);

        expectDownloadError(error, cause);
        expect(remove).toHaveBeenCalledOnce();
        expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
          "blob:nakafa-download"
        );
      })
    );
  });

  it("reports anchor cleanup failures and still revokes the URL", () => {
    const { revokeObjectURL } = installUrlBoundary();
    const cause = new Error("Anchor cleanup failed.");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined
    );
    vi.spyOn(Element.prototype, "remove").mockImplementation(() => {
      throw cause;
    });

    return Effect.runPromise(
      Effect.gen(function* () {
        const error = yield* downloadFile(DOWNLOAD).pipe(Effect.flip);

        expectDownloadError(error, cause);
        expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
          "blob:nakafa-download"
        );
      })
    );
  });

  it("reports object URL cleanup failures", () => {
    const { revokeObjectURL } = installUrlBoundary();
    const cause = new Error("Object URL cleanup failed.");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined
    );
    revokeObjectURL.mockImplementation(() => {
      throw cause;
    });

    return Effect.runPromise(
      Effect.gen(function* () {
        const error = yield* downloadFile(DOWNLOAD).pipe(Effect.flip);

        expectDownloadError(error, cause);
      })
    );
  });
});
