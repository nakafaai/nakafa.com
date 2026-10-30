// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect, Option, Schema } from "effect";
import { answerFromAuth, answerWithoutAuth } from "@/lib/auth/answer";

const SESSION_URL = "https://nakafa.com/api/auth/get-session";
const TOKEN_URL = "https://nakafa.com/api/auth/convex/token";
const CALLBACK_URL =
  "https://nakafa.com/api/auth/callback/google?code=code&state=state";
const SESSION_COOKIE = { cookie: "better-auth.session_token=signed-token" };
const JsonTextSchema = Schema.fromJsonString(Schema.Unknown);

/** Reads a JSON body as data. */
const jsonOf = (response: Response) =>
  Effect.promise(() => response.text()).pipe(
    Effect.map((text) => Schema.decodeSync(JsonTextSchema)(text))
  );

describe("answerWithoutAuth", () => {
  it.effect(
    "answers the session read of a visitor without a session cookie with null",
    () =>
      Effect.gen(function* () {
        const answer = Option.getOrThrow(
          answerWithoutAuth(
            new Request(SESSION_URL, {
              headers: { cookie: "NAKAFA_LOCALE=id" },
            })
          )
        );

        expect(answer.status).toBe(200);
        expect(answer.headers.get("content-type")).toContain(
          "application/json"
        );
        expect(answer.headers.get("cache-control")).toBe("no-store");
        expect(answer.headers.get("pragma")).toBe("no-cache");
        expect(yield* jsonOf(answer)).toBeNull();
      })
  );

  it.effect(
    "answers the token read of a page without a session cookie with no token",
    () =>
      Effect.gen(function* () {
        const answer = Option.getOrThrow(
          answerWithoutAuth(new Request(TOKEN_URL))
        );

        expect(answer.status).toBe(200);
        expect(answer.headers.get("cache-control")).toBe("no-store");
        expect(answer.headers.get("pragma")).toBe("no-cache");
        expect(answer.headers.getSetCookie()).toStrictEqual([]);
        expect(yield* jsonOf(answer)).toStrictEqual({ token: null });
      })
  );

  it.each([
    { headers: SESSION_COOKIE, name: "a session cookie", url: SESSION_URL },
    {
      headers: { authorization: "Bearer token" },
      name: "a bearer token",
      url: SESSION_URL,
    },
    { headers: SESSION_COOKIE, name: "a session cookie", url: TOKEN_URL },
    { headers: {}, name: "nothing", url: CALLBACK_URL },
  ])(
    "leaves the read $url that sends $name to Better Auth",
    ({ headers, url }) => {
      expect(
        Option.isNone(answerWithoutAuth(new Request(url, { headers })))
      ).toBe(true);
    }
  );
});

describe("answerFromAuth", () => {
  it.effect(
    "gives the token read of a session that has ended no token in place of the 401, keeping the cookies it clears",
    () =>
      Effect.gen(function* () {
        const cleared = new Headers();
        cleared.append(
          "set-cookie",
          "better-auth.session_token=; Max-Age=0; Path=/"
        );
        cleared.append(
          "set-cookie",
          "better-auth.session_data=; Max-Age=0; Path=/"
        );

        const answer = answerFromAuth(
          new Request(TOKEN_URL, { headers: SESSION_COOKIE }),
          Response.json(
            { code: "UNAUTHORIZED", message: "Unauthorized" },
            { headers: cleared, status: 401 }
          )
        );

        expect(answer.status).toBe(200);
        expect(answer.headers.get("cache-control")).toBe("no-store");
        expect(answer.headers.getSetCookie()).toStrictEqual([
          "better-auth.session_token=; Max-Age=0; Path=/",
          "better-auth.session_data=; Max-Age=0; Path=/",
        ]);
        expect(yield* jsonOf(answer)).toStrictEqual({ token: null });
      })
  );

  it("passes the token of a live session through as Better Auth gives it", () => {
    const token = Response.json({ token: "jwt" });

    expect(answerFromAuth(new Request(TOKEN_URL), token)).toBe(token);
  });

  it("passes a 401 of any read but the token's through", () => {
    const refusal = Response.json({ code: "UNAUTHORIZED" }, { status: 401 });

    expect(answerFromAuth(new Request(SESSION_URL), refusal)).toBe(refusal);
  });
});
