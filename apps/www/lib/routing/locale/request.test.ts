import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { requestLocalizedHref } from "@/lib/routing/locale/request";

const CURRENT_HREF = "/en/quran/2?verse=3#top";

/** Resolves one href through the module's own client with a controlled fetch. */
function request(fetcher: typeof fetch) {
  return requestLocalizedHref({ href: CURRENT_HREF, locale: "id" }).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

describe("requestLocalizedHref", () => {
  it.effect("asks the route-owned endpoint for the chosen locale", () =>
    Effect.gen(function* () {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ href: "/id/quran/2" }));
      const endpoint = new URL(
        "/api/internal/routing/locale",
        window.location.href
      );
      endpoint.searchParams.set("href", CURRENT_HREF);
      endpoint.searchParams.set("locale", "id");

      expect(yield* request(fetcher)).toEqual({ href: "/id/quran/2" });
      expect(fetcher).toHaveBeenCalledOnce();
      expect(fetcher).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          headers: expect.objectContaining({ accept: "application/json" }),
          method: "GET",
        })
      );
    })
  );
  it.effect.each([
    ["a refused request", () => Response.json({}, { status: 404 })],
    ["a response outside the contract", () => Response.json({ path: "/id" })],
    ["a response that is not JSON", () => new Response("<html>")],
  ] as const)("fails with a typed error on %s", ([, respond]) =>
    Effect.gen(function* () {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(respond());
      const error = yield* request(fetcher).pipe(Effect.flip);
      expect(error._tag).toBe("LocalizedHrefRequestError");
    })
  );
  it.effect("fails with a typed error when the request cannot be sent", () =>
    Effect.gen(function* () {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockRejectedValue(new TypeError("offline"));
      const error = yield* request(fetcher).pipe(Effect.flip);
      expect(error._tag).toBe("LocalizedHrefRequestError");
    })
  );
});
