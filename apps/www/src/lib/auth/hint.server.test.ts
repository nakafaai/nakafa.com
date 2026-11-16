// @vitest-environment node
import { AUTH_REFRESH_COOKIE } from "@convex-dev/auth/ssr";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Option } from "effect";
import {
  expiredHintCookie,
  hintScopeFor,
  signedInHintCookie,
} from "@/lib/auth/hint";
import { answerNoSession, withSessionHint } from "@/lib/auth/hint.server";

const SITE = new URL("https://nakafa.com");
const scope = hintScopeFor(SITE);

/** An auth route's answer that wrote the given Set-Cookie headers. */
function answerWith(cookies: readonly string[], status = 200) {
  const headers = new Headers();
  for (const cookie of cookies) {
    headers.append("set-cookie", cookie);
  }
  return Response.json({ tokens: null }, { headers, status });
}

describe("withSessionHint", () => {
  it.effect("sets the signed-in hint when the route wrote a session", () =>
    Effect.gen(function* () {
      const session = `${AUTH_REFRESH_COOKIE}=refresh; Path=/; HttpOnly`;
      const answer = withSessionHint(answerWith([session], 201), SITE, "");

      expect(answer.headers.getSetCookie()).toEqual([
        session,
        signedInHintCookie(scope),
      ]);
      expect(answer.status).toBe(201);
      expect(yield* Effect.promise(() => answer.json())).toEqual({
        tokens: null,
      });
    })
  );

  it("expires the hint when the route cleared the session", () => {
    const cleared = `${AUTH_REFRESH_COOKIE}=; Max-Age=0; Path=/`;

    expect(
      withSessionHint(answerWith([cleared]), SITE, "").headers.getSetCookie()
    ).toEqual([cleared, expiredHintCookie(scope)]);
  });

  it("reads the last write when the route cleared and then set the session", () => {
    const answer = withSessionHint(
      answerWith([
        `${AUTH_REFRESH_COOKIE}=; Max-Age=0`,
        `${AUTH_REFRESH_COOKIE}=next`,
      ]),
      SITE,
      ""
    );

    expect(Arr.last(answer.headers.getSetCookie())).toStrictEqual(
      Option.some(signedInHintCookie(scope))
    );
  });

  it("expires a hint that outlived its session when the route refuses with no cookie to clear", () => {
    const refused = withSessionHint(answerWith([], 401), SITE, "");

    expect(refused.headers.getSetCookie()).toEqual([expiredHintCookie(scope)]);
    expect(refused.status).toBe(401);
  });

  it("leaves an answer that wrote no session cookie as it is", () => {
    const response = answerWith(["theme=dark", "broken"]);

    expect(withSessionHint(response, SITE, "")).toBe(response);
  });

  it("reads only the site's own cookie on a site with a prefix", () => {
    const production = answerWith([`${AUTH_REFRESH_COOKIE}=production`]);
    const own = `nakafa-dev.${AUTH_REFRESH_COOKIE}=staging`;

    expect(withSessionHint(production, SITE, "nakafa-dev.")).toBe(production);
    expect(
      Arr.last(
        withSessionHint(
          answerWith([own]),
          SITE,
          "nakafa-dev."
        ).headers.getSetCookie()
      )
    ).toStrictEqual(Option.some(signedInHintCookie(scope)));
  });
});

describe("answerNoSession", () => {
  it.effect(
    "answers no session as a 200 with the refusal's body and cookies",
    () =>
      Effect.gen(function* () {
        const refused = withSessionHint(answerWith([], 401), SITE, "");
        const answer = answerNoSession(refused);

        expect(answer.status).toBe(200);
        expect(answer.headers.getSetCookie()).toEqual([
          expiredHintCookie(scope),
        ]);
        expect(yield* Effect.promise(() => answer.json())).toEqual({
          tokens: null,
        });
      })
  );

  it("leaves every other answer as it is", () => {
    const failed = answerWith([], 500);

    expect(answerNoSession(failed)).toBe(failed);
  });
});
