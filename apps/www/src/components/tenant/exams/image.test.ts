import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Effect, Result, Schema } from "effect";
import { storeExamImage } from "@/components/tenant/exams/image";

/** The upload to R2, which a test answers without a network. */
const putFile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/files/put", () => ({ putFile }));

/** The ID of the image that the server registers. */
const ASSET = Schema.decodeUnknownSync(Id("examAssets"))("asset-1");

/** A register that answers the image it would store, for a test that no refusal reaches. */
const registered = () => Promise.resolve(Result.succeed({ id: ASSET }));

/** A PNG file the teacher chose, whose bytes the browser decodes. */
const chosen = () => new File(["png"], "segitiga.png", { type: "image/png" });

/** The file that `exams.assets.reserve` reserves, with the R2 address its bytes go to. */
const reserve = () =>
  Promise.resolve(
    Result.succeed({
      address: "https://r2.test/file",
      fileId: Schema.decodeUnknownSync(Id("bucketFiles"))("file-1"),
    })
  );

describe("storeExamImage", () => {
  it.effect(
    "refuses a file the browser cannot decode before it reserves a file",
    () =>
      Effect.gen(function* () {
        vi.stubGlobal(
          "createImageBitmap",
          vi.fn(() => Promise.reject(new Error("truncated")))
        );
        const asked = vi.fn(reserve);
        const refusal = yield* storeExamImage({
          file: chosen(),
          register: registered,
          reserve: asked,
        }).pipe(Effect.flip);
        expect(refusal).toMatchObject({ _tag: "ImageUnreadable" });
        expect(asked).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
      })
  );

  it.effect(
    "refuses a file that decodes to no size, before it reserves a file",
    () =>
      Effect.gen(function* () {
        vi.stubGlobal(
          "createImageBitmap",
          vi.fn(() => Promise.resolve({ close: vi.fn(), height: 0, width: 0 }))
        );
        const asked = vi.fn(reserve);
        const refusal = yield* storeExamImage({
          file: chosen(),
          register: registered,
          reserve: asked,
        }).pipe(Effect.flip);
        expect(refusal).toMatchObject({ _tag: "ImageUnreadable" });
        expect(asked).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
      })
  );

  it.effect(
    "reserves a decodable file, sends its bytes to R2, then registers the stored file with its size",
    () =>
      Effect.gen(function* () {
        vi.stubGlobal(
          "createImageBitmap",
          vi.fn(() => Promise.resolve({ close: vi.fn(), height: 2, width: 3 }))
        );
        putFile.mockReturnValue(Effect.void);
        const file = chosen();
        const register = vi.fn(registered);
        const stored = yield* storeExamImage({
          file,
          register,
          reserve,
        });
        expect(stored).toEqual({ height: 2, id: "asset-1", width: 3 });
        expect(register).toHaveBeenCalledWith({
          fileId: "file-1",
          height: 2,
          width: 3,
        });
        expect(putFile).toHaveBeenCalledWith("https://r2.test/file", file);
        vi.unstubAllGlobals();
      })
  );
});
