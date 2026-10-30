// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { readBrowserSessionToken } from "@/lib/auth/token";

const ORIGIN = "https://harapan.nakafa.com";

/** One fetch double for the whole file, provided to the module's own client. */
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  fetcher.mockReset();
});

/** Reads the token in a browser on this file's origin, through this file's fetch double. */
function readToken() {
  return readBrowserSessionToken(ORIGIN).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

describe("readBrowserSessionToken", () => {
  it.effect("reads the token from the token route of the page's own host", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(Response.json({ token: "token-value" }));

      expect(yield* readToken()).toBe("token-value");
      const [url, init] = fetcher.mock.calls[0] ?? [];
      expect(String(url)).toBe(`${ORIGIN}/api/auth/convex/token`);
      expect(init?.method).toBe("GET");
    })
  );

  it.effect("answers no token for a visitor with no session", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(new Response(null, { status: 401 }));

      expect(yield* readToken()).toBeUndefined();
      expect(fetcher).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "answers no token when the route answers a null token, as it does for a visitor's read",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(Response.json({ token: null }));

        expect(yield* readToken()).toBeUndefined();
        expect(fetcher).toHaveBeenCalledOnce();
      })
  );

  it.effect("fails on a 200 that carries no token field", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(Response.json({}));

      const error = yield* Effect.flip(readToken());

      expect(error.reason).toBe("body");
    })
  );
});
