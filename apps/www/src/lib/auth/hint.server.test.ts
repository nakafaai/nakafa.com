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
});
