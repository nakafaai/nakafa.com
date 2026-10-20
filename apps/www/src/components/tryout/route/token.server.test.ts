// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readRequestToken } from "@/components/tryout/route/token.server";

const auth = vi.hoisted(() => ({ readSessionToken: vi.fn() }));

vi.mock("@/env", () => ({
  env: { VITE_CONVEX_SITE_URL: "https://site.nakafa.test" },
}));
vi.mock("@/lib/auth/token", () => ({
  readSessionToken: auth.readSessionToken,
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () =>
    new Request("https://nakafa.test/en/try-out", {
      headers: { cookie: "session=1" },
    }),
}));

describe("readRequestToken", () => {
  it.effect(
    "reads the visitor's session token from the site's auth endpoint",
    () =>
      Effect.gen(function* () {
        auth.readSessionToken.mockReturnValueOnce(Effect.succeed("token-1"));

        expect(yield* readRequestToken()).toBe("token-1");
        expect(auth.readSessionToken).toHaveBeenCalledExactlyOnceWith(
          "https://site.nakafa.test",
          expect.any(Headers)
        );
      })
  );

  it.effect("answers no token for a visitor without a session", () =>
    Effect.gen(function* () {
      auth.readSessionToken.mockReturnValueOnce(Effect.void);

      expect(yield* readRequestToken()).toBeUndefined();
    })
  );
});
