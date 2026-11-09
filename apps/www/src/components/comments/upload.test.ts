import { afterEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { COMMENT_PHOTO_BYTE_LIMIT } from "@repo/backend/confect/comments/photo";
import { Array as Arr, Effect, Result, Schema } from "effect";
import { PhotoRefused, uploadPhoto } from "@/components/comments/upload";

const bucketFile = Schema.decodeUnknownSync(Id("bucketFiles"));
const commentUpload = Schema.decodeUnknownSync(Id("commentUploads"));

const putFile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/files/put", () => ({ putFile }));

/** A browser that draws a picture of 4,000 by 3,000 pixels and encodes it as `type`. */
const paintable = (type: string) => {
  class FakeCanvas {
    readonly context = { drawImage: vi.fn() };
    readonly width: number;
    constructor(width: number) {
      this.width = width;
    }
    getContext() {
      return this.context;
    }
    convertToBlob() {
      return Promise.resolve(new Blob([new Uint8Array(this.width)], { type }));
    }
  }
  vi.stubGlobal("OffscreenCanvas", FakeCanvas);
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(() => Promise.resolve({ close: vi.fn(), height: 3000, width: 4000 }))
  );
};

/** The calls of the page's client: each reservation answers the next file, and the register its upload. */
const client = () => {
  const reserve = vi.fn((_bytes: Blob, _contentType: string) =>
    Promise.resolve(
      Result.succeed({
        address: `https://r2.test/${reserve.mock.calls.length}`,
        fileId: bucketFile(`file-${reserve.mock.calls.length}`),
      })
    )
  );
  const register = vi.fn(() =>
    Promise.resolve(Result.succeed(commentUpload("upload")))
  );
  /** The type each reservation declared, in order. */
  const reserved = () =>
    Arr.map(reserve.mock.calls, ([, contentType]) => contentType);
  return { register, reserve, reserved };
};

afterEach(() => {
  vi.unstubAllGlobals();
  putFile.mockReset();
});

describe("comments/upload", () => {
  it.effect(
    "sends a photo shrunk with its small copy, and registers both",
    () =>
      Effect.gen(function* () {
        paintable("image/webp");
        putFile.mockReturnValue(Effect.void);
        const { register, reserve, reserved } = client();
        const file = new File([new Uint8Array(1_000_000)], "foto.jpg", {
          type: "image/jpeg",
        });

        const sent = yield* uploadPhoto(file, reserve, register);

        expect(sent).toEqual({ height: 1200, upload: "upload", width: 1600 });
        expect(reserved()).toEqual(["image/webp", "image/webp"]);
        expect(register).toHaveBeenCalledWith({
          fileId: "file-1",
          height: 1200,
          thumbnailId: "file-2",
          width: 1600,
        });
      })
  );

  it.effect("sends a GIF as it is, measured, with no small copy", () =>
    Effect.gen(function* () {
      paintable("image/webp");
      putFile.mockReturnValue(Effect.void);
      const { register, reserve, reserved } = client();
      const file = new File([new Uint8Array(10)], "gerak.gif", {
        type: "image/gif",
      });

      const sent = yield* uploadPhoto(file, reserve, register);

      expect(sent).toEqual({ height: 3000, upload: "upload", width: 4000 });
      expect(reserved()).toEqual(["image/gif"]);
      expect(register).toHaveBeenCalledWith({
        fileId: "file-1",
        height: 3000,
        thumbnailId: null,
        width: 4000,
      });
    })
  );

  it.effect(
    "refuses a file that is no image, a GIF past the limit, and an encoding the browser gives no image type",
    () =>
      Effect.gen(function* () {
        const { register, reserve } = client();
        const pdf = new File([new Uint8Array(10)], "soal.pdf", {
          type: "application/pdf",
        });
        expect(yield* Effect.flip(uploadPhoto(pdf, reserve, register))).toEqual(
          new PhotoRefused({ reason: "type" })
        );
        const gif = new File(
          [new Uint8Array(COMMENT_PHOTO_BYTE_LIMIT + 1)],
          "besar.gif",
          { type: "image/gif" }
        );
        expect(yield* Effect.flip(uploadPhoto(gif, reserve, register))).toEqual(
          new PhotoRefused({ reason: "size" })
        );
        paintable("");
        const photo = new File([new Uint8Array(1_000_000)], "foto.png", {
          type: "image/png",
        });
        expect(
          yield* Effect.flip(uploadPhoto(photo, reserve, register))
        ).toEqual(new PhotoRefused({ reason: "type" }));
        expect(reserve).not.toHaveBeenCalled();
      })
  );
});
