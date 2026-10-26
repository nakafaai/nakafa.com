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

/** Reads the token in a browser with this document cookie, through this file's fetch double. */
function readToken(cookie: string) {
  return readBrowserSessionToken(ORIGIN, cookie).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

describe("readBrowserSessionToken", () => {
  it.effect("sends no request when the browser holds no sign-in hint", () =>
    Effect.gen(function* () {
      expect(yield* readToken("theme=dark")).toBeUndefined();
      expect(fetcher).not.toHaveBeenCalled();
    })
  );

  it.effect("reads the token from the token route of the page's own host", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(Response.json({ token: "token-value" }));

      expect(yield* readToken("nakafa-signed-in=1")).toBe("token-value");
      const [url, init] = fetcher.mock.calls[0] ?? [];
      expect(String(url)).toBe(`${ORIGIN}/api/auth/convex/token`);
      expect(init?.method).toBe("GET");
    })
  );

  it.effect("answers no token when the route says the session ended", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(new Response(null, { status: 401 }));

      expect(yield* readToken("nakafa-signed-in=1")).toBeUndefined();
      expect(fetcher).toHaveBeenCalledOnce();
    })
  );
});
