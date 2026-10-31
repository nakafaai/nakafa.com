// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  expiredHintCookie,
  hintScopeFor,
  signedInHintCookie,
} from "@/lib/auth/hint";
import {
  readRequestSignedInHint,
  withSessionHint,
} from "@/lib/auth/hint.server";

vi.hoisted(() => {
  vi.stubEnv("SITE_URL", "https://nakafa.com");
});

const mocks = vi.hoisted(() => ({
  cookie: vi.fn<() => string | null>(),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () =>
    new Request("https://nakafa.com/en/try-out", {
      headers: mocks.cookie() === null ? {} : { cookie: mocks.cookie() ?? "" },
    }),
}));

const hint = signedInHintCookie(hintScopeFor(new URL("https://nakafa.com")));

describe("request signed-in hint", () => {
  it("reads the hint from the request's cookies", () => {
    mocks.cookie.mockReturnValue(`theme=dark; ${hint}`);
    expect(readRequestSignedInHint()).toBe(true);
  });

  it("reports no hint for a request without the hint cookie", () => {
    mocks.cookie.mockReturnValue("theme=dark");
    expect(readRequestSignedInHint()).toBe(false);
  });

  it("reports no hint for a request without any cookies", () => {
    mocks.cookie.mockReturnValue(null);
    expect(readRequestSignedInHint()).toBe(false);
  });
});

describe("withSessionHint", () => {
  const scope = hintScopeFor(new URL("https://nakafa.com"));

  /** A session read, with the cookies that the browser sends. */
  function sessionRead(cookie?: string) {
    return new Request("https://nakafa.com/api/auth/get-session", {
      headers: cookie === undefined ? {} : { cookie },
    });
  }

  /** Better Auth's answer for a learner's session. */
  const signedIn = () =>
    Response.json({
      session: { id: "session-1" },
      user: { id: "user-1", name: "Ayu" },
    });

  it.effect("sets the hint on a signed-in answer to a request without it", () =>
    Effect.gen(function* () {
      const answer = yield* withSessionHint(
        sessionRead("theme=dark"),
        signedIn()
      );

      expect(answer.headers.getSetCookie()).toEqual([
        signedInHintCookie(scope),
      ]);
      expect(yield* Effect.promise(() => answer.json())).toMatchObject({
        user: { name: "Ayu" },
      });
    })
  );

  it.effect(
    "leaves an answer whose request already carries the right hint",
    () =>
      Effect.gen(function* () {
        const response = signedIn();

        expect(yield* withSessionHint(sessionRead(hint), response)).toBe(
          response
        );
      })
  );

  it.effect(
    "clears the hint on a signed-out answer to a request that still carries it",
    () =>
      Effect.gen(function* () {
        const answer = yield* withSessionHint(
          sessionRead(hint),
          Response.json(null)
        );

        expect(answer.headers.getSetCookie()).toEqual([
          expiredHintCookie(scope),
        ]);
      })
  );

  it.effect("leaves an answer that is no session read unchanged", () =>
    Effect.gen(function* () {
      const response = new Response("<html>error</html>", { status: 502 });

      expect(yield* withSessionHint(sessionRead(), response)).toBe(response);
    })
  );

  /** One answer of another Better Auth route, with the cookies that it writes. */
  const writes = (...cookies: readonly string[]) => {
    const headers = new Headers({ location: "/en/onboarding" });
    for (const cookie of cookies) {
      headers.append("set-cookie", cookie);
    }
    return new Response(null, { headers, status: 302 });
  };
  const callback = new Request(
    "https://nakafa.com/api/auth/callback/google?code=one-time"
  );
  const SESSION_COOKIE = "__Secure-better-auth.session_token";

  it.effect(
    "sets the hint on the answer that signs in, so the static page it lands on starts signed in",
    () =>
      Effect.gen(function* () {
        const session = `${SESSION_COOKIE}=token.signature; Max-Age=604800; Path=/; HttpOnly`;
        const answer = yield* withSessionHint(callback, writes(session));

        expect(answer.status).toBe(302);
        expect(answer.headers.get("location")).toBe("/en/onboarding");
        expect(answer.headers.getSetCookie()).toEqual([
          session,
          signedInHintCookie(scope),
        ]);
      })
  );

  it.effect(
    "clears the hint on the answer that signs out, whose request still carries it",
    () =>
      Effect.gen(function* () {
        const expired = `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly`;
        const answer = yield* withSessionHint(
          new Request("https://nakafa.com/api/auth/sign-out", {
            headers: { cookie: hint },
            method: "POST",
          }),
          writes(expired)
        );

        expect(answer.headers.getSetCookie()).toEqual([
          expired,
          expiredHintCookie(scope),
        ]);
      })
  );

  it.effect("renews the hint on a session refresh, which keeps it alive", () =>
    Effect.gen(function* () {
      const refreshed = `${SESSION_COOKIE}=next.signature; Max-Age=604800`;
      const answer = yield* withSessionHint(
        sessionRead(hint),
        writes(refreshed)
      );

      expect(answer.headers.getSetCookie()).toEqual([
        refreshed,
        signedInHintCookie(scope),
      ]);
    })
  );

  it.effect("takes the last write of the session cookie in one answer", () =>
    Effect.gen(function* () {
      const answer = yield* withSessionHint(
        callback,
        writes(
          `${SESSION_COOKIE}=; Max-Age=0`,
          `${SESSION_COOKIE}=token.signature`
        )
      );

      expect(answer.headers.getSetCookie()).toContain(
        signedInHintCookie(scope)
      );
    })
  );

  it.effect("leaves an answer that writes another cookie unchanged", () =>
    Effect.gen(function* () {
      const response = writes("__Secure-better-auth.state=one; Path=/");

      expect(yield* withSessionHint(callback, response)).toBe(response);
    })
  );
});
