import { afterEach, describe, expect, it, vi } from "@effect/vitest";
import {
  BrowserFileDownloadError,
  downloadFile,
} from "@repo/design-system/lib/files/download";
import { Effect } from "effect";

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
  it.effect("downloads string content and releases temporary resources", () =>
    Effect.gen(function* () {
      const { createObjectURL, revokeObjectURL } = installUrlBoundary();
      const click = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => undefined);
      const remove = vi.spyOn(Element.prototype, "remove");

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

  it.effect("preserves Blob content without rebuilding it", () =>
    Effect.gen(function* () {
      const { createObjectURL } = installUrlBoundary();
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
        () => undefined
      );
      const content = new Blob(["binary"], {
        type: "application/octet-stream",
      });

      yield* downloadFile({ ...DOWNLOAD, content });

      expect(createObjectURL).toHaveBeenCalledExactlyOnceWith(content);
    })
  );

  it.effect("maps object URL failures into the typed error channel", () =>
    Effect.gen(function* () {
      const { createObjectURL, revokeObjectURL } = installUrlBoundary();
      const cause = new Error("Object URL unavailable.");
      createObjectURL.mockImplementation(() => {
        throw cause;
      });

      const error = yield* downloadFile(DOWNLOAD).pipe(Effect.flip);

      expectDownloadError(error, cause);
      expect(revokeObjectURL).not.toHaveBeenCalled();
    })
  );

  it.effect("revokes the object URL when attaching the anchor fails", () =>
    Effect.gen(function* () {
      const { revokeObjectURL } = installUrlBoundary();
      const cause = new Error("Document body unavailable.");
      vi.spyOn(document.body, "append").mockImplementation(() => {
        throw cause;
      });

      const error = yield* downloadFile(DOWNLOAD).pipe(Effect.flip);

      expectDownloadError(error, cause);
      expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
        "blob:nakafa-download"
      );
    })
  );

  it.effect(
    "removes the anchor and revokes the URL when activation fails",
    () =>
      Effect.gen(function* () {
        const { revokeObjectURL } = installUrlBoundary();
        const cause = new Error("Download activation blocked.");
        const remove = vi.spyOn(Element.prototype, "remove");
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
          () => {
            throw cause;
          }
        );

        const error = yield* downloadFile(DOWNLOAD).pipe(Effect.flip);

        expectDownloadError(error, cause);
        expect(remove).toHaveBeenCalledOnce();
        expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
          "blob:nakafa-download"
        );
      })
  );

  it.effect("reports anchor cleanup failures and still revokes the URL", () =>
    Effect.gen(function* () {
      const { revokeObjectURL } = installUrlBoundary();
      const cause = new Error("Anchor cleanup failed.");
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
        () => undefined
      );
      vi.spyOn(Element.prototype, "remove").mockImplementation(() => {
        throw cause;
      });

      const error = yield* downloadFile(DOWNLOAD).pipe(Effect.flip);

      expectDownloadError(error, cause);
      expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
        "blob:nakafa-download"
      );
    })
  );

  it.effect("reports object URL cleanup failures", () =>
    Effect.gen(function* () {
      const { revokeObjectURL } = installUrlBoundary();
      const cause = new Error("Object URL cleanup failed.");
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
        () => undefined
      );
      revokeObjectURL.mockImplementation(() => {
        throw cause;
      });

      const error = yield* downloadFile(DOWNLOAD).pipe(Effect.flip);

      expectDownloadError(error, cause);
    })
  );
});
