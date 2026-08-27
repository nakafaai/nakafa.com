import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { GET } from "./route";

describe("retired content graph API route", () => {
  it.effect(
    "returns an explicit successor instead of changing the legacy schema",
    () =>
      Effect.gen(function* () {
        const contentId = "asset:en:article:politics:article:example";
        const response = yield* Effect.promise(() =>
          GET(new Request(`http://localhost/contents/graph/${contentId}`), {
            params: Promise.resolve({ contentId }),
          })
        );
        const successor = `/contents/reference/${encodeURIComponent(contentId)}`;

        expect(response.status).toBe(410);
        expect(response.headers.get("Link")).toBe(
          `<${successor}>; rel="successor-version"`
        );
        const body = yield* Effect.promise(() => response.json());
        expect(body).toEqual({
          error: "The legacy content graph contract has been retired.",
          successor,
        });
      })
  );
});
