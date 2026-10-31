import { afterEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { LIBRARY_BYTE_LIMIT } from "@repo/backend/confect/classroom/library/file";
import { Effect, Result, Schema } from "effect";
import {
  FileTooLarge,
  fitted,
  isPhoto,
  shrinkPhoto,
  uploadAttachment,
} from "@/components/tenant/classes/forum/upload";

const storage = Schema.decodeUnknownSync(Id("_storage"));

const sendStorageFile = vi.hoisted(() => vi.fn());
vi.mock("@/components/tenant/exams/image", () => ({ sendStorageFile }));

/** What this browser encodes: `webp` false stands for a browser that answers PNG for WebP. */
const paintable = (webp: boolean) => {
  const drawImage = vi.fn();
  const close = vi.fn();
  vi.stubGlobal(
    "OffscreenCanvas",
    vi.fn((width: number) => ({
      convertToBlob: ({ type }: { readonly type: string }) =>
        Promise.resolve(
          new Blob([new Uint8Array(width)], {
            type: type === "image/webp" && !webp ? "image/png" : type,
          })
        ),
      getContext: () => ({ drawImage }),
    }))
  );
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(() => Promise.resolve({ close, height: 3000, width: 4000 }))
  );
  return { close, drawImage };
};

afterEach(() => {
  vi.unstubAllGlobals();
  sendStorageFile.mockReset();
});

describe("fitted", () => {
  it("fits a picture inside its edge, never grows one, and never reaches zero", () => {
    expect(fitted(4000, 3000, 1600)).toEqual({ height: 1200, width: 1600 });
    expect(fitted(300, 200, 1600)).toEqual({ height: 200, width: 300 });
    expect(fitted(9000, 1, 1600)).toEqual({ height: 1, width: 1600 });
  });
});

describe("isPhoto", () => {
  it("shrinks a still photo, and keeps a GIF and a document as they are", () => {
    expect(isPhoto({ type: "image/jpeg" })).toBe(true);
    expect(isPhoto({ type: "image/gif" })).toBe(false);
    expect(isPhoto({ type: "application/pdf" })).toBe(false);
  });
});

describe("shrinkPhoto", () => {
  it.effect(
    "draws a large photo at both sizes in WebP and frees its bitmap",
    () =>
      Effect.gen(function* () {
        const { close, drawImage } = paintable(true);
        const file = new File([new Uint8Array(5000)], "foto.jpg", {
          type: "image/jpeg",
        });
        const photo = yield* shrinkPhoto(file);
        expect(photo).toMatchObject({ height: 1200, width: 1600 });
        expect(photo.full.type).toBe("image/webp");
        expect(photo.small.size).toBe(480);
        expect(drawImage).toHaveBeenCalledTimes(2);
        expect(close).toHaveBeenCalledOnce();
      })
  );

  it.effect(
    "falls back to JPEG, and keeps a photo smaller than its encoded form",
    () =>
      Effect.gen(function* () {
        paintable(false);
        const small = new File([new Uint8Array(10)], "ikon.png", {
          type: "image/png",
        });
        const photo = yield* shrinkPhoto(small);
        expect(photo.full).toBe(small);
        expect(photo.small.type).toBe("image/jpeg");
      })
  );
});

describe("uploadAttachment", () => {
  const url = new URL("https://upload.example.test");
  const requestUrl = () => Promise.resolve(Result.succeed(url));

  it.effect("sends a document as it is, with nothing a photo carries", () =>
    Effect.gen(function* () {
      sendStorageFile.mockReturnValue(Effect.succeed(storage("file-1")));
      const register = vi.fn(() => Promise.resolve(Result.succeed("kept")));
      const file = new File(["%PDF"], "soal.pdf", { type: "application/pdf" });
      const answer = yield* uploadAttachment(file, requestUrl, register);
      expect(answer).toEqual({ height: null, registered: "kept", width: null });
      expect(register).toHaveBeenCalledWith({
        height: null,
        storageId: "file-1",
        thumbnailId: null,
        width: null,
      });
      expect(sendStorageFile).toHaveBeenCalledWith(url, file);
    })
  );

  it.effect("sends a photo shrunk, with its small copy and its size", () =>
    Effect.gen(function* () {
      paintable(true);
      sendStorageFile
        .mockReturnValueOnce(Effect.succeed(storage("file-1")))
        .mockReturnValueOnce(Effect.succeed(storage("file-2")));
      const register = vi.fn(() => Promise.resolve(Result.succeed("kept")));
      const file = new File([new Uint8Array(5000)], "foto.jpg", {
        type: "image/jpeg",
      });
      const answer = yield* uploadAttachment(file, requestUrl, register);
      expect(answer).toEqual({ height: 1200, registered: "kept", width: 1600 });
      expect(register).toHaveBeenCalledWith({
        height: 1200,
        storageId: "file-1",
        thumbnailId: "file-2",
        width: 1600,
      });
    })
  );

  it.effect("refuses a file past the limit before it sends a byte", () =>
    Effect.gen(function* () {
      const file = new File([], "video.pdf");
      Object.defineProperty(file, "size", { value: LIBRARY_BYTE_LIMIT + 1 });
      const failure = yield* Effect.flip(
        uploadAttachment(file, requestUrl, () =>
          Promise.resolve(Result.succeed("kept"))
        )
      );
      expect(failure).toBeInstanceOf(FileTooLarge);
      expect(sendStorageFile).not.toHaveBeenCalled();
    })
  );
});
