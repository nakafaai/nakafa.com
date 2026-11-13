// @vitest-environment node
import { AUTH_REFRESH_COOKIE } from "@convex-dev/auth/ssr";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  expiredHintCookie,
  hintScopeFor,
  signedInHintCookie,
} from "@/lib/auth/hint";
import { withSessionHint } from "@/lib/auth/hint.server";

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

    expect(answer.headers.getSetCookie().at(-1)).toBe(
      signedInHintCookie(scope)
    );
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
      withSessionHint(answerWith([own]), SITE, "nakafa-dev.")
        .headers.getSetCookie()
        .at(-1)
    ).toBe(signedInHintCookie(scope));
  });
});
