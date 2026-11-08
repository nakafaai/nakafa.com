// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { readBrowserPresence } from "@/lib/auth/presence";

/** One fetch double for the whole file: the browser's request to the token route. */
const fetcher = vi.fn<typeof fetch>();

const ORIGIN = "https://harapan.nakafa.com";

beforeEach(() => {
  fetcher.mockReset();
});

describe("browser presence", () => {
  it.each([
    ["nakafa-signed-in=1", true],
    ["theme=dark; nakafa-signed-in=1", true],
    ["nakafa-signed-in=", false],
    ["", false],
  ])("reads the cookie %j as signed in: %s", (cookie, signedIn) => {
    expect(readBrowserPresence(cookie, ORIGIN).signedIn).toBe(signedIn);
  });

  it.effect(
    "reads the token from the token route of the page's own origin, and nothing before it runs",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(Response.json({ token: "token-ayu" }));
        const presence = readBrowserPresence("", ORIGIN);
        expect(fetcher).not.toHaveBeenCalled();

        expect(
          yield* presence.token.pipe(
            Effect.provideService(FetchHttpClient.Fetch, fetcher)
          )
        ).toBe("token-ayu");
        const [address] = fetcher.mock.calls[0] ?? [];
        expect(String(address)).toBe(`${ORIGIN}/api/auth/convex/token`);
      })
  );

  it.effect("reads a visitor's token as none", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(new Response(null, { status: 401 }));

      expect(
        yield* readBrowserPresence("nakafa-signed-in=1", ORIGIN).token.pipe(
          Effect.provideService(FetchHttpClient.Fetch, fetcher)
        )
      ).toBeUndefined();
    })
  );
});
