import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, Result, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { storeExamImage } from "@/components/tenant/exams/image.client";

/** The ID of the image that the server registers. */
const ASSET = Schema.decodeUnknownSync(Id("examAssets"))("asset-1");

/** A register that answers the image it would store, for a test that no refusal reaches. */
const registered = () => Promise.resolve(Result.succeed({ id: ASSET }));

/** A PNG file the teacher chose, whose bytes the browser decodes. */
const chosen = () =>
  new File(["png"], "segitiga.png", { type: "image/png" });

/** The address that `exams.assets.uploadUrl` answers with. */
const requestUrl = () =>
  Promise.resolve(Result.succeed(new URL("https://upload.test/file")));

describe("storeExamImage", () => {
  it.effect(
    "refuses a file the browser cannot decode before it asks for an upload address",
    () =>
      Effect.gen(function* () {
        vi.stubGlobal(
          "createImageBitmap",
          vi.fn(() => Promise.reject(new Error("truncated")))
        );
        const asked = vi.fn(requestUrl);
        const refusal = yield* storeExamImage({
          file: chosen(),
          register: registered,
          requestUrl: asked,
        }).pipe(Effect.flip);
        expect(refusal).toMatchObject({ _tag: "ImageUnreadable" });
        expect(asked).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
      })
  );

  it.effect(
    "refuses a file that decodes to no size, before it asks for an upload address",
    () =>
      Effect.gen(function* () {
        vi.stubGlobal(
          "createImageBitmap",
          vi.fn(() => Promise.resolve({ close: vi.fn(), height: 0, width: 0 }))
        );
        const asked = vi.fn(requestUrl);
        const refusal = yield* storeExamImage({
          file: chosen(),
          register: registered,
          requestUrl: asked,
        }).pipe(Effect.flip);
        expect(refusal).toMatchObject({ _tag: "ImageUnreadable" });
        expect(asked).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
      })
  );

  it.effect(
    "sends a decodable file to its address, then registers the stored file with its size",
    () =>
      Effect.gen(function* () {
        vi.stubGlobal(
          "createImageBitmap",
          vi.fn(() => Promise.resolve({ close: vi.fn(), height: 2, width: 3 }))
        );
        const fetcher = vi.fn<typeof fetch>(() =>
          Promise.resolve(
            new Response(encodeJsonText({ storageId: "store-1" }), {
              headers: { "content-type": "application/json" },
              status: 200,
            })
          )
        );
        const register = vi.fn(registered);
        const stored = yield* storeExamImage({
          file: chosen(),
          register,
          requestUrl,
        }).pipe(Effect.provideService(FetchHttpClient.Fetch, fetcher));
        expect(stored).toEqual({ height: 2, id: "asset-1", width: 3 });
        expect(register).toHaveBeenCalledWith({
          height: 2,
          storageId: "store-1",
          width: 3,
        });
        expect(fetcher).toHaveBeenCalledTimes(1);
        vi.unstubAllGlobals();
      })
  );
});
