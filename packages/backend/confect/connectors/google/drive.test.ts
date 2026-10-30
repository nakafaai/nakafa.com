import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  driveBytes,
  driveFile,
} from "@repo/backend/confect/connectors/google/drive";
import { FetchClient } from "@repo/utilities/http/client";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

/** One JSON answer of Google. */
const json = (status: number, body: object) =>
  new Response(encodeJsonText(body), {
    headers: { "content-type": "application/json" },
    status,
  });

/** Runs one Google read through the stubbed fetch. */
const google = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provide(FetchClient),
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );

/** The address and headers of the one request the read sent. */
const sent = () => {
  const [url, init] = fetcher.mock.calls[0] ?? [];
  return { headers: new Headers(init?.headers), url: new URL(String(url)) };
};

describe("connectors/google/drive", () => {
  beforeEach(() => {
    fetcher.mockReset();
  });

  it.effect(
    "reads a picked file's name, type, and size with the bearer token, and a Google document without a size",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(
          json(200, {
            mimeType: "application/pdf",
            name: "Modul.pdf",
            size: "2048",
          })
        );
        expect(yield* google(driveFile("access", "file/1"))).toEqual({
          mimeType: "application/pdf",
          name: "Modul.pdf",
          size: 2048,
        });
        const { headers, url } = sent();
        expect(url.pathname).toBe("/drive/v3/files/file%2F1");
        expect(url.searchParams.get("fields")).toBe("mimeType,name,size");
        expect(headers.get("authorization")).toBe("Bearer access");
        fetcher.mockResolvedValueOnce(
          json(200, {
            mimeType: "application/vnd.google-apps.document",
            name: "Catatan",
          })
        );
        expect(yield* google(driveFile("access", "doc"))).toEqual({
          mimeType: "application/vnd.google-apps.document",
          name: "Catatan",
        });
      })
  );

  it.effect("reads the bytes of a picked file as media", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(new Response("%PDF-1.7"));
      const bytes = yield* google(driveBytes("access", "file-1"));
      expect(new TextDecoder().decode(bytes)).toBe("%PDF-1.7");
      expect(sent().url.searchParams.get("alt")).toBe("media");
    })
  );

  it.effect(
    "fails as revoked when Google refuses the token, refused for a file it does not give, invalid for an answer it cannot read, and unreached when no answer arrives",
    () =>
      Effect.gen(function* () {
        const failure = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
          google(effect).pipe(Effect.flip);
        fetcher.mockResolvedValueOnce(json(401, {}));
        expect(yield* failure(driveFile("access", "file-1"))).toMatchObject({
          reason: "revoked",
          status: 401,
        });
        fetcher.mockResolvedValueOnce(json(404, {}));
        expect(yield* failure(driveBytes("access", "file-1"))).toMatchObject({
          reason: "refused",
          status: 404,
        });
        fetcher.mockResolvedValueOnce(new Response("<html>"));
        expect(yield* failure(driveFile("access", "file-1"))).toMatchObject({
          reason: "invalid",
        });
        fetcher.mockRejectedValueOnce(new TypeError("fetch failed"));
        expect(yield* failure(driveFile("access", "file-1"))).toMatchObject({
          reason: "unreached",
        });
        fetcher.mockResolvedValueOnce(
          new Response(
            new ReadableStream({
              start: (controller) => controller.error(new Error("reset")),
            })
          )
        );
        expect(yield* failure(driveBytes("access", "file-1"))).toMatchObject({
          reason: "unreached",
        });
      })
  );
});
